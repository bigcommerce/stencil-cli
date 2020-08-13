const _ = require('lodash');
const Boom = require('@hapi/boom');
const StencilStyles = require('@bigcommerce/stencil-styles');
const Path = require('path');
const { promisify } = require("util");

const CssAssembler = require('../../../lib/css-assembler');
const Utils = require('../../lib/utils');

const internals = {
    options: {},
};

function register (server, options) {
    internals.options = _.defaultsDeep(options, internals.options);

    server.expose('cssHandler', internals.cssHandler);
    server.expose('assetHandler', internals.assetHandler);
}

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
 * @param h
 */
internals.cssHandler = async function (request, h) {
    const variationIndex = internals.getVariationIndex(request.params.fileName);

    if (!request.app.themeConfig.variationExists(variationIndex)) {
        throw Boom.notFound('Variation ' + (variationIndex + 1) + ' does not exist.');
    }

    // Set the variation to get the right theme configuration
    request.app.themeConfig.setVariation(variationIndex);

    // Get the theme configuration
    const fileName = internals.getOriginalFileName(request.params.fileName);
    const fileParts = Path.parse(fileName);
    const pathToFile = Path.join(fileParts.dir, fileParts.name + '.scss');
    const basePath = Path.join(internals.getThemeAssetsPath(), 'scss');

    let files;
    try {
        files = await promisify(CssAssembler.assemble)(pathToFile, basePath, 'scss');
    } catch (err) {
        console.error(err);
        throw Boom.badData(err);
    }

    const configuration = request.app.themeConfig.getConfig();

    const params = {
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
    const stencilStyles = new StencilStyles();

    let css;
    try {
        css = await promisify(stencilStyles.compileCss.bind(stencilStyles))('scss', params);
    } catch (err) {
        console.error(err);
        throw Boom.badData(err);
    }

    return h.response(css).type('text/css');
};

/**
 * Assets handler
 *
 * @param request
 * @param h
 */
internals.assetHandler = function (request, h) {
    const filePath = Path.join(internals.getThemeAssetsPath(), request.params.fileName);

    return h.file(filePath);
};


internals.getThemeAssetsPath = () => {
    return Path.join(internals.options.themePath, 'assets');
};

module.exports = {
    register,
    name: 'ThemeAssets',
    version: '0.0.1',
};
