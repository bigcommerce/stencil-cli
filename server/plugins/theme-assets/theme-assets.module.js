const _ = require('lodash');
const Boom = require('@hapi/boom');
const StencilStyles = require('@bigcommerce/stencil-styles');
const path = require('path');
const { promisify } = require('util');

const cssAssembler = require('../../../lib/css-assembler');
const utils = require('../../lib/utils');

const internals = {
    options: {},
};

function register(server, options) {
    internals.options = _.defaultsDeep(options, internals.options);

    server.expose('cssHandler', internals.cssHandler);
    server.expose('assetHandler', internals.assetHandler);
}

/**
 * Get the variation index from the "ConfigId" in the css filename
 * @param  {string} fileName
 * @returns {number}
 */
internals.getVariationIndex = (fileName) => {
    const match = fileName.match(new RegExp(`.+-(${utils.uuidRegExp})$`));

    return match ? utils.uuid2int(match[1]) - 1 : 0;
};

/**
 * Get the original css file name
 * @param  {string} fileName
 * @returns {string}
 */
internals.getOriginalFileName = (fileName) => {
    const match = fileName.match(new RegExp(`(.+)-${utils.uuidRegExp}$`));

    return match ? match[1] : fileName;
};

/**
 * CSS Compiler Handler.  This utilises the CSS Assembler to gather all of the CSS files and then the
 * StencilStyles plugin to compile them all.
 * @param request
 * @param h
 */
internals.cssHandler = async (request, h) => {
    const variationIndex = internals.getVariationIndex(request.params.fileName);
    const variationExists = await request.app.themeConfig.variationExists(variationIndex);

    if (!variationExists) {
        throw Boom.notFound(`Variation ${variationIndex + 1} does not exist.`);
    }

    // Set the variation to get the right theme configuration
    request.app.themeConfig.setVariation(variationIndex);

    // Get the theme configuration
    const fileName = internals.getOriginalFileName(request.params.fileName);
    const fileParts = path.parse(fileName);
    const pathToFile = path.join(fileParts.dir, `${fileParts.name}.scss`);
    const basePath = path.join(internals.getThemeAssetsPath(), 'scss');

    let files;
    try {
        files = await promisify(cssAssembler.assemble)(pathToFile, basePath, 'scss', {});
    } catch (err) {
        console.error(err);
        throw Boom.badData(err);
    }

    const configuration = await request.app.themeConfig.getConfig();

    const params = {
        data: files[pathToFile],
        files,
        dest: path.join('/assets/css', fileName),
        themeSettings: configuration.settings,
        sourceMap: true,
        autoprefixerOptions: {
            cascade: configuration.autoprefixer_cascade,
            browsers: configuration.autoprefixer_browsers,
        },
    };
    const stencilStyles = new StencilStyles(console);

    try {
        const css = await stencilStyles.compileCss('scss', params);
        return h.response(css).type('text/css');
    } catch (err) {
        console.error(err);
        throw Boom.badData(err);
    }
};

/**
 * Assets handler
 *
 * @param request
 * @param h
 */
internals.assetHandler = (request, h) => {
    const filePath = path.join(internals.getThemeAssetsPath(), request.params.fileName);

    return h.file(filePath);
};

internals.getThemeAssetsPath = () => {
    return path.join(internals.options.themePath, 'assets');
};

module.exports = {
    register,
    name: 'ThemeAssets',
    version: '0.0.1',
};
