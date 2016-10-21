var _ = require('lodash'),
    Boom = require('boom'),
    Cache = require('memory-cache'),
    Crypto = require('crypto'),
    Frontmatter = require('front-matter'),
    Hoek = require('hoek'),
    Path = require('path'),
    LangAssembler = require('../../../lib/lang-assembler'),
    Pkg = require('../../../package.json'),
    Responses = require('./responses/responses'),
    TemplateAssembler = require('../../../lib/template-assembler'),
    Url = require('url'),
    Utils = require('../../lib/utils'),
    stencilToken = require('../../lib/stencil-token'),
    Wreck = require('wreck'),
    internals = {
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
    version: '0.0.1'
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
    var staplerUrlObject = request.app.staplerUrl ? Url.parse(request.app.staplerUrl) : Url.parse(request.app.storeUrl),
        urlObject = _.clone(request.url, true),
        url,
        requestSignature,
        httpOpts = {
            rejectUnauthorized: false,
            headers: internals.getHeaders(request, {get_template_file: true, get_data_only: true}),
            payload: request.payload
        },
        httpOptsSignature,
        responseArgs,
        cachedResponse;

    // Set host to stapler host
    httpOpts.headers.host = staplerUrlObject.host;

    // Convert QueryParams with array values to php compatible names (brackets [])
    urlObject.query = _.mapKeys(urlObject.query, function (value, key) {
        if (_.isArray(value)) {
            return key + '[]'
        }

        return key;
    });

    url = Url.format({
        protocol: staplerUrlObject.protocol,
        host: staplerUrlObject.host,
        pathname: urlObject.pathname,
        search: urlObject.search
    });

    responseArgs = {
        httpOpts: httpOpts,
        staplerUrlObject: staplerUrlObject,
        url: url
    };

    // create request signature for caching
    httpOptsSignature = _.cloneDeep(httpOpts.headers);
    delete httpOptsSignature.cookie;
    requestSignature = internals.sha1sum(request.method) + internals.sha1sum(url) + internals.sha1sum(httpOptsSignature);
    cachedResponse = Cache.get(requestSignature);

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
        rawTemplate = TemplateAssembler.getTemplateContentSync(templatePath);

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
    data.context.settings['cdn_url'] = '';
    data.context.settings['theme_version_id'] = 'theme';
    data.context.settings['theme_config_id'] = request.app.themeConfig.variationIndex + 1;

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
        statusCode: response.statusCode
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
        'Authorization': 'Basic ' + stencilToken.generate(internals.options.username, internals.options.token)
    };

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
    getTemplates: function (path, processor, callback) {
        TemplateAssembler.assemble(path, function (err, templates) {
            if (templates[path]) {
                // Check if the string includes frntmatter configutation
                // and remove it
                var match = templates[path].match(/---\r?\n[\S\s]*\r?\n---\r?\n([\S\s]*)$/);

                if (_.isObject(match) && match[1]) {
                    templates[path] = match[1];
                }
            }

            callback(null, processor(templates));
        });
    },
    getTranslations: function (callback) {
        LangAssembler.assemble(function (err, translations) {
            translations = _.mapValues(translations, function (locales, lang) {
                return JSON.parse(locales);
            });

            callback(null, translations);
        });
    }
};
