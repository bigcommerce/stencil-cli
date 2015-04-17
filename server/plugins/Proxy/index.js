var Boom = require('boom'),
    Utils = require('../../lib/utils'),
    Hoek = require('hoek'),
    Url = require('url'),
    internals = {
        options: {}
    };

module.exports.register = function(server, options, next) {
    internals.options = Hoek.applyToDefaults(internals.options, options);

    server.expose('implementation', internals.implementation);

    next();
};

module.exports.register.attributes = {
    name: 'Proxy',
    version: '0.0.1'
};

internals.implementation = function(request, reply) {
    var proxyUrl = Url.resolve(request.app.storeUrl, request.params.url) + request.url.search,
        proxyConfiguration = {
            passThrough: true,
            localStatePassThrough: true,
            redirects: false,
            rejectUnauthorized: false,
            onResponse: function (err, response, request, reply) {
                var replyResponse,
                    redirectUrl;

                if (err) {
                    return reply(Boom.wrap(err));
                }

                if (response.headers.location) {
                    redirectUrl = Utils.normalizeRedirectUrl(request, response.headers.location);
                    replyResponse = reply.redirect(redirectUrl);
                } else {
                    replyResponse = reply(response);
                }

                if (response.headers['set-cookie']) {
                    replyResponse.header('set-cookie', Utils.stripDomainFromCookies(response.headers['set-cookie']));
                }

                replyResponse.code(response.statusCode);
            },
            mapUri: function(request, callback) {
                callback(null, proxyUrl);
            }
        };

    reply.proxy(proxyConfiguration);
};
