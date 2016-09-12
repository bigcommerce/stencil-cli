var Handlebars = require('handlebars');
var Hoek = require('hoek');
var Path = require('path');
var ThemeConfig = require('../../../lib/theme-config');
var handlers = {};
var internals = {
    options: {}
};
var themeConfig = ThemeConfig.getInstance();

module.exports.register = function (server, options, next) {
    var configurationId;
    var variationId;
    var routesConfig = {
        state: {
            parse: false // do not parse cookies
        }
    };

    internals.options = Hoek.applyToDefaults(internals.options, options);

    server.views({
        engines: {
            html: Handlebars
        },
        relativeTo: __dirname,
        path: './'
    });

    // On Request event handler to add the SDK to the footer
    options.themeServer.ext('onRequest', handlers.onRequest);

    // When using stencil-cli variationId = configurationId
    configurationId = themeConfig.variationIndex + 1;
    variationId = themeConfig.variationIndex + 1;

    server.route([
        {
            method: 'GET',
            path: '/',
            config: routesConfig,
            handler: function(request, reply) {
                reply.redirect('/theme-editor/theme/' + variationId + '/' + configurationId);
            }
        },
        {
            method: 'GET',
            path: '/admin/remote.php',
            config: routesConfig,
            handler: function(request, reply) {
                reply({
                    status: 'ALIVE'
                });
            }
        },
        {
            method: 'GET',
            path: '/admin/events/stencil',
            config: routesConfig,
            handler: function(request, reply) {
                reply().code(204);
            }
        },
        {
            method: 'GET',
            path: '/theme-editor/{versionId}/{variationId}/{configurationId}',
            config: routesConfig,
            handler: function(request, reply) {
                handlers.home(request, reply);
            }
        },
        {
            method: 'GET',
            path: '/{path*}',
            config: routesConfig,
            handler: {
                directory: {
                    path: Path.join(__dirname, './public')
                }
            }
        },
        {
            method: 'GET',
            path: '/meta/{path*}',
            config: routesConfig,
            handler: {
                directory: {
                    path: Path.join(process.cwd(), 'meta')
                }
            }
        },
        {
            method: 'GET',
            path: '/api/themeeditor/variations/{variationId}',
            config: routesConfig,
            handler: require('./api/getVariations')(internals.options, themeConfig)
        },
        {
            method: 'GET',
            path: '/api/themeeditor/configurations/{configurationId}',
            config: routesConfig,
            handler: require('./api/getConfigurations')(internals.options, themeConfig)
        },
        {
            method: 'POST',
            path: '/api/themeeditor/configurations',
            config: routesConfig,
            handler: require('./api/postConfigurations')(internals.options, themeConfig)
        },
        {
            method: 'GET',
            path: '/api/themeeditor/versions/{versionId}',
            config: routesConfig,
            handler: require('./api/getVersions')(internals.options, themeConfig)
        },
        {
            method: 'GET',
            path: '/api/marketplace/variations/{variationId}/history',
            config: routesConfig,
            handler: function(request, reply) {
                reply().code(200);
            }
        },
    ]);

    return next();
};

/**
 * Adds the SDK script to the iframe
 *
 * @param request
 * @param reply
 */
handlers.onRequest = function(request, reply) {
    request.app.decorators = request.app.decorators || [];

    // Only add the SDK if stencilEditor is a query parameter or the cookie preview_config_id is set
    if (request.query.stencilEditor || (request.headers.cookie || '').indexOf('stencil_preview') !== -1) {
        request.app.decorators.push(function (content) {
            var scriptTags = '<script src="' + '//localhost:' + internals.options.stencilEditorPort + '/dist/sdk.js"></script>\n';
            return content.replace(new RegExp('</body>'), scriptTags + '\n</body>');
        });
    }

    reply.continue();
};

/**
 * Render main page that boots up stencil-editor
 *
 * @param request
 * @param reply
 */
handlers.home = function(request, reply) {
    var shopPath = 'http://localhost:' + internals.options.stencilServerPort;
    var cdnPath = '//localhost:' + internals.options.stencilEditorPort;

    reply.view('stencil-editor', {
        shopPath: shopPath,
        cdnPath: cdnPath,
        themeName: themeConfig.getName(),
        variationName: themeConfig.getVariationName(),
        displayVersion: themeConfig.getVersion()
    });
};

module.exports.register.attributes = {
    name: 'stencil-editor',
    version: '0.0.1'
};
