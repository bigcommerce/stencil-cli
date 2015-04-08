var _ = require('lodash'),
    Boom = require('boom'),
    Hoek = require('hoek'),
    Url = require('url'),
    internals = {
        options: {
            storeUrl: '',
            apiKey: ''
        }
    };

module.exports.register = function(server, options, next) {
    var proxyPath = '/__proxy__/{url*}';

    internals.options = Hoek.applyToDefaults(internals.options, options);

    server.route({
        method: ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        path: proxyPath,
        config: {
            cors: true,
            payload: {
                parse: false
            }
        },
        handler: internals.implementation
    });

    server.route({
        method: 'GET',
        path: proxyPath,
        config: {
            cors: true
        },
        handler: internals.implementation
    });

    next();
};

module.exports.register.attributes = {
    name: 'proxy',
    version: '0.0.1'
};

internals.implementation = function(request, reply) {
    var proxyUrl = Url.resolve(internals.options.storeUrl + '/', request.params.url),
        proxyConfiguration = {
            passThrough: true,
            localStatePassThrough: true,
            redirects: false,
            rejectUnauthorized: false,
            onResponse: function (err, res, request, reply) {
                var replyResponse,
                    referer,
                    cookies = [],
                    rewritePath;

                if (err) {
                    return reply(Boom.wrap(err));
                }

                replyResponse = reply(res);

                // hack off the domain from the cookies so they are set in the browser attached wo whatever the client
                // is using currently
                _.each(res.headers['set-cookie'], function(cookie) {
                    cookies.push(cookie.replace(/domain=(.+);?/, ''));
                });

                replyResponse.header('set-cookie', cookies);

                //if we are in development mode and redirecting, rewrite the redirect to match our referring host
                if (res.headers.location) {
                    var protocol = request.headers['x-forwarded-proto'] || 'http';

                    referer = Url.parse(protocol + '://' + request.headers.host);
                    rewritePath = Url.parse(res.headers.location).path;

                    if (rewritePath.charAt(0) !== '/') {
                        rewritePath = '/' + rewritePath;
                    }

                    replyResponse.header('location', referer.protocol + '//' + referer.host + rewritePath);
                }
            },
            mapUri: function(request, callback) {
                callback(null, proxyUrl);
            }
        };

    reply.proxy(proxyConfiguration);
};
