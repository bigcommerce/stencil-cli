const _ = require('lodash');
const Boom = require('@hapi/boom');
const cache = require('memory-cache');
const Crypto = require('crypto');
const Frontmatter = require('front-matter');
const path = require('path');
const { promisify } = require('util');

const langAssembler = require('../../../lib/lang-assembler');
const { RawResponse, RedirectResponse, PencilResponse } = require('./responses');
const templateAssembler = require('../../../lib/template-assembler');
const utils = require('../../lib/utils');
const { readFromStream } = require('../../../lib/utils/asyncUtils');
const NetworkUtils = require('../../../lib/utils/NetworkUtils');
const contentApiClient = require('../../../lib/content-api-client');
const { getPageType } = require('../../lib/page-type-util');

const networkUtils = new NetworkUtils();

const internals = {
    options: {},
    cacheTTL: 1000 * 15, // 15 seconds
    graphQLCacheTTL: 1000 * 300, // 5 minutes
    validCustomTemplatePageTypes: ['brand', 'category', 'page', 'product'],
};

function register(server, options) {
    internals.options = _.defaultsDeep(options, internals.options);

    server.expose('implementation', internals.implementation);
}

/**
 * Renderer Route Handler
 *
 * @param request
 * @param h
 */
internals.implementation = async (request, h) => {
    let response;

    try {
        response = await internals.getResponse(request);
    } catch (err) {
        throw Boom.badImplementation(err);
    }

    return response.respond(request, h);
};

/**
 * Creates a hash
 *
 * @param {String|Object|Array} input
 * @returns String
 */
internals.sha1sum = (input) => {
    return Crypto.createHash('sha1').update(JSON.stringify(input)).digest('hex');
};

/**
 * Fetches data from Stapler
 *
 * @param request
 */
internals.getResponse = async (request) => {
    const storeUrlObj = new URL(request.app.storeUrl);

    const httpOpts = {
        url: Object.assign(new URL(request.url.toString()), {
            port: storeUrlObj.port,
            host: storeUrlObj.host,
            protocol: storeUrlObj.protocol,
        }).toString(),
        headers: internals.buildReqHeaders({
            request,
            stencilOptions: { get_template_file: true, get_data_only: true },
            extraHeaders: { host: storeUrlObj.host },
        }),
        accessToken: internals.options.accessToken,
        data: request.payload,
        method: request.method,
        maxRedirects: 0, // handle the redirects manually to handle the redirect location
        // If the response is an image it will be parsed wrongly, so we receive a raw data (stream)
        //  and perform it manually depending on contentType later
        responseType: 'stream',
        validateStatus: (status) => status >= 200 && status < 500,
    };

    const responseArgs = {
        httpOpts,
        storeUrlObj,
    };

    // check request signature and use cache, if available
    const httpOptsSignature = _.omit(httpOpts.headers, ['cookie']);
    const requestSignature = internals.sha1sum(httpOpts.url) + internals.sha1sum(httpOptsSignature);
    const cachedResponse = cache.get(requestSignature);
    if (cachedResponse && request.method === 'get' && internals.options.useCache) {
        return internals.parseResponse(
            cachedResponse.bcAppData,
            request,
            cachedResponse.response,
            responseArgs,
        );
    }
    if (request.method !== 'get') {
        // clear when making a non-get request because smth may be changed
        cache.clear();
    }

    const response = await networkUtils.sendApiRequest(httpOpts);

    internals.processResHeaders(response.headers);

    // Redirect
    if (response.status >= 301 && response.status <= 303) {
        return internals.redirect(response, request);
    }
    // Else response is success (2xx), need to handle it further
    // (5xx will be just thrown by axios)

    const contentType = response.headers['content-type'] || '';
    const isResponseJson = contentType.toLowerCase().includes('application/json');
    const bcAppData = isResponseJson
        ? JSON.parse(await readFromStream(response.data))
        : response.data;

    // cache response
    cache.put(
        requestSignature,
        {
            bcAppData,
            response,
        },
        internals.cacheTTL,
    );

    return internals.parseResponse(bcAppData, request, response, responseArgs);
};

/**
 * parses the response from bc app
 *
 * @param bcAppData
 * @param request
 * @param response
 * @param responseArgs
 * @returns {*}
 */
internals.parseResponse = async (bcAppData, request, response, responseArgs) => {
    const { httpOpts, storeUrlObj } = responseArgs;

    if (typeof bcAppData !== 'object' || !('pencil_response' in bcAppData)) {
        delete response.headers['x-frame-options'];

        // this is a raw response not emitted by TemplateEngine
        return new RawResponse(bcAppData, response.headers, response.status);
    }

    const configuration = await request.app.themeConfig.getConfig();

    // If a remote call, no need to do a second call to get the data,
    // it has already come back
    if (bcAppData.remote) {
        return internals.getPencilResponse(bcAppData, request, response, configuration);
    }

    httpOpts.headers = internals.buildReqHeaders({
        request,
        stencilOptions: { get_data_only: true },
        stencilConfig: internals.getResourceConfig(bcAppData, request, configuration),
        extraHeaders: { host: storeUrlObj.host },
    });
    httpOpts.responseType = 'json'; // In the second request we always expect json

    // create request signature for caching
    const httpOptsSignature = internals.sha1sum(_.omit(httpOpts.headers, ['cookie']));
    const urlSignature = internals.sha1sum(httpOpts.url);
    const dataRequestSignature = `bcapp:${urlSignature}${httpOptsSignature}`;
    const cachedResponse2 = cache.get(dataRequestSignature);

    let response2;
    // check request signature and use cache, if available
    if (internals.options.useCache && cachedResponse2) {
        ({ response2 } = cachedResponse2);
    } else {
        response2 = await networkUtils.sendApiRequest(httpOpts);

        internals.processResHeaders(response2.headers);

        // Response is a redirect
        if (response2.status >= 301 && response2.status <= 303) {
            return internals.redirect(response2, request);
        }

        if (response2.data && response2.data.status === 500) {
            throw new Error('The BigCommerce server responded with a 500 error');
        }

        cache.put(dataRequestSignature, { response2 }, internals.cacheTTL);
    }

    const templateFile = response2.data.template_file;
    const entityId = response2.data.entity_id;

    const pageType = getPageType(templateFile);
    let regionResponse = [];

    if (pageType) {
        // create request signature and use cache, if available
        const graphQLUrlSignature = internals.sha1sum(internals.options.storeUrl + '/graphql');
        const graphQLQuerySignature = internals.sha1sum(pageType + entityId);
        const graphQLDataReqSignature = `graphql:${graphQLUrlSignature + graphQLQuerySignature}`;
        const cachedGraphQLResponse = cache.get(graphQLDataReqSignature);

        if (internals.options.useCache && cachedGraphQLResponse) {
            ({ regionResponse } = cachedGraphQLResponse);
        } else {
            if (typeof entityId === 'number') {
                regionResponse = await contentApiClient.getRenderedRegionsByPageTypeAndEntityId({
                    accessToken: response2.data.context.settings.storefront_api.token,
                    storeUrl: internals.options.storeUrl,
                    pageType,
                    entityId,
                });
            } else {
                regionResponse = await contentApiClient.getRenderedRegionsByPageType({
                    accessToken: response2.data.context.settings.storefront_api.token,
                    storeUrl: internals.options.storeUrl,
                    pageType,
                });
            }

            cache.put(graphQLDataReqSignature, { regionResponse }, internals.graphQLCacheTTL);
        }
    }

    const formattedRegions = {};

    if (typeof regionResponse.renderedRegions !== 'undefined') {
        regionResponse.renderedRegions.forEach((region) => {
            formattedRegions[region.name] = region.html;
        });
    }

    return internals.getPencilResponse(
        response2.data,
        request,
        response2,
        configuration,
        formattedRegions,
    );
};

/**
 * Get the resource configuration (front-matter) from the main template
 * or from the header stencil-config for ajax requests
 * @param  {Object} data
 * @param  {Object} request
 * @param  {Object} configuration
 * @returns {Object}
 */
internals.getResourceConfig = (data, request, configuration) => {
    const frontmatterRegex = /---\r?\n(?:.|\s)*?\r?\n---\r?\n/g;
    const missingThemeSettingsRegex = /{{\\s*?theme_settings\\..+?\\s*?}}/g;
    let resourcesConfig = {};
    const templatePath = data.template_file;

    // If the requested template is not an array, we parse the Frontmatter
    // If it is an array, then it's an ajax request using `render_with` with multiple components
    // which don't have Frontmatter and needs to get it's config from the `stencil-config` header.
    if (templatePath && !Array.isArray(templatePath)) {
        let rawTemplate = templateAssembler.getTemplateContentSync(
            internals.getThemeTemplatesPath(),
            templatePath,
        );

        const frontmatterMatch = rawTemplate.match(frontmatterRegex);
        if (frontmatterMatch !== null) {
            let frontmatterContent = frontmatterMatch[0];
            // Interpolate theme settings for frontmatter
            for (const [key, val] of Object.entries(configuration.settings)) {
                const regex = `{{\\s*?theme_settings\\.${key}\\s*?}}`;

                frontmatterContent = frontmatterContent.replace(new RegExp(regex, 'g'), val);
            }

            // Remove any handlebars tags that weren't interpolated because there was no setting for it
            frontmatterContent = frontmatterContent.replace(missingThemeSettingsRegex, '');
            // Replace the frontmatter with the newly interpolated version
            rawTemplate = rawTemplate.replace(frontmatterRegex, frontmatterContent);
        }

        const frontmatter = Frontmatter(rawTemplate); // Set the config
        resourcesConfig = frontmatter.attributes;
        // Merge the frontmatter config  with the global resource config
        if (_.isObject(configuration.resources)) {
            resourcesConfig = _.extend({}, configuration.resources, resourcesConfig);
        }
    } else if (request.headers['stencil-config']) {
        try {
            resourcesConfig = JSON.parse(request.headers['stencil-config']);
        } catch (e) {
            resourcesConfig = {};
        }
    }

    return resourcesConfig;
};

/**
 * Redirects based on the response & request
 *
 * @param response
 * @param request
 * @returns {*}
 */
internals.redirect = async (response, request) => {
    const { location } = response.headers;

    if (!location) {
        throw new Error('StatusCode is set to 30x but there is no location header to redirect to.');
    }

    response.headers.location = utils.normalizeRedirectUrl(location, request.app);

    // return a redirect response
    return new RedirectResponse(location, response.headers, response.status);
};

/**
 *
 * @param {string} requestPath
 * @param {Object} data
 * @returns {string}
 */
internals.getTemplatePath = (requestPath, data) => {
    const customLayouts = internals.options.customLayouts || {};
    const pageType = data.page_type;
    let templatePath;

    if (
        internals.validCustomTemplatePageTypes.includes(pageType) &&
        _.isPlainObject(customLayouts[pageType])
    ) {
        templatePath = _.findKey(customLayouts[pageType], (paths) => {
            // Can be either string or Array, so normalize to Arrays
            const normalizedPaths = typeof paths === 'string' ? [paths] : paths;

            const matches = normalizedPaths.filter((url) => {
                // remove trailing slashes to compare
                return url.replace(/\/$/, '') === requestPath.replace(/\/$/, '');
            });

            return matches.length > 0;
        });

        if (templatePath) {
            templatePath = path.join('pages/custom', pageType, templatePath.replace(/\.html$/, ''));
        }
    }

    return templatePath || data.template_file;
};

/**
 * Creates a new Pencil Response object and returns it.
 *
 * @param data
 * @param request
 * @param response
 * @param configuration
 * @param renderedRegions
 * @returns {*}
 */
internals.getPencilResponse = (data, request, response, configuration, renderedRegions = {}) => {
    const context = {
        ...data.context,
        theme_settings: configuration.settings,
        template_engine: configuration.template_engine,
        settings: {
            ...data.context.settings,
            // change cdn settings to serve local assets
            cdn_url: '',
            theme_version_id: utils.int2uuid(1),
            theme_config_id: utils.int2uuid(request.app.themeConfig.variationIndex + 1),
            theme_session_id: null,
            maintenance: { secure_path: `http://localhost:${internals.options.port}` },
        },
    };

    return new PencilResponse(
        {
            template_file: internals.getTemplatePath(request.path, data),
            templates: data.templates,
            remote: data.remote,
            remote_data: data.remote_data,
            renderedRegions,
            context,
            translations: data.translations,
            method: request.method,
            acceptLanguage: request.headers['accept-language'],
            headers: response.headers,
            statusCode: response.status,
        },
        internals.themeAssembler,
    );
};

/**
 * Get headers from request and return a new object with processed headers
 *
 * @param {object} request - Hapi request
 * @param {[string]: string} request.headers
 * @param {object} request.app
 * @param {object} [stencilOptions]
 * @param {object} [stencilConfig]
 * @param {object} [extraHeaders] - extra headers to add to the result
 * @returns {object}
 */
internals.buildReqHeaders = ({
    request,
    stencilOptions = {},
    stencilConfig = null,
    extraHeaders = {},
}) => {
    // Merge in current stencil-options with passed in options
    const currentOptions = request.headers['stencil-options']
        ? JSON.parse(request.headers['stencil-options'])
        : {};

    const headers = {
        'stencil-options': JSON.stringify({ ...stencilOptions, ...currentOptions }),
        'accept-encoding': 'identity',
    };

    if (!request.headers['stencil-config'] && stencilConfig) {
        headers['stencil-config'] = JSON.stringify(stencilConfig);
    }

    return { ...request.headers, ...headers, ...extraHeaders };
};

/**
 * Process headers from Fetch response
 *
 * @param {Headers} headers
 * @returns {object}
 */
internals.processResHeaders = (headers) => {
    if (headers && headers['set-cookie']) {
        // eslint-disable-next-line no-param-reassign
        headers['set-cookie'] = utils.stripDomainFromCookies(headers['set-cookie']);
    }
};

/**
 * Theme assembler interface for paper
 * @type {Object}
 */
internals.themeAssembler = {
    async getTemplates(templatesPath, processor) {
        const templates = await promisify(templateAssembler.assemble)(
            internals.getThemeTemplatesPath(),
            templatesPath,
        );

        if (templates[templatesPath]) {
            // Check if the string includes frontmatter configuration and remove it
            const match = templates[templatesPath].match(/---\r?\n[\S\s]*\r?\n---\r?\n([\S\s]*)$/);

            if (match && match[1]) {
                // eslint-disable-next-line prefer-destructuring
                templates[templatesPath] = match[1];
            }
        }

        return processor(templates);
    },
    getTranslations: () => {
        return new Promise((resolve, reject) => {
            langAssembler.assemble((err, translations) => {
                if (err) {
                    return reject(err);
                }
                return resolve(_.mapValues(translations, (locales) => JSON.parse(locales)));
            });
        });
    },
};

internals.getThemeTemplatesPath = () => {
    return path.join(internals.options.themePath, 'templates');
};

module.exports = {
    register,
    name: 'Renderer',
    version: '0.0.1',
};
