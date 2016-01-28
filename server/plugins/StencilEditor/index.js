var _ = require('lodash'),
    Fs = require('fs'),
    Glob = require('glob'),
    Hoek = require('hoek'),
    Path = require('path'),
    Async = require('async'),
    Url = require('url'),
    ThemeConfig = require('../../../lib/themeConfig'),
    PackageJson = require('../../../package.json'),
    handlers = {},
    internals = {
        options: {
            basePath: '/api',
            themeConfigPath: Path.join(process.cwd(), 'config.json'),
            themeSchemaPath: Path.join(process.cwd(), 'schema.json'),
            themeStylesPath: Path.join(process.cwd(), 'assets/scss'),
            themeTemplatesPath: Path.join(process.cwd(), 'templates'),
            publicPath: Path.join(__dirname, '../../../public'),
            metaPath: Path.join(process.cwd(), 'meta'),
            stencilThemeHost: ''
        },
        routesConfig: {
            state: {
                parse: false // do not parse cookies
            }
        }
    };

module.exports.register = function (server, options, next) {
    var variationId;

    internals.options = Hoek.applyToDefaults(internals.options, options);

    internals.themeConfig = ThemeConfig.getInstance();

    internals.stencilThemeHost = 'http://localhost:' + internals.options.stencilServerPort;

    server.views({
        engines: {
            html: require('handlebars')
        },
        relativeTo: __dirname,
        path: './templates',
        layoutPath: './templates/layout',
        helpersPath: './templates/helpers'
    });

    // On Request event handler to add the SDK to the footer
    options.themeServer.ext('onRequest', function(request, reply) {
        request.app.decorators = request.app.decorators || [];

        // Only add the SDK if stencilEditor is a query parameter or the cookie preview_config_id is set
        if (request.query.stencilEditor || (request.headers.cookie || '').indexOf('stencil_preview') !== -1) {
            request.app.decorators.push(internals.sdkDecorator);
        }

        reply.continue();
    });

    // When using stencil-cli variationId = configurationId
    variationId = internals.themeConfig.variationIndex + 1;

    server.route([
        {
            method: 'GET',
            path: '/',
            config: internals.routesConfig,
            handler: function(request, reply) {
                reply.redirect('/theme-editor/theme/' + variationId);
            }
        },
        {
            method: 'GET',
            path: '/admin/remote.php',
            config: internals.routesConfig,
            handler: function(request, reply) {
                reply({
                    status: 'ALIVE'
                });
            }
        },
        {
            method: 'GET',
            path: '/theme-editor/{versionId}/{variationId}',
            config: internals.routesConfig,
            handler: handlers.home
        },
        {
            method: 'GET',
            path: '/public/{path*}',
            config: internals.routesConfig,
            handler: {
                directory: {
                    path: internals.options.publicPath
                }
            }
        },
        {
            method: 'GET',
            path: '/meta/{path*}',
            config: internals.routesConfig,
            handler: {
                directory: {
                    path: internals.options.metaPath
                }
            }
        },
        {
            method: 'GET',
            path: internals.options.basePath + '/variations/{variationId}',
            config: internals.routesConfig,
            handler: require('./api/getVariations')(internals.options, internals.themeConfig)
        },
        {
            method: 'GET',
            path: internals.options.basePath + '/configurations/{configurationId}',
            config: internals.routesConfig,
            handler: require('./api/getConfigurations')(internals.options, internals.themeConfig)
        },
        {
            method: 'POST',
            path: internals.options.basePath + '/configurations',
            config: internals.routesConfig,
            handler: require('./api/postConfigurations')(internals.options, internals.themeConfig)
        },
        {
            method: 'GET',
            path: internals.options.basePath + '/versions/{versionId}',
            config: internals.routesConfig,
            handler: require('./api/getVersions')(internals.options, internals.themeConfig)
        }
    ]);

    return next();
};

/**
 * Render main page that boots up stencil-editor
 *
 * @param request
 * @param reply
 */
handlers.home = function(request, reply) {
    internals.getAssets(function (err, assets) {
        if (err) {
            reply(err);
        }

        reply.view('index', {
            basePath: internals.options.basePath,
            cssFiles: assets.cssFiles,
            jsFiles: assets.jsFiles,
            shopPath: internals.stencilThemeHost,
            svgPath: '/public/jspm_packages/github/bigcommerce-labs/bcapp-pattern-lab@1.17.6/dist/svg/icons/'
        });
    });
};

/**
 * Returns the asset files for the template
 *
 * @param callback
 */
internals.getAssets = function (callback) {
    var assets = {};
    var pattern = internals.buildDirectoryExists()
        ? 'build'
        : 'dist';

    jsPattern = Path.join(internals.getStencilEditorPath(), pattern + '/js/**/*.js');
    cssPattern = Path.join(internals.getStencilEditorPath(), pattern + '/css/**/*.css');

    Glob(jsPattern, {cwd: internals.options.publicPath}, function(err, files) {
        if (err) {
            callback(err);
        }

        assets.jsFiles = files.map(function(file) {return '/public/' + file});

        Glob(cssPattern, {cwd: internals.options.publicPath}, function(err, files) {
            if (err) {
                callback(err);
            }

            assets.cssFiles = files.map(function(file) {return '/public/' + file});

            callback(null, assets);
        });
    });
};

/**
 * Returns true if the build directory exists
 *
 */
internals.buildDirectoryExists = function () {
    var path = Path.join(internals.options.publicPath, internals.getStencilEditorPath(), 'build');
    try {
        // Is it a directory?
        return Fs.statSync(path).isDirectory();
    }
    catch (e) {
        return false;
    }
};

/**
 * Returns stencil-editor path relative to the public path
 *
 * @param path
 */
internals.getStencilEditorPath = function (path) {
    var basePath = 'jspm_packages/github/bigcommerce-labs/ng-stencil-editor@';
    var version = PackageJson.jspm.dependencies['bigcommerce-labs/ng-stencil-editor'].split('@')[1];

    return basePath + version;
};

/**
 * Pencil response decorator for adding the SDK scripts to the footer
 *
 * @param content
 */
internals.sdkDecorator = function (content) {
    var scriptTags = '';
    var publicUrl = 'http://localhost:' + internals.options.stencilEditorPort + '/public/';
    var sdkPath = internals.buildDirectoryExists()
        ? 'build/sdk/sdk-stencil-editor.js'
        : 'dist/sdk/sdk-stencil-editor.js';

    scriptTags = '<script src="' + publicUrl + 'jspm_packages/github/meenie/jschannel@0.0.5/src/jschannel.js"></script>\n';
    scriptTags += '<script src="' + publicUrl + 'jspm_packages/github/js-cookie/js-cookie@2.0.3/src/js.cookie.js"></script>\n';
    scriptTags += '<script src="' + publicUrl  + internals.getStencilEditorPath() + '/' + sdkPath + '"></script>\n';

    content = content.replace(new RegExp('</body>'), scriptTags + '\n</body>');

    return content;
};

module.exports.register.attributes = {
    name: 'StencilEditor',
    version: '0.0.1'
};
