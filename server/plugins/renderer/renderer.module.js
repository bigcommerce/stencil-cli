'use strict';

const  _ = require('lodash');
const Boom = require('boom');
const Cache = require('memory-cache');
const Crypto = require('crypto');
const Frontmatter = require('front-matter');
const Hoek = require('hoek');
const Path = require('path');
const LangAssembler = require('../../../lib/lang-assembler');
const Pkg = require('../../../package.json');
const Responses = require('./responses/responses');
const TemplateAssembler = require('../../../lib/template-assembler');
const Url = require('url');
const Utils = require('../../lib/utils');
const Wreck = require('wreck');
const internals = {
    options: {},
    cacheTTL: 1000 * 15, // 15 seconds
    validCustomTemplatePageTypes: ['brand', 'category', 'page', 'product'],
};

module.exports.register = function (server, options, next) {
    internals.options = Hoek.applyToDefaults(internals.options, options);

    server.expose('implementation', internals.implementation);

    next();
};

module.exports.register.attributes = {
    name: 'Renderer',
    version: '0.0.1',
};

/**
 * Renderer Route Handler
 *
 * @param request
 * @param reply
 */
internals.implementation = function (request, reply) {
    internals.getResponse(request, function (err, response) {
        if (err) {
            return reply(Boom.badImplementation(err));
        }

        if (response.statusCode === 401) {
            return reply(response).code(401);
        }

        response.respond(request, reply);
    });
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
 * @param callback
 */
internals.getResponse = function (request, callback) {
    const staplerUrlObject = request.app.staplerUrl ? Url.parse(request.app.staplerUrl) : Url.parse(request.app.storeUrl);
    const urlObject = _.clone(request.url, true);
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

    // Convert QueryParams with array values to php compatible names (brackets [])
    urlObject.query = _.mapKeys(urlObject.query, function (value, key) {
        if (_.isArray(value)) {
            return key + '[]'
        }

        return key;
    });

    const url = Url.format({
        protocol: staplerUrlObject.protocol,
        host: staplerUrlObject.host,
        pathname: urlObject.pathname,
        search: urlObject.search,
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
        return internals.parseResponse(cachedResponse.bcAppData, request, cachedResponse.response, responseArgs, callback);
    } else if ('get' !== request.method) {
        // clear when making a non-get request
        Cache.clear();
    }

    Wreck.request(request.method, url, httpOpts, function (err, response) {
        if (err) {
            return callback(err);
        }

        if (response.statusCode === 401) {
            return callback(null, response);
        }

        if (response.statusCode === 500) {
            return callback(new Error('The BigCommerce server responded with a 500 error'));
        }

        if (response.headers['set-cookie']) {
            response.headers['set-cookie'] = Utils.stripDomainFromCookies(response.headers['set-cookie']);
        }

        // Response is a redirect
        if (response.statusCode >= 301 && response.statusCode <= 303) {
            return internals.redirect(response, request, callback);
        }

        // parse response
        Wreck.read(response, {json: true}, function (err, bcAppData) {
            if (err) {
                return callback(err);
            }

            // cache response
            Cache.put(requestSignature, {
                bcAppData: bcAppData,
                response: response,
            }, internals.cacheTTL);

            internals.parseResponse(bcAppData, request, response, responseArgs, callback);
        });
    });
};

/**
 * parses the response from bc app
 *
 * @param bcAppData
 * @param request
 * @param response
 * @param responseArgs
 * @param callback
 * @returns {*}
 */
internals.parseResponse = function (bcAppData, request, response, responseArgs, callback) {
    var resourcesConfig;
    var dataRequestSignature;
    var httpOptsSignature;
    var configuration = request.app.themeConfig.getConfig();
    var httpOpts = responseArgs.httpOpts;
    var staplerUrlObject = responseArgs.staplerUrlObject;
    var url = responseArgs.url;

    if (!_.has(bcAppData, 'pencil_response')) {

        delete response.headers['x-frame-options'];

        // this is a raw response not emitted by TemplateEngine
        return callback(null, new Responses.RawResponse(
            bcAppData,
            response.headers,
            response.statusCode
        ));
    }

    // If a remote call, no need to do a second call to get the data,
    // it has already come back
    if (bcAppData.remote) {
        return callback(null, internals.getPencilResponse(bcAppData, request, response, configuration));
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
            var cache = Cache.get(dataRequestSignature);

            return callback(null, internals.getPencilResponse(cache.data, request, cache.response, configuration));

        } else {
            Wreck.get(url, httpOpts, function (err, response, data) {
                if (err) {
                    return callback(err);
                }

                // Response is a redirect
                if (response.statusCode >= 301 && response.statusCode <= 303) {
                    return internals.redirect(response, request, callback);
                }

                // Response is bad
                if (response.statusCode === 500) {
                    return callback(new Error('The BigCommerce server responded with a 500 error'));
                }

                try {
                    data = JSON.parse(data);
                } catch (e) {
                    return callback(e);
                }

                // Data response is bad
                if (data.statusCode && data.statusCode === 500) {
                    return callback(new Error('The BigCommerce server responded with a 500 error'));
                }

                // Cache data
                Cache.put(dataRequestSignature, {
                    data: data,
                    response: response,
                }, internals.cacheTTL);

                return callback(null, internals.getPencilResponse(data, request, response, configuration));
            });
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
    var frontmatter,
        frontmatterRegex = /---\r?\n(?:.|\s)*?\r?\n---\r?\n/g,
        missingThemeSettingsRegex = /{{\\s*?theme_settings\\..+?\\s*?}}/g,
        frontmatterMatch,
        frontmatterContent,
        rawTemplate,
        resourcesConfig = {},
        templatePath = data.template_file;

    // If the requested template is not an array, we parse the Frontmatter
    // If it is an array, then it's an ajax request using `render_with` with multiple components
    // which don't have Frontmatter and needs to get it's config from the `stencil-config` header.
    if (templatePath && !_.isArray(templatePath)) {
        rawTemplate = TemplateAssembler.getTemplateContentSync(internals.getThemeTemplatesPath(), templatePath);

        frontmatterMatch = rawTemplate.match(frontmatterRegex);
        if (frontmatterMatch !== null) {
            frontmatterContent = frontmatterMatch[0];
            // Interpolate theme settings for frontmatter
            _.forOwn(configuration.settings, function (val, key) {
                var regex = '{{\\s*?theme_settings\\.' + key + '\\s*?}}';

                frontmatterContent = frontmatterContent.replace(new RegExp(regex, 'g'), val);
            });

            // Remove any handlebars tags that weren't interpolated because there was no setting for it
            frontmatterContent = frontmatterContent.replace(missingThemeSettingsRegex, '');
            // Replace the frontmatter with the newly interpolated version
            rawTemplate = rawTemplate.replace(frontmatterRegex, frontmatterContent);
        }

        frontmatter = Frontmatter(rawTemplate);
        // Set the config
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
 * @param callback
 * @returns {*}
 */
internals.redirect = function (response, request, callback) {
    if (!response.headers.location) {
        return callback(new Error('StatusCode is set to 30x but there is no location header to redirect to.'));
    }

    response.headers.location = Utils.normalizeRedirectUrl(request, response.headers.location);

    // return a redirect response
    return callback(null, new Responses.RedirectResponse(
        response.headers.location,
        response.headers,
        response.statusCode
    ));
};

/**
 *
 * @param {String} path
 * @param {Object} data
 * @returns {string}
 */
internals.getTemplatePath = function (path, data) {
    var customLayouts = internals.options.customLayouts || {};
    var pageType = data.page_type;
    var templatePath;

    if (internals.validCustomTemplatePageTypes.indexOf(pageType) >= 0 && _.isPlainObject(customLayouts[pageType])) {
        templatePath = _.findKey(customLayouts[pageType], function(p) {
            // normalize input to an array
            if (typeof p === 'string') {
              p = [p];
            }

            var matches = p.filter(function(url) {
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

    // change cdn settings to serve local assets
    data.context.settings.cdn_url = '';
    data.context.settings.theme_version_id = Utils.int2uuid(1);
    data.context.settings.theme_config_id = Utils.int2uuid(request.app.themeConfig.variationIndex + 1);
    data.context.settings.theme_session_id = null;
    data.context.settings.maintenance = {secure_path: `http://localhost:${internals.options.stencilEditorPort}`};

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
    var currentOptions = {},
        headers;

    options = options || {};

    // If stencil-config header already set, we don't want to overwrite it
    if (!request.headers['stencil-config'] && config) {
        request.headers['stencil-config'] = JSON.stringify(config);
    }

    // Merge in current stencil-options with passed in options
    if (request.headers['stencil-options']) {
        try {
            currentOptions = JSON.parse(request.headers['stencil-options']);
        } catch (e) {
            throw e;
        }
    }

    headers = {
        'stencil-cli': Pkg.version,
        'stencil-version': Pkg.config.stencil_version,
        'stencil-options': JSON.stringify(Hoek.applyToDefaults(options, currentOptions)),
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

    return Hoek.applyToDefaults(request.headers, headers);
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
        })
    },
    getTranslations: () => {
        return new Promise((resolve, reject) => {
            LangAssembler.assemble((err, translations) => {
                if (err) {
                    return reject(err);
                }
                return resolve(_.mapValues(translations, locales => JSON.parse(locales)));
            });
        })
    },
};

internals.getThemeTemplatesPath = () => {
    return Path.join(internals.options.themePath, 'templates');
};
