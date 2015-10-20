var _ = require('lodash'),
    Fs = require('fs'),
    Glob = require('glob'),
    Hoek = require('hoek'),
    Path = require('path'),
    ThemeConfig = require('../../../lib/themeConfig'),
    packageJson = require('../../../package.json'),
    internals = {
        options: {
            themeConfigPath: Path.join(process.cwd(), 'config.json'),
            themeConfigSchemaPath: Path.join(process.cwd(), 'schema.json'),
            themeStyles: Path.join(process.cwd(), 'assets/scss'),
            publicPath: Path.join(__dirname, '../../../public'),
            themeVariationName: '',
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
            handler: internals.home
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
            method: 'POST',
            path: '/ng-stencil-editor/config',
            handler: internals.updateConfig
        },
        {
            method: 'GET',
            path: '/ng-stencil-editor/config',
            handler: internals.getConfig
        },
        {
            method: 'GET',
            path: '/ng-stencil-editor/config/variation-name',
            handler: internals.getVariationName
        },
        {
            method: 'POST',
            path: '/ng-stencil-editor/config/variation-name',
            handler: internals.setVariationName
        },
        {
            method: 'GET',
            path: '/ng-stencil-editor/schema',
            handler: internals.getConfigSchema
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
internals.home = function(request, reply) {
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
    var version = packageJson.jspm.dependencies['bigcommerce-labs/ng-stencil-editor'].split('@')[1];

    return basePath + version;
};

/**
 * Endpoint to update a variations param value
 *
 * @param request
 * @param reply
 */
internals.updateConfig = function (request, reply) {
    var saveToFile = !!request.query.commit,
        response = {
            forceReload: internals.themeConfig.updateConfig(request.payload, saveToFile).forceReload,
            stylesheets: []
        },
        compilerExtension,
        styleFiles,
        files;

    if (! response.forceReload) {
        files = Fs.readdirSync(internals.options.themeStyles);
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

internals.getConfig = function (request, reply) {
    var configiration = internals.themeConfig.getConfig();
    var variations = configiration.variations || {};

    // Add absolute path to the preview images
    _.each(variations, function(variation) {
        var meta = variation.meta || {};
        var screenshot = meta.screenshot || {};

        screenshot.smallThumb = internals.stencilThemeHost + '/' + screenshot.smallThumb;
        variation.meta = meta;
    });

    configiration.variations = variations;

    reply(configiration);
};

internals.getVariationName = function (request, reply) {
    reply(internals.themeConfig.getConfig().variationName);
};

internals.getConfigSchema = function (request, reply) {
    var schema = require(internals.options.themeConfigSchemaPath);

    reply(schema);
};

internals.setVariationName = function(request, reply) {
    internals.themeConfig.setVariationName(request.payload.name);

    reply({forceReload: true});
};

module.exports.register.attributes = {
    name: 'StencilEditor',
    version: '0.0.1'
};
