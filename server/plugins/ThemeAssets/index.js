var Boom = require('boom'),
    CssAssembler = require('../../../lib/cssAssembler'),
    Hoek = require('hoek'),
    Path = require('path'),
    StencilStyles = require('stencil-styles'),
    Fs = require('fs'),
    _ = require('lodash'),
    internals = {
        options: {
            cssBasePath: ''
        }
    };

module.exports.register = function (server, options, next) {
    internals.options = Hoek.applyToDefaults(internals.options, options);

    internals.stencilStyles = new StencilStyles();

    server.expose('cssHandler', internals.cssHandler);
    server.expose('assetHandler', internals.assetHandler);

    return next();
};

module.exports.register.attributes = {
    name: 'ThemeAssets',
    version: '0.0.1'
};

/**
 * CSS Compiler Handler.  This utilises the CSS Assembler to gather all of the CSS files and then the
 * StencilStyles plugin to compile them all.
 * @param request
 * @param reply
 */
internals.cssHandler = function (request, reply) {
    var variationIndex = _.parseInt(request.params.configId - 1, 10);
    var fileParts = Path.parse(request.params.fileName);
    var compiler;
    var basePath;
    var pathToFile;
    var configuration;

    if (!request.app.themeConfig.variationExists(variationIndex)) {
        return reply(Boom.notFound('Variation ' + request.params.configId + ' does not exist.'));
    }

    // Set the variation to get the right theme configuration
    request.app.themeConfig.setVariation(variationIndex);

    // Get the theme configuration
    configuration = request.app.themeConfig.getConfig();

    // The compiler could be 'sass' or 'less'
    compiler = configuration.css_compiler;
    basePath = Path.join(internals.options.assetsBasePath, compiler);

    // Get the path to the sass|less file
    pathToFile = Path.join(fileParts.dir, fileParts.name + '.' + compiler);

    CssAssembler.assemble(pathToFile, basePath, compiler, function(err, files) {
        var params = {
            data: files[pathToFile],
            files: files,
            dest: Path.join('/assets/css', request.params.fileName),
            themeSettings: configuration.settings,
            autoprefixerOptions: {
                cascade: configuration.autoprefixer_cascade,
                browsers: configuration.autoprefixer_browsers
            }
        };

        internals.stencilStyles.compileCss(compiler, params, function (err, css) {
            if (err) {
                console.error(err);
                return reply(Boom.badData(err));
            }

            reply(css).type('text/css');
        });
    });
};

/**
 * Assets handler
 * 
 * @param request
 * @param reply
 */
internals.assetHandler = function (request, reply) {
    var filePath = Path.join(internals.options.assetsBasePath, request.params.fileName);

    reply.file(filePath);
};
