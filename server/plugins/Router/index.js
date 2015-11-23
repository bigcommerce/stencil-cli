var Hoek = require('hoek'),
    Path = require('path'),
    ThemeConfig = require('../../../lib/themeConfig'),
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
            cdnAssets: '/stencil/{versionId}/{configId}/{fileName*}',
            cssFiles: '/stencil/{versionId}/{configId}/css/{fileName}.css',
            favicon: '/favicon.ico',
            stencilEditor: '/stencil-editor',
            updateParam: '/stencil-editor/update-param'
        }
    };

module.exports.register = function(server, options, next) {
    internals.options = Hoek.applyToDefaults(internals.options, options);

    server.ext('onRequest', function(request, reply) {
        request.app.storeUrl = internals.options.storeUrl;
        request.app.normalStoreUrl = internals.options.normalStoreUrl;
        request.app.apiKey = internals.options.apiKey;
        request.app.staplerUrl = internals.options.staplerUrl;
        request.app.themeConfig = ThemeConfig.getInstance();
        request.app.customLayouts = internals.options.customLayouts;

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
                    parse: false,
                    maxBytes: 20971520 // 20MB
                },
                state: {
                    failAction: 'log'
                }
            },
            handler: server.plugins.Renderer.implementation
        },
        {
            method: 'GET',
            path: internals.paths.cdnAssets,
            handler: server.plugins.ThemeAssets.assetHandler,
            config: {
                state: {
                    failAction: 'log'
                }
            }
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
            handler: server.plugins.ThemeAssets.cssHandler,
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
