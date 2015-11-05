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
        }
    };

module.exports.register = function (server, options, next) {
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

    server.route([
        {
            method: 'GET',
            path: '/',
            handler: function(request, reply) {
                reply.redirect('/ng-stencil-editor/theme/1/1');
            }
        },
        {
            method: 'GET',
            path: '/ng-stencil-editor/{versionId}/{variationId}/{configId}',
            handler: handlers.home
        },
        {
            method: 'GET',
            path: '/public/{path*}',
            handler: {
                directory: {
                    path: internals.options.publicPath
                }
            }
        },
        {
            method: 'GET',
            path: '/meta/{path*}',
            handler: {
                directory: {
                    path: internals.options.metaPath
                }
            }
        },
        {
            method: 'GET',
            path: internals.options.basePath + '/variations/{variationId}',
            handler: require('./api/getVariations')(internals.options, internals.themeConfig)
        },
        {
            method: 'GET',
            path: internals.options.basePath + '/configurations/{configurationId}',
            handler: require('./api/getConfigurations')(internals.options, internals.themeConfig)
        },
        {
            method: 'POST',
            path: internals.options.basePath + '/configurations',
            handler: require('./api/postConfigurations')(internals.options, internals.themeConfig)
        },
        {
            method: 'GET',
            path: internals.options.basePath + '/versions/{versionId}',
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
            storeUrl: internals.stencilThemeHost + '?stencilEditor=stencil-cli'
        });
    });
};

/**
 * Returns the asset files for the template
 *
 * @param callback
 */
internals.getAssets = function (callback) {
    var pattern = internals.buildDirectoryExists()
        ? 'build'
        : 'dist';

    pattern = Path.join(internals.getStencilEditorPath(), pattern + '/**/*.{js,css}');

    Glob(pattern, {cwd: internals.options.publicPath}, function(err, files) {
        var assets = {};

        if (err) {
            callback(err);
        }

        files = files.map(function(file) {return '/public/' + file});

        assets.cssFiles = files.filter(function (file) {
            return file.substr(-4) === '.css';
        });

        assets.jsFiles = files.filter(function (file) {
            return file.substr(-3) === '.js';
        });
        
        callback(null, assets);
    });
};

/**
 * Returns true if the build directory exists
 *
 * @param callback
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
 * @param callback
 */
internals.getStencilEditorPath = function (path) {
    var basePath = 'jspm_packages/github/bigcommerce-labs/ng-stencil-editor@';
    var version = PackageJson.jspm.dependencies['bigcommerce-labs/ng-stencil-editor'].split('@')[1];

    return basePath + version;
};

module.exports.register.attributes = {
    name: 'StencilEditor',
    version: '0.0.1'
};
