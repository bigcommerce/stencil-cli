const Boom = require('boom');
const CssAssembler = require('../../../lib/css-assembler');
const Utils = require('../../lib/utils');
const Hoek = require('hoek');
const Path = require('path');
const StencilStyles = require('@bigcommerce/stencil-styles');
const internals = {
    options: {},
};

module.exports.register = function (server, options, next) {
    internals.options = Hoek.applyToDefaults(internals.options, options);

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
internals.getOriginalFileName = fileName => {
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
    const variationIndex = internals.getVariationIndex(request.params.fileName);

    if (!request.app.themeConfig.variationExists(variationIndex)) {
        return reply(Boom.notFound('Variation ' + (variationIndex + 1) + ' does not exist.'));
    }

    // Set the variation to get the right theme configuration
    request.app.themeConfig.setVariation(variationIndex);

    // Get the theme configuration
    const fileName = internals.getOriginalFileName(request.params.fileName);
    const fileParts = Path.parse(fileName);
    const pathToFile = Path.join(fileParts.dir, fileParts.name + '.scss');
    const basePath = Path.join(internals.getThemeAssetsPath(), 'scss');

    CssAssembler.assemble(pathToFile, basePath, 'scss', (err, files) => {
        const configuration = request.app.themeConfig.getConfig();

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

        let stencilStyles = new StencilStyles();
        stencilStyles.compileCss('scss', params, (err, css) => {
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
    var filePath = Path.join(internals.getThemeAssetsPath(), request.params.fileName);

    reply.file(filePath);
};


internals.getThemeAssetsPath = () => {
    return Path.join(internals.options.themePath, 'assets');
};
