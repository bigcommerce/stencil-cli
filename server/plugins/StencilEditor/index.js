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
            themeConfigPath: Path.join(process.cwd(), 'config.json'),
            themeConfigSchemaPath: Path.join(process.cwd(), 'schema.json'),
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
                reply.redirect('/ng-stencil-editor');
            }
        },
        {
            method: 'GET',
            path: '/ng-stencil-editor',
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
            method: 'POST',
            path: '/ng-stencil-editor/config',
            handler: handlers.updateConfig
        },
        {
            method: 'GET',
            path: '/ng-stencil-editor/config',
            handler: handlers.getConfig
        },
        {
            method: 'GET',
            path: '/ng-stencil-editor/config/variation-name',
            handler: handlers.getVariationName
        },
        {
            method: 'POST',
            path: '/ng-stencil-editor/config/variation-name',
            handler: handlers.setVariationName
        },
        {
            method: 'GET',
            path: '/ng-stencil-editor/schema',
            handler: handlers.getConfigSchema
        },
        {
            method: 'GET',
            path: '/api/versions/{id}',
            handler: require('./api/versions')(internals.options, internals.themeConfig)
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

/**
 * Endpoint to update a variations param value
 *
 * @param request
 * @param reply
 */
handlers.updateConfig = function (request, reply) {
    var saveToFile = !!request.query.commit,
        response = {
            forceReload: internals.themeConfig.updateConfig(request.payload, saveToFile).forceReload,
            stylesheets: []
        },
        compilerExtension,
        styleFiles,
        files;

    if (! response.forceReload) {
        files = Fs.readdirSync(internals.options.themeStylesPath);
        compilerExtension = '.' + internals.themeConfig.getConfig().css_compiler;

        styleFiles = _.filter(files, function(file) {
            var fileExt = Path.extname(file);

            return fileExt === '.css' || fileExt === compilerExtension;
        });

        response.stylesheets = _.map(styleFiles, function(file) {
            file = file.substring(0, file.lastIndexOf('.')) + '.css';

            return '/assets/css/' + file;
        });
    }

    return reply(response);
};

/**
 * Get the theme schema.json
 * @param  {Object} request
 * @param  {Object} reply
 * @deprecated replaced by GET/api/versions/{id}
 */
handlers.getConfigSchema = function (request, reply) {
    var schema = require(internals.options.themeConfigSchemaPath);

    reply(schema);
};

handlers.getConfig = function (request, reply) {
    var configiration = internals.themeConfig.getConfig();
    
    if (!_.isArray(configiration.variations)) {
        return;
    }

    // Add absolute path to the preview images
    _.each(configiration.variations, function(variation) {
        variation.meta = variation.meta || {};

        variation.meta.screenshot = {
            smallThumb: Url.resolve(internals.options.themeEditorHost, Path.join('meta', variation.meta.desktop_screenshot))
        };
    });

    reply(configiration);
};

handlers.getVariationName = function (request, reply) {
    reply(internals.themeConfig.getConfig().variationName);
};

handlers.setVariationName = function(request, reply) {
    internals.themeConfig.setVariationName(request.payload.name);

    reply({forceReload: true});
};

module.exports.register.attributes = {
    name: 'StencilEditor',
    version: '0.0.1'
};
