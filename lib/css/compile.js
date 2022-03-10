const path = require('path');
const StencilStyles = require('@bigcommerce/stencil-styles');
const { promisify } = require('util');

const cssAssembler = require('../css-assembler');

const SASS_ENGINE_NAME = 'node-sass-fork';

const compile = async (configuration, themeAssetsPath, fileName) => {
    const fileParts = path.parse(fileName);
    const ext = configuration.css_compiler === 'css' ? configuration.css_compiler : 'scss';
    const pathToFile = path.join(fileParts.dir, `${fileParts.name}.${ext}`);
    const basePath = path.join(themeAssetsPath, `${ext}`);

    let files;
    try {
        files = await promisify(cssAssembler.assemble)(pathToFile, basePath, `${ext}`, {});
    } catch (err) {
        console.error(err);
        throw err;
    }

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
    stencilStyles.activateEngine(SASS_ENGINE_NAME);

    return stencilStyles.compileCss('scss', params);
};

module.exports = {
    compile,
};
