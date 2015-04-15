var _ = require('lodash'),
    Boom = require('boom'),
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
    var proxyUrl = Url.resolve(request.app.storeUrl, request.params.url),
        proxyConfiguration = {
            passThrough: true,
            localStatePassThrough: true,
            redirects: false,
            rejectUnauthorized: false,
            onResponse: function (err, res, request, reply) {
                var replyResponse,
                    referer,
                    cookies = [],
                    rewritePath,
                    protocol;

                if (err) {
                    return reply(Boom.wrap(err));
                }

                replyResponse = reply(res);

                // hack off the domain from the cookies so they are set in the browser attached wo whatever the client
                // is using currently
                _.each(res.headers['set-cookie'], function(cookie) {
                    cookies.push(cookie.replace(/(?:;\s)?domain=(?:.+?)(;|$)/, '$1'));
                });

                replyResponse.header('set-cookie', cookies);
                replyResponse.statusCode = res.statusCode;

                //if we are in development mode and redirecting, rewrite the redirect to match our referring host
                if (res.headers.location) {
                    protocol = request.headers['x-forwarded-proto'] || 'http';

                    referer = Url.parse(protocol + '://' + request.headers.host);
                    rewritePath = Url.parse(res.headers.location).path;

                    replyResponse.header('location', referer.protocol + '//' + referer.host + rewritePath);
                }
            },
            mapUri: function(request, callback) {
                callback(null, proxyUrl);
            }
        };

    reply.proxy(proxyConfiguration);
};
