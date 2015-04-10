var Hoek = require('hoek'),
    internals = {
        options: {
            storeUrl: '',
            apiKey: ''
        },
        paths: {
            renderer: '/{url*}',
            proxy: '/__proxy__/{url*}',
            staticAssets: '/assets/{path*}',
            favicon: '/favicon.ico'
        }
    };

module.exports.register = function(server, options, next) {
    internals.options = Hoek.applyToDefaults(internals.options, options);

    server.ext('onRequest', function(request, reply) {
        request.app.storeUrl = internals.options.storeUrl;
        request.app.apiKey = internals.options.apiKey;

        if (request.method !== 'get' || request.url.path.indexOf('/checkout.php') === 0) {
            request.setUrl('/__proxy__' + request.url.path);
        }

        reply.continue();
    });

    server.route([
        {
            method: 'GET',
            path: internals.paths.renderer,
            config: {
                cors: true
            },
            handler: server.plugins.Renderer.implementation
        },
        {
            method: ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            path: internals.paths.proxy,
            config: {
                cors: true,
                payload: {
                    parse: false
                }
            },
            handler: server.plugins.Proxy.implementation
        },
        {
            method: 'GET',
            path: internals.paths.proxy,
            config: {
                cors: true
            },
            handler: server.plugins.Proxy.implementation
        },
        {
            method: 'GET',
            path: internals.paths.staticAssets,
            handler: {
                directory: {
                    path: 'assets'
                }
            }
        },
        {
            method: 'GET',
            path: internals.paths.favicon,
            handler: {
                file: './assets/favicon.ico'
            }
        }
    ]);

    next();
};

module.exports.register.attributes = {
    name: 'Router',
    version: '0.0.1'
};
