const _ = require('lodash');
const Boom = require('@hapi/boom');
const cache = require('memory-cache');
const Crypto = require('crypto');
const Frontmatter = require('front-matter');
const fetch = require('node-fetch');
const path = require('path');
const { promisify } = require('util');

const langAssembler = require('../../../lib/lang-assembler');
const { PACKAGE_INFO } = require('../../../constants');
const { RawResponse, RedirectResponse, PencilResponse } = require('./responses');
const templateAssembler = require('../../../lib/template-assembler');
const utils = require('../../lib/utils');
const { readFromStream } = require('../../../lib/utils/asyncUtils');

const internals = {
    options: {},
    cacheTTL: 1000 * 15, // 15 seconds
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

    if (response.status === 401) {
        return h.response(response).code(401);
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
    const staplerUrlObject = request.app.staplerUrl
        ? new URL(request.app.staplerUrl)
        : new URL(request.app.storeUrl);

    const httpOpts = {
        headers: internals.buildReqHeaders({
            request,
            stencilOptions: { get_template_file: true, get_data_only: true },
            extraHeaders: { host: staplerUrlObject.host },
        }),
        // Fetch will break if request body is Stream and server response is redirect,
        //  so we need to read the data first and then send the request
        body: request.payload ? await readFromStream(request.payload) : request.payload,
        method: request.method,
        redirect: 'manual',
    };

    const url = Object.assign(new URL(request.url.toString()), {
        port: staplerUrlObject.port,
        host: staplerUrlObject.host,
        protocol: staplerUrlObject.protocol,
    });

    const responseArgs = {
        httpOpts,
        staplerUrlObject,
        url,
    };

    // create request signature for caching
    const httpOptsSignature = _.omit(httpOpts.headers, ['cookie']);
    const requestSignature =
        internals.sha1sum(request.method) +
        internals.sha1sum(url) +
        internals.sha1sum(httpOptsSignature);
    const cachedResponse = cache.get(requestSignature);

    // check request signature and use cache, if available
    if (cachedResponse && request.method === 'get' && internals.options.useCache) {
        // if GET request, return with cached response
        return internals.parseResponse(
            cachedResponse.bcAppData,
            request,
            cachedResponse.response,
            responseArgs,
        );
    }
    if (request.method !== 'get') {
        // clear when making a non-get request
        cache.clear();
    }

    const response = await fetch(url, httpOpts);

    internals.processResHeaders(response.headers);

    if (response.status === 401) {
        return response;
    }

    if (response.status === 500) {
        throw new Error('The BigCommerce server responded with a 500 error');
    }

    // Response is a redirect
    if (response.status >= 301 && response.status <= 303) {
        return internals.redirect(response, request);
    }

    const contentType = response.headers.get('content-type') || '';
    const isResponseJson = contentType.toLowerCase().includes('application/json');
    const bcAppData = isResponseJson ? await response.json() : await response.text();

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
    const { httpOpts, staplerUrlObject, url } = responseArgs;

    if (typeof bcAppData !== 'object' || !('pencil_response' in bcAppData)) {
        response.headers.delete('x-frame-options');

        // this is a raw response not emitted by TemplateEngine
        return new RawResponse(bcAppData, response.headers.raw(), response.status);
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
        extraHeaders: { host: staplerUrlObject.host },
    });

    // create request signature for caching
    const httpOptsSignature = internals.sha1sum(_.omit(httpOpts.headers, ['cookie']));
    const urlSignature = internals.sha1sum(url);
    const dataRequestSignature = `bcapp:${urlSignature}${httpOptsSignature}`;
    const cachedResponse2 = cache.get(dataRequestSignature);

    let data;
    let response2;
    // check request signature and use cache, if available
    if (internals.options.useCache && cachedResponse2) {
        ({ data, response2 } = cachedResponse2);
    } else {
        response2 = await fetch(url, httpOpts);

        internals.processResHeaders(response2.headers);

        // Response is a redirect
        if (response2.status >= 301 && response2.status <= 303) {
            return internals.redirect(response2, request);
        }

        if (response2.status === 500) {
            throw new Error('The BigCommerce server responded with a 500 error');
        }

        data = await response2.json();

        if (data.status && data.status === 500) {
            throw new Error('The BigCommerce server responded with a 500 error');
        }

        cache.put(dataRequestSignature, { data, response2 }, internals.cacheTTL);
    }

    return internals.getPencilResponse(data, request, response2, configuration);
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
    const location = response.headers.get('location');

    if (!location) {
        throw new Error('StatusCode is set to 30x but there is no location header to redirect to.');
    }

    response.headers.set('location', utils.normalizeRedirectUrl(request, location));

    // return a redirect response
    return new RedirectResponse(location, response.headers.raw(), response.status);
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
 * @returns {*}
 */
internals.getPencilResponse = (data, request, response, configuration) => {
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
            context,
            translations: data.translations,
            method: request.method,
            acceptLanguage: request.headers['accept-language'],
            headers: response.headers.raw(),
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
        'stencil-cli': PACKAGE_INFO.version,
        'stencil-version': PACKAGE_INFO.config.stencil_version,
        'stencil-options': JSON.stringify({ ...stencilOptions, ...currentOptions }),
        'accept-encoding': 'identity',
    };

    if (!request.headers['stencil-config'] && stencilConfig) {
        headers['stencil-config'] = JSON.stringify(stencilConfig);
    }
    if (internals.options.accessToken) {
        headers['X-Auth-Client'] = 'stencil-cli';
        headers['X-Auth-Token'] = internals.options.accessToken;
    }
    // Development
    if (request.app.staplerUrl) {
        headers['stencil-store-url'] = request.app.storeUrl;
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
    if (headers.get('set-cookie')) {
        // When there are several values for the same header headers.get() returns
        //  an array joined with comma which is wrong for cookies, so we use the initial raw Array
        // https://github.com/node-fetch/node-fetch/issues/251#issuecomment-428143940
        // eslint-disable-next-line no-param-reassign
        headers.raw()['set-cookie'] = utils.stripDomainFromCookies(headers.raw()['set-cookie']);
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
