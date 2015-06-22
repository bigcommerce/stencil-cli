var Hoek = require('hoek'),
    Url = require('url'),
    internals = {
        options: {
            storeUrl: '',
            apiKey: '',
            staplerUrl: '',
            port: ''
        },
        paths: {
            renderer: '/{url*}',
            staticAssets: '/assets/{path*}',
            cssFiles: '/assets/css/{path*}',
            favicon: '/favicon.ico'
        }
    };

module.exports.register = function(server, options, next) {
    internals.options = Hoek.applyToDefaults(internals.options, options);

    server.ext('onRequest', function(request, reply) {
        var hostParts = request.headers.host.split(':'),
            browserSyncPort = internals.options.port - 1;

        request.app.storeUrl = internals.options.storeUrl;
        request.app.normalStoreUrl = internals.options.normalStoreUrl;
        request.app.apiKey = internals.options.apiKey;
        request.app.staplerUrl = internals.options.staplerUrl;
        request.app.themeConfig = internals.options.themeConfig.config;
        request.app.themeVariation = internals.options.themeConfig.variation;
        request.app.themeSettings = internals.options.themeConfig.settings;

        // Checks if using the non BrowserSync port to look at the store.
        // If so, redirect to correct port.
        if (hostParts[1] != browserSyncPort) {
            return reply.redirect(Url.format({
                protocol: 'http',
                hostname: hostParts[0],
                port: browserSyncPort,
                pathname: request.url.pathname
            }));
        }

        reply.continue();
    });

    server.dependency(['Renderer', 'CssCompiler'], internals.registerRoutes);
    return next();
};

internals.registerRoutes = function(server, next) {
    server.route([
        {
            method: 'GET',
            path: internals.paths.renderer,
            config: {
                cors: true,
                state: {
                    failAction: 'log'
                }
            },
            handler: server.plugins.Renderer.implementation
        },
        {
            method: ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            path: internals.paths.renderer,
            config: {
                cors: true,
                payload: {
                    output: 'stream',
                    parse: false
                },
                state: {
                    failAction: 'log'
                }
            },
            handler: server.plugins.Renderer.implementation
        },
        {
            method: 'GET',
            path: internals.paths.staticAssets,
            handler: {
                directory: {
                    path: './assets'
                }
            },
            config: {
                state: {
                    failAction: 'log'
                }
            }
        },
        {
            method: 'GET',
            path: internals.paths.favicon,
            handler: {
                file: './assets/favicon.ico'
            },
            config: {
                state: {
                    failAction: 'log'
                }
            }
        },
        {
            method: 'GET',
            path: internals.paths.cssFiles,
            handler: server.plugins.CssCompiler.implementation,
            config: {
                state: {
                    failAction: 'log'
                }
            }
        }
    ]);

    return next();
};

module.exports.register.attributes = {
    name: 'Router',
    version: '0.0.1'
};
