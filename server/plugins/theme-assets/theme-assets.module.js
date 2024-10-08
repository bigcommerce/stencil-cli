import { defaultsDeep } from 'lodash-es';
import * as Boom from '@hapi/boom';
import path from 'path';
import { uuidRegExp, uuid2int } from '../../lib/utils.js';
import cssCompiler from '../../../lib/css/compile.js';

const internals = {
    options: {},
};
function register(server, options) {
    internals.options = defaultsDeep(options, internals.options);
    server.expose('cssHandler', internals.cssHandler);
    server.expose('assetHandler', internals.assetHandler);
}
/**
 * Get the variation index from the "ConfigId" in the css filename
 * @param  {string} fileName
 * @returns {number}
 */
internals.getVariationIndex = (fileName) => {
    const match = fileName.match(new RegExp(`.+-(${uuidRegExp})$`));
    return match ? uuid2int(match[1]) - 1 : 0;
};
/**
 * Get the original css file name
 * @param  {string} fileName
 * @returns {string}
 */
internals.getOriginalFileName = (fileName) => {
    const match = fileName.match(new RegExp(`(.+)-${uuidRegExp}$`));
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
    const configuration = await request.app.themeConfig.getConfig();
    const fileName = internals.getOriginalFileName(request.params.fileName);
    const themeAssetsPath = internals.getThemeAssetsPath();
    try {
        const css = await cssCompiler.compile(configuration, themeAssetsPath, fileName);
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
export const name = 'ThemeAssets';
export const version = '0.0.1';
export { register };
export default {
    register,
    name,
    version,
};
