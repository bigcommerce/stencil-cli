var _ = require('lodash'),
    Async = require('async'),
    Boom = require('boom'),
    Hoek = require('hoek'),
    Paper = require('stencil-paper'),
    Url = require('url'),
    Wreck = require('wreck'),
    internals = {
        options: {
            storeUrl: '',
            apiKey: ''
        }
    };

module.exports.register = function(server, options, next) {
    internals.options = Hoek.applyToDefaults(internals.options, options);

    server.ext('onRequest', function(request, reply) {
        if (request.method !== 'get' || request.url.path.indexOf('/checkout.php') === 0) {
            request.setUrl('/__proxy__' + request.url.path);
        }

        reply.continue();
    });

    server.route({
        method: 'GET',
        path: '/{url*}',
        handler: internals.implementation,
        config: {
            cors: true
        }
    });

    next();
};

module.exports.register.attributes = {
    name: 'router',
    version: '0.0.1'
};

internals.implementation = function (request, reply) {
    internals.fetchData(request, {get_template_file: true}, function (err, response) {
        var redirectPath,
            redirectUrl,
            templateName,
            replyResponse,
            cookies;

        if (err) {
            return reply(Boom.wrap(err));
        }

        if (response.redirect) {
            redirectPath = Url.parse(response.redirect).path;

            if (redirectPath.charAt(0) !== '/') {
                redirectPath = '/' + redirectPath;
            }

            redirectUrl = request.server.info.uri + redirectPath;

            replyResponse = reply.redirect(redirectUrl);

            cookies = internals.fixCookies(replyResponse, response.headers['set-cookie']);
            replyResponse.header('set-cookie', cookies);
            replyResponse.statusCode = response.statusCode;

        } else if (response.rawData) {
            replyResponse = reply(response.rawData);

            cookies = internals.fixCookies(replyResponse, response.headers['set-cookie']);
            replyResponse.header('set-cookie', cookies);
        } else {
            templateName = response.template_file;

            request.server.methods.assembler(templateName, function(err, templateData) {
                internals.fetchData(request, templateData.config, function (err, response) {
                    if (err) {
                        return reply(Boom.wrap(err));
                    }

                    replyResponse = reply(Paper.compile(templateName, templateData.templates, response.context));

                    cookies = internals.fixCookies(replyResponse, response.headers['set-cookie']);
                    replyResponse.header('set-cookie', cookies);

                    return replyResponse;
                });
            });
        }
    });
};

/**
 * Fetches data from Stapler
 *
 * @param request
 * @param config
 * @param callback
 */
internals.fetchData = function (request, config, callback) {
    var url = Url.resolve(internals.options.storeUrl + '/', request.params.url ? request.params.url : ''),
        httpOpts = {
            rejectUnauthorized: false,
            headers: internals.getHeaders(request, config)
        };

    callback = Hoek.nextTick(callback);

    Wreck.request('GET', url, httpOpts, function (err, response) {
        if (err) {
            return callback(err);
        }

        if (response.statusCode == 301 || response.statusCode == 302 || response.statusCode == 303) {
            return callback(null, {
                redirect: response.headers.location,
                statusCode: response.statusCode
            });
        }

        Wreck.read(response, {json: true}, function (err, data) {

            if (err) {
                return callback(err);
            }

            if (! data.template_file) {
                return callback(null, {
                    rawData: data,
                    headers: response.headers
                })
            }

            callback(null, {
                template_file: data.template_file,
                headers: response.headers,
                context: data.context
            });
        });
    });
};

/**
 * Generate and return headers
 *
 * @param request
 * @param config
 */
internals.getHeaders = function (request, config) {
    var headers = {
        'SFP-THEME-ENGINE': '2.0',
        'SFP-THEME-CONFIG': JSON.stringify(config)
    };

    if (request.headers.cookie) {
        headers.cookie = request.headers.cookie;
    }

    return headers;
};

/**
 * Strip domain from cookies so they will work locally
 *
 * @param replyResponse
 * @param cookies
 */
internals.fixCookies = function(replyResponse, cookies) {
    var fixedCookies = [];

    _.each(cookies, function(cookie) {
        fixedCookies.push(cookie.replace(/domain=(.+);?/, ''));
    });

    return fixedCookies;
};
