var _ = require('lodash'),
    Async = require('async'),
    Boom = require('boom'),
    Frontmatter = require('front-matter'),
    Hoek = require('hoek'),
    LangAssembler = require('../../../lib/langAssembler'),
    Pkg = require('../../../package.json'),
    Responses = require('./responses'),
    TemplateAssembler = require('../../../lib/templateAssembler'),
    Url = require('url'),
    Utils = require('../../lib/utils'),
    Wreck = require('wreck'),
    internals = {
        options: {}
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

        response.respond(request, reply);
    });
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
        themeConfig = request.app.themeConfig.getConfig(),
        httpOpts = {
            rejectUnauthorized: false,
            headers: internals.getHeaders(request, {get_template_file: true, get_data_only: true}),
            payload: request.payload
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

    url = Url.format({
        protocol: staplerUrlObject.protocol,
        host: staplerUrlObject.host,
        pathname: urlObject.pathname,
        query: urlObject.query
    });

    Wreck.request(request.method, url, httpOpts, function (err, response) {
        if (err) {
            return callback(err);
        }

        if (response.statusCode === 500) {
            return callback(new Error('The Bigcommerce server responded with a 500 error'));
        }

        if (response.headers['set-cookie']) {
            response.headers['set-cookie'] = Utils.stripDomainFromCookies(response.headers['set-cookie']);
        }

        // Response is a redirect
        if (response.statusCode >= 301 && response.statusCode <= 303) {
            return internals.redirect(response, request, callback);
        }

        Wreck.read(response, {json: true}, function (err, bcAppData) {
            var resourcesConfig;

            if (err) {
                return callback(err);
            }

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

                callback(null, internals.getPencilResponse(bcAppData, request, response, themeConfig));

            } else {

                resourcesConfig = internals.getResourceConfig(bcAppData, request, themeConfig);

                httpOpts.headers = internals.getHeaders(request, {get_data_only: true}, resourcesConfig);
                // Set host to stapler host
                httpOpts.headers.host = staplerUrlObject.host;
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
                        return callback(new Error('The Bigcommerce server responded with a 500 error'));
                    }

                    try {
                        data = JSON.parse(data);
                    } catch (e) {
                        return callback(e);
                    }

                    // Data response is bad
                    if (data.statusCode && data.statusCode === 500) {
                        return callback(new Error('The Bigcommerce server responded with a 500 error'));
                    }

                    callback(null, internals.getPencilResponse(data, request, response, themeConfig));
                });
            }
        });
    });
};

/**
 * Get the resource configuration (front-matter) from the main template
 * or from the header stencil-config for ajax requests
 * @param  {Object} data
 * @param  {Object} request
 * @param  {Object} themeConfig
 * @return {Object}
 */
internals.getResourceConfig = function(data, request, themeConfig) {
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
            _.forOwn(themeConfig.settings, function (val, key) {
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
        if (_.isObject(themeConfig.resources)) {
            resourcesConfig = _.extend({}, themeConfig.resources, resourcesConfig);
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
    if (! response.headers.location) {
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
 * Creates a new Pencil Response object and returns it.
 *
 * @param data
 * @param request
 * @param response
 * @returns {*}
 */
internals.getPencilResponse = function (data, request, response, themeConfig) {
    data.context.theme_settings = themeConfig.settings;
    data.context.theme_images = themeConfig.images;

    return new Responses.PencilResponse({
       template_file: data.template_file,
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
    if (! request.headers['stencil-config'] && config) {
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
        'accept-encoding': 'identity'
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
            translations = _.mapValues(translations, function(locales, lang) {
                return JSON.parse(locales);
            })

            callback(null, translations);
        });
    }
};
