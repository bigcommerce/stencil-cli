'use strict';

const  _ = require('lodash');
const Boom = require('@hapi/boom');
const cache = require('memory-cache');
const Crypto = require('crypto');
const Frontmatter = require('front-matter');
const fetch = require('node-fetch');
const Path = require('path');
const Url = require('url');

const langAssembler = require('../../../lib/lang-assembler');
const { PACKAGE_INFO } = require('../../../constants');
const responses = require('./responses/responses');
const templateAssembler = require('../../../lib/template-assembler');
const utils = require('../../lib/utils');

const internals = {
    options: {},
    cacheTTL: 1000 * 15, // 15 seconds
    validCustomTemplatePageTypes: ['brand', 'category', 'page', 'product'],
};

function register (server, options) {
    internals.options = _.defaultsDeep(options, internals.options);

    server.expose('implementation', internals.implementation);
}

/**
 * Renderer Route Handler
 *
 * @param request
 * @param h
 */
internals.implementation = async function (request, h) {
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
internals.sha1sum = function (input) {
    return Crypto.createHash('sha1').update(JSON.stringify(input)).digest('hex');
};

/**
 * Fetches data from Stapler
 *
 * @param request
 */
internals.getResponse = async function (request) {
    const staplerUrlObject = request.app.staplerUrl
        ? Url.parse(request.app.staplerUrl)
        : Url.parse(request.app.storeUrl);

    const httpOpts = {
        headers: {
            ...internals.getHeaders(request, { get_template_file: true, get_data_only: true }),
            host: staplerUrlObject.host,
        },
        // Fetch will break if request body is Stream and server response is redirect,
        //  so we need to read the data first and then send the request
        body: request.payload ? await utils.readStream(request.payload) : request.payload,
        method: 'post',
    };

    const url = Url.format({
        protocol: staplerUrlObject.protocol,
        host: staplerUrlObject.host,
        pathname: request.url.pathname,
        search: request.url.search,
    });

    const responseArgs = {
        httpOpts,
        staplerUrlObject,
        url,
    };

    // create request signature for caching
    const httpOptsSignature = _.omit(httpOpts.headers, ['cookie']);
    const requestSignature = internals.sha1sum(request.method) + internals.sha1sum(url) + internals.sha1sum(httpOptsSignature);
    const cachedResponse = cache.get(requestSignature);

    // check request signature and use cache, if available
    if (cachedResponse && 'get' === request.method && internals.options.useCache) {
        // if GET request, return with cached response
        return await internals.parseResponse(cachedResponse.bcAppData, request, cachedResponse.response, responseArgs);
    } else if ('get' !== request.method) {
        // clear when making a non-get request
        cache.clear();
    }

    const response = await fetch(url, httpOpts);

    if (response.status === 401) {
        return response;
    }

    if (response.status === 500) {
        throw new Error('The BigCommerce server responded with a 500 error');
    }

    if (response.headers.get('set-cookie')) {
        response.headers.set('set-cookie', utils.stripDomainFromCookies(response.headers.get('set-cookie')));
    }

    // Response is a redirect
    if (response.status >= 301 && response.status <= 303) {
        return await internals.redirect(response, request);
    }

    // parse response
    const bcAppData = await response.json();

    // cache response
    cache.put(
        requestSignature,
        {
            bcAppData: bcAppData,
            response: response,
        },
        internals.cacheTTL,
    );

    return await internals.parseResponse(bcAppData, request, response, responseArgs);
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
internals.parseResponse = async function (bcAppData, request, response, responseArgs) {
    let resourcesConfig;
    let dataRequestSignature;
    let httpOptsSignature;
    const configuration = request.app.themeConfig.getConfig();
    const { httpOpts, staplerUrlObject, url } = responseArgs;

    if (!('pencil_response' in bcAppData)) {
        response.headers.delete('x-frame-options');

        // this is a raw response not emitted by TemplateEngine
        return new responses.RawResponse(
            bcAppData,
            _.fromPairs(response.headers.entries()), // Transform fetch.Headers map to a plain object
            response.status,
        );
    }

    // If a remote call, no need to do a second call to get the data,
    // it has already come back
    if (bcAppData.remote) {
        return internals.getPencilResponse(bcAppData, request, response, configuration);
    }

    resourcesConfig = internals.getResourceConfig(bcAppData, request, configuration);

    httpOpts.headers = {
        ...internals.getHeaders(request, { get_data_only: true }, resourcesConfig),
        host: staplerUrlObject.host,
    };

    // create request signature for caching
    httpOptsSignature = _.omit(httpOpts.headers, ['cookie']);
    dataRequestSignature = 'bcapp:' + internals.sha1sum(url) + internals.sha1sum(httpOptsSignature);
    const cachedResponse2 = cache.get(dataRequestSignature);

    let data, response2;
    // check request signature and use cache, if available
    if (internals.options.useCache && cachedResponse2) {
        ({ data, response2 } = cachedResponse2);
    } else {
        response2 = await fetch(url, httpOpts);

        // Response is a redirect
        if (response2.status >= 301 && response2.status <= 303) {
            return internals.redirect(response2, request);
        }

        // Response is bad
        if (response2.status === 500) {
            throw new Error('The BigCommerce server responded with a 500 error');
        }

        data = await response2.json();

        // Data response is bad
        if (data.status && data.status === 500) {
            throw new Error('The BigCommerce server responded with a 500 error');
        }

        cache.put(
            dataRequestSignature,
            { data, response2 },
            internals.cacheTTL,
        );

        if (response2.headers.get('set-cookie')) {
            response2.headers.set('set-cookie', utils.stripDomainFromCookies(response2.headers.get('set-cookie')));
        }
    }

    return internals.getPencilResponse(data, request, response2, configuration);
};

/**
 * Get the resource configuration (front-matter) from the main template
 * or from the header stencil-config for ajax requests
 * @param  {Object} data
 * @param  {Object} request
 * @param  {Object} configuration
 * @return {Object}
 */
internals.getResourceConfig = function (data, request, configuration) {
    const frontmatterRegex = /---\r?\n(?:.|\s)*?\r?\n---\r?\n/g;
    const missingThemeSettingsRegex = /{{\\s*?theme_settings\\..+?\\s*?}}/g;
    let resourcesConfig = {};
    const templatePath = data.template_file;

    // If the requested template is not an array, we parse the Frontmatter
    // If it is an array, then it's an ajax request using `render_with` with multiple components
    // which don't have Frontmatter and needs to get it's config from the `stencil-config` header.
    if (templatePath && !_.isArray(templatePath)) {
        let rawTemplate = templateAssembler.getTemplateContentSync(internals.getThemeTemplatesPath(), templatePath);

        const frontmatterMatch = rawTemplate.match(frontmatterRegex);
        if (frontmatterMatch !== null) {
            let frontmatterContent = frontmatterMatch[0];
            // Interpolate theme settings for frontmatter
            _.forOwn(configuration.settings, function (val, key) {
                const regex = '{{\\s*?theme_settings\\.' + key + '\\s*?}}';

                frontmatterContent = frontmatterContent.replace(new RegExp(regex, 'g'), val);
            });

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
internals.redirect = async function (response, request) {
    if (!response.headers.get('location')) {
        throw new Error('StatusCode is set to 30x but there is no location header to redirect to.');
    }

    const normalizedRedirectUrl = utils.normalizeRedirectUrl(request, response.headers.get('location'));
    response.headers.set('location', normalizedRedirectUrl);

    // return a redirect response
    return new responses.RedirectResponse(
        response.headers.get('location'),
        _.fromPairs(response.headers.entries()), // Transform fetch.Headers map to a plain object
        response.status,
    );
};

/**
 *
 * @param {String} path
 * @param {Object} data
 * @returns {string}
 */
internals.getTemplatePath = function (path, data) {
    const customLayouts = internals.options.customLayouts || {};
    const pageType = data.page_type;
    let templatePath;

    if (internals.validCustomTemplatePageTypes.indexOf(pageType) >= 0 && _.isPlainObject(customLayouts[pageType])) {
        templatePath = _.findKey(customLayouts[pageType], function(p) {
            // normalize input to an array
            if (typeof p === 'string') {
                p = [p];
            }

            const matches = p.filter(function(url) {
                // remove trailing slashes to compare
                return url.replace(/\/$/, '') === path.replace(/\/$/, '');
            });

            return matches.length > 0;
        });

        if (templatePath) {
            templatePath = Path.join('pages/custom', pageType, templatePath.replace(/\.html$/, ''));
        }
    }

    if (!templatePath) {
        // default path
        templatePath = data.template_file;
    }

    return templatePath;
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
internals.getPencilResponse = function (data, request, response, configuration) {
    data.context.theme_settings = configuration.settings;
    data.context.template_engine = configuration.template_engine;

    // change cdn settings to serve local assets
    data.context.settings.cdn_url = '';
    data.context.settings.theme_version_id = utils.int2uuid(1);
    data.context.settings.theme_config_id = utils.int2uuid(request.app.themeConfig.variationIndex + 1);
    data.context.settings.theme_session_id = null;
    data.context.settings.maintenance = {secure_path: `http://localhost:${internals.options.stencilServerPort}`};

    return new responses.PencilResponse({
        template_file: internals.getTemplatePath(request.path, data),
        templates: data.templates,
        remote: data.remote,
        remote_data: data.remote_data,
        context: data.context,
        translations: data.translations,
        method: request.method,
        acceptLanguage: request.headers['accept-language'],
        headers: _.fromPairs(response.headers.entries()), // Transform fetch.Headers map to a plain object
        statusCode: response.status,
    }, internals.themeAssembler);
};

/**
 * Generate and return headers
 *
 * @param {object} request
 * @param {object} [stencilOptions]
 * @param {object} [stencilConfig]
 */
internals.getHeaders = function (request, stencilOptions = {}, stencilConfig) {
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

    return { ...request.headers, ...headers };
};

/**
 * Theme assembler interface for paper
 * @type {Object}
 */
internals.themeAssembler = {
    getTemplates: (path, processor) => {
        return new Promise((resolve, reject) => {
            templateAssembler.assemble(internals.getThemeTemplatesPath(), path, (err, templates) => {
                if (err) {
                    return reject(err);
                }
                if (templates[path]) {
                    // Check if the string includes frontmatter configuration and remove it
                    const match = templates[path].match(/---\r?\n[\S\s]*\r?\n---\r?\n([\S\s]*)$/);

                    if (_.isObject(match) && match[1]) {
                        templates[path] = match[1];
                    }
                }
                return resolve(processor(templates));
            });
        });
    },
    getTranslations: () => {
        return new Promise((resolve, reject) => {
            langAssembler.assemble((err, translations) => {
                if (err) {
                    return reject(err);
                }
                return resolve(_.mapValues(translations, locales => JSON.parse(locales)));
            });
        });
    },
};

internals.getThemeTemplatesPath = () => {
    return Path.join(internals.options.themePath, 'templates');
};

module.exports = {
    register,
    name: 'Renderer',
    version: '0.0.1',
};
