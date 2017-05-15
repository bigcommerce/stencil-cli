const Boom = require('boom');
const CssAssembler = require('../../../lib/css-assembler');
const Utils = require('../../lib/utils');
const Hoek = require('hoek');
const Path = require('path');
const StencilStyles = require('@bigcommerce/stencil-styles');
const internals = {
    options: {
        cssBasePath: '',
    },
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
    version: '0.0.1',
};

/**
 * Get the variation index from the "ConfigId" in the css filename
 * @param  {string} fileName
 * @return {number}
 */
internals.getVariationIndex = fileName => {
    const match = fileName.match(new RegExp(`.+-(${Utils.uuidRegExp})$`));

    return match ? Utils.uuid2int(match[1]) - 1 : 0;
};

/**
 * Get the original css file name
 * @param  {string} fileName
 * @return {string}
 */
internals.getOriginalFileNmae = fileName => {
    const match = fileName.match(new RegExp(`(.+)-${Utils.uuidRegExp}$`));

    return match ? match[1] : fileName;
};

/**
 * CSS Compiler Handler.  This utilises the CSS Assembler to gather all of the CSS files and then the
 * StencilStyles plugin to compile them all.
 * @param request
 * @param reply
 */
internals.cssHandler = function (request, reply) {
    var variationIndex = internals.getVariationIndex(request.params.fileName);
    var fileName = internals.getOriginalFileNmae(request.params.fileName);
    var fileParts = Path.parse(fileName);
    var compiler;
    var basePath;
    var pathToFile;
    var configuration;

    if (!request.app.themeConfig.variationExists(variationIndex)) {
        return reply(Boom.notFound('Variation ' + (variationIndex + 1) + ' does not exist.'));
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
            dest: Path.join('/assets/css', fileName),
            themeSettings: configuration.settings,
            sourceMap: true,
            autoprefixerOptions: {
                cascade: configuration.autoprefixer_cascade,
                browsers: configuration.autoprefixer_browsers,
            },
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
