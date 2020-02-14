const Hoek = require('hoek');
const ThemeConfig = require('../../../lib/theme-config');
const internals = {
    options: {
            storeUrl: '',
            apiKey: '',
            staplerUrl: '',
            port: '',
    },
    paths: {
        renderer: '/{url*}',
        staticAssets: '/assets/{path*}',
        internalApi: '/internalapi/{path*}',
        storefrontAPI: '/api/storefront/{path*}',
        cdnAssets: '/stencil/{versionId}/{fileName*}',
        cssFiles: '/stencil/{versionId}/css/{fileName}.css',
        favicon: '/favicon.ico',
        graphQL: '/graphql',
    },
};

module.exports.register = function(server, options, next) {
    internals.options = Hoek.applyToDefaults(internals.options, options);

    server.ext('onRequest', function(request, reply) {
        request.app.storeUrl = internals.options.storeUrl;
        request.app.normalStoreUrl = internals.options.normalStoreUrl;
        request.app.apiKey = internals.options.apiKey;
        request.app.staplerUrl = internals.options.staplerUrl;
        request.app.themeConfig = ThemeConfig.getInstance();

        reply.continue();
    });

    server.dependency(['Renderer', 'ThemeAssets'], internals.registerRoutes);
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
                    failAction: 'log',
                },
            },
            handler: server.plugins.Renderer.implementation,
        },
        {
            method: ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            path: internals.paths.renderer,
            config: {
                cors: true,
                payload: {
                    output: 'stream',
                    parse: false,
                    maxBytes: 20971520, // 20MB
                },
                state: {
                    failAction: 'log',
                },
            },
            handler: server.plugins.Renderer.implementation,
        },
        {
            method: 'GET',
            path: internals.paths.cdnAssets,
            handler: server.plugins.ThemeAssets.assetHandler,
            config: {
                state: {
                    failAction: 'log',
                },
            },
        },
        {
            method: 'GET',
            path: internals.paths.staticAssets,
            handler: {
                directory: {
                    path: './assets',
                },
            },
            config: {
                state: {
                    failAction: 'log',
                },
            },
        },
        {
            method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            path: internals.paths.internalApi,
            handler: {
                proxy: {
                    host: internals.options.storeUrl.replace(/http[s]?:\/\//, ''),
                    rejectUnauthorized: false,
                    protocol: 'https',
                    port: 443,
                    passThrough: true,
                    xforward: true,
                },
            },
            config: {
                state: {
                    failAction: 'log',
                },
            },
        },
        {
            method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            path: internals.paths.storefrontAPI,
            handler: {
                proxy: {
                    host: internals.options.storeUrl.replace(/http[s]?:\/\//, ''),
                    rejectUnauthorized: false,
                    protocol: 'https',
                    port: 443,
                    passThrough: true,
                    xforward: true,
                },
            },
            config: {
                state: {
                    failAction: 'log',
                },
            },
        },
        {
            method: 'GET',
            path: internals.paths.favicon,
            handler: {
                file: './assets/favicon.ico',
            },
            config: {
                state: {
                    failAction: 'log',
                },
            },
        },
        {
            method: 'GET',
            path: internals.paths.cssFiles,
            handler: server.plugins.ThemeAssets.cssHandler,
            config: {
                state: {
                    failAction: 'log',
                },
            },
        },
        {
            method: ['GET', 'POST'],
            path: internals.paths.graphQL,
            handler: {
                proxy: {
                    mapUri: function (req, cb) {
                        return cb(
                            null,
                            `${internals.options.storeUrl}${req.path}`,
                            Object.assign( // Add 'origin' and 'host' headers to request before proxying
                                req.headers,
                                {
                                    origin: internals.options.storeUrl,
                                    host: internals.options.storeUrl.replace(/http[s]?:\/\//, ''),
                                },
                            ),
                        );
                    },
                    passThrough: true,
                },
            },
            config: {
                state: {
                    failAction: 'log',
                },
            },
        },
    ]);

    return next();
};

module.exports.register.attributes = {
    name: 'Router',
    version: '0.0.1',
};
