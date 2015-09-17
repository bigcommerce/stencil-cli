var Fs = require('fs'),
    Glob = require('glob'),
    Hoek = require('hoek'),
    Path = require('path'),
    ThemeConfig = require('../../../lib/themeConfig'),
    internals = {
        options: {
            themeConfigPath: Path.join(process.cwd(), 'config.json'),
            themeConfigSchemaPath: Path.join(process.cwd(), 'schema.json'),
            rootPath: Path.join(__dirname, '../../..'),
            stencilEditorFilePath: 'public/jspm_packages/github/bigcommerce-labs/ng-stencil-editor@master',
            patternLabFilePath: 'public/jspm_packages/github/bigcommerce-labs/bcapp-pattern-lab@1.7.1',
            themeVariationName: '',
            stencilServerPort: 0
        }
    };

module.exports.register = function (server, options, next) {
    internals.options = Hoek.applyToDefaults(internals.options, options);

    server.views({
        engines: {
            html: require('handlebars')
        },
        relativeTo: __dirname,
        path: './templates',
        layoutPath: './templates/layout',
        helpersPath: './templates/helpers'
    });

    server.route([
        {
            method: 'GET',
            path: '/',
            handler: function(request, reply) {
                reply.redirect('/ng-stencil-editor');
            }
        },
        {
            method: 'GET',
            path: '/ng-stencil-editor',
            handler: function(request, reply) {
                var pattern = Path.join(internals.options.stencilEditorFilePath, 'build/js/**/*.js');

                Glob(pattern, {cwd: internals.options.rootPath}, function(err, files) {
                    reply.view('index', {
                        jsFiles: files.map(function(file) {return '/' + file}),
                        storeUrl: 'http://localhost:' + internals.options.stencilServerPort + '?stencilEditor=true'
                    });
                });
            },
            config: {
                state: {
                    failAction: 'log'
                }
            }
        },
        {
            method: 'GET',
            path: '/public/{path*}',
            handler: {
                directory: {
                    path: Path.join(internals.options.rootPath, 'public')
                }
            },
            config: {
                state: {
                    failAction: 'log'
                }
            }
        },
        {
            method: 'POST',
            path: '/ng-stencil-editor/config',
            handler: internals.updateConfig,
            config: {
                state: {
                    failAction: 'log'
                },
                cors: true
            }
        },
        {
            method: 'GET',
            path: '/ng-stencil-editor/config',
            handler: internals.getConfig,
            config: {
                state: {
                    failAction: 'log'
                },
                cors: true
            }
        },
        {
            method: 'GET',
            path: '/ng-stencil-editor/config/variation-name',
            handler: internals.getVariationName,
            config: {
                state: {
                    failAction: 'log'
                },
                cors: true
            }
        },
        {
            method: 'POST',
            path: '/ng-stencil-editor/config/variation-name',
            handler: internals.setVariationName,
            config: {
                state: {
                    failAction: 'log'
                },
                cors: true
            }
        },
        {
            method: 'GET',
            path: '/ng-stencil-editor/schema',
            handler: internals.getConfigSchema,
            config: {
                state: {
                    failAction: 'log'
                },
                cors: true
            }
        }
    ]);

    return next();
};

/**
 * Endpoint to update a variations param value
 *
 * @param request
 * @param reply
 */
internals.updateConfig = function (request, reply) {
    var themeConfig = new ThemeConfig(internals.options.themeConfigPath, internals.options.themeConfigSchemaPath, internals.options.themeVariationName),
        response = {
            forceReload: themeConfig.updateConfig(request.payload).forceReload,
            stylesheets: []
        };

    if (! response.forceReload) {
        response.stylesheets.push('/assets/css/theme.css');
    }

    return reply(response);
};

internals.getConfig = function (request, reply) {
    var themeConfig = new ThemeConfig(internals.options.themeConfigPath, internals.options.themeConfigSchemaPath, internals.options.themeVariationName);

    reply(themeConfig.getConfig());
};

internals.getVariationName = function (request, reply) {
    var themeConfig = new ThemeConfig(internals.options.themeConfigPath, internals.options.themeConfigSchemaPath, internals.options.themeVariationName);

    reply(themeConfig.getConfig().variationName);
};

internals.getConfigSchema = function (request, reply) {
    var schema = require(internals.options.themeConfigSchemaPath);

    reply(schema);
};

internals.setVariationName = function(request, reply) {
    internals.options.themeVariationName = request.payload.name;

    reply({forceReload: true});
};

module.exports.register.attributes = {
    name: 'StencilEditor',
    version: '0.0.1'
};
