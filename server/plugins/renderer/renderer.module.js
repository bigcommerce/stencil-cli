'use strict';

const  _ = require('lodash');
const Boom = require('@hapi/boom');
const Cache = require('memory-cache');
const Crypto = require('crypto');
const Frontmatter = require('front-matter');
const Wreck = require('wreck');
const Path = require('path');
const { promisify } = require('util');
const Url = require('url');

const LangAssembler = require('../../../lib/lang-assembler');
const { PACKAGE_INFO } = require('../../../constants');
const Responses = require('./responses/responses');
const TemplateAssembler = require('../../../lib/template-assembler');
const Utils = require('../../lib/utils');

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

    if (response.statusCode === 401) {
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
        rejectUnauthorized: false,
        headers: internals.getHeaders(request, {
            get_template_file: true,
            get_data_only: true,
        }),
        payload: request.payload,
    };

    // Set host to stapler host
    httpOpts.headers.host = staplerUrlObject.host;

    const url = Url.format({
        protocol: staplerUrlObject.protocol,
        host: staplerUrlObject.host,
        pathname: request.url.pathname,
        search: request.url.search,
    });

    const responseArgs = {
        httpOpts: httpOpts,
        staplerUrlObject: staplerUrlObject,
        url: url,
    };

    // create request signature for caching
    const httpOptsSignature = _.cloneDeep(httpOpts.headers);
    delete httpOptsSignature.cookie;
    const requestSignature = internals.sha1sum(request.method) + internals.sha1sum(url) + internals.sha1sum(httpOptsSignature);
    const cachedResponse = Cache.get(requestSignature);

    // check request signature and use cache, if available
    if (cachedResponse && 'get' === request.method && internals.options.useCache) {
        // if GET request, return with cached response
        return await internals.parseResponse(cachedResponse.bcAppData, request, cachedResponse.response, responseArgs);
    } else if ('get' !== request.method) {
        // clear when making a non-get request
        Cache.clear();
    }

    const response = await promisify(Wreck.request.bind(Wreck))(request.method, url, httpOpts);

    if (response.statusCode === 401) {
        return response;
    }

    if (response.statusCode === 500) {
        throw new Error('The BigCommerce server responded with a 500 error');
    }

    if (response.headers['set-cookie']) {
        response.headers['set-cookie'] = Utils.stripDomainFromCookies(response.headers['set-cookie']);
    }

    // Response is a redirect
    if (response.statusCode >= 301 && response.statusCode <= 303) {
        return await internals.redirect(response, request);
    }

    // parse response
    const bcAppData = await promisify(Wreck.read.bind(Wreck))(response, {json: true});

    // cache response
    Cache.put(
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
    const httpOpts = responseArgs.httpOpts;
    const staplerUrlObject = responseArgs.staplerUrlObject;
    const url = responseArgs.url;

    if (!_.has(bcAppData, 'pencil_response')) {
        delete response.headers['x-frame-options'];

        // this is a raw response not emitted by TemplateEngine
        return new Responses.RawResponse(
            bcAppData,
            response.headers,
            response.statusCode,
        );
    }

    // If a remote call, no need to do a second call to get the data,
    // it has already come back
    if (bcAppData.remote) {
        return internals.getPencilResponse(bcAppData, request, response, configuration);
    } else {
        resourcesConfig = internals.getResourceConfig(bcAppData, request, configuration);

        httpOpts.headers = internals.getHeaders(request, {get_data_only: true}, resourcesConfig);
        // Set host to stapler host
        httpOpts.headers.host = staplerUrlObject.host;

        // create request signature for caching
        httpOptsSignature = _.cloneDeep(httpOpts.headers);
        delete httpOptsSignature.cookie;
        dataRequestSignature = 'bcapp:' + internals.sha1sum(url) + internals.sha1sum(httpOptsSignature);

        // check request signature and use cache, if available
        if (internals.options.useCache && Cache.get(dataRequestSignature)) {
            const cache = Cache.get(dataRequestSignature);

            return internals.getPencilResponse(cache.data, request, cache.response, configuration);
        } else {
            const { res, payload } = await Wreck.get(url, httpOpts);

            // Response is a redirect
            if (res.statusCode >= 301 && res.statusCode <= 303) {
                return internals.redirect(res, request);
            }

            // Response is bad
            if (res.statusCode === 500) {
                throw new Error('The BigCommerce server responded with a 500 error');
            }

            let data = JSON.parse(payload);

            // Data response is bad
            if (data.statusCode && data.statusCode === 500) {
                throw new Error('The BigCommerce server responded with a 500 error');
            }

            // Cache data
            Cache.put(
                dataRequestSignature,
                {
                    data: data,
                    response: res,
                },
                internals.cacheTTL,
            );

            if (res.headers['set-cookie']) {
                res.headers['set-cookie'] = Utils.stripDomainFromCookies(res.headers['set-cookie']);
            }

            return internals.getPencilResponse(data, request, res, configuration);
        }
    }
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
        let rawTemplate = TemplateAssembler.getTemplateContentSync(internals.getThemeTemplatesPath(), templatePath);

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
    if (!response.headers.location) {
        throw new Error('StatusCode is set to 30x but there is no location header to redirect to.');
    }

    response.headers.location = Utils.normalizeRedirectUrl(request, response.headers.location);

    // return a redirect response
    return new Responses.RedirectResponse(
        response.headers.location,
        response.headers,
        response.statusCode,
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
    data.context.settings.theme_version_id = Utils.int2uuid(1);
    data.context.settings.theme_config_id = Utils.int2uuid(request.app.themeConfig.variationIndex + 1);
    data.context.settings.theme_session_id = null;
    data.context.settings.maintenance = {secure_path: `http://localhost:${internals.options.stencilServerPort}`};

    return new Responses.PencilResponse({
        template_file: internals.getTemplatePath(request.path, data),
        templates: data.templates,
        remote: data.remote,
        remote_data: data.remote_data,
        context: data.context,
        translations: data.translations,
        method: request.method,
        acceptLanguage: request.headers['accept-language'],
        headers: response.headers,
        statusCode: response.statusCode,
    }, internals.themeAssembler);
};

/**
 * Generate and return headers
 *
 * @param request
 * @param options
 * @param config
 */
internals.getHeaders = function (request, options, config) {
    options = options || {};

    // If stencil-config header already set, we don't want to overwrite it
    if (!request.headers['stencil-config'] && config) {
        request.headers['stencil-config'] = JSON.stringify(config);
    }

    // Merge in current stencil-options with passed in options
    let currentOptions = {};
    if (request.headers['stencil-options']) {
        try {
            currentOptions = JSON.parse(request.headers['stencil-options']);
        } catch (e) {
            throw e;
        }
    }

    const headers = {
        'stencil-cli': PACKAGE_INFO.version,
        'stencil-version': PACKAGE_INFO.config.stencil_version,
        'stencil-options': JSON.stringify(_.defaultsDeep(currentOptions, options)),
        'accept-encoding': 'identity',
    };

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
            TemplateAssembler.assemble(internals.getThemeTemplatesPath(), path, (err, templates) => {
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
            LangAssembler.assemble((err, translations) => {
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
