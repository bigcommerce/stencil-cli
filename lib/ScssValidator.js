require('colors');
const path = require('path');
const StencilStyles = require('@bigcommerce/stencil-styles');

const cssCompiler = require('./css/compile');

class ScssValidator {
    /**
     *
     * @param themePath
     * @param  themeConfig
     */
    constructor(themePath, themeConfig) {
        this.themePath = themePath;
        this.themeConfig = themeConfig;
    }

    async run() {
        const assetsPath = path.join(this.themePath, 'assets');
        const stylesPath = path.join(this.themePath, 'assets/scss');
        const rawConfig = await this.themeConfig.getConfig();
        const cssFiles = await this.getCssFiles();

        for await (const file of cssFiles) {
            try {
                /* eslint-disable-next-line no-await-in-loop */
                await cssCompiler.compile(
                    rawConfig,
                    assetsPath,
                    file,
                    cssCompiler.SASS_ENGINE_NAME,
                );
            } catch (e) {
                const message = this.parseStencilStylesError(e);
                throw new Error(
                    `${message} while compiling css files from "${stylesPath}/${file}".`.red,
                );
            }
        }
    }

    parseStencilStylesError(e) {
        if (e.formatted) {
            return `${e.formatted.replace('Error: ', '')}: `;
        }

        return e.message;
    }

    getCssFiles() {
        const styles = new StencilStyles();
        return styles.getCssFiles(this.themePath);
    }
}

module.exports = ScssValidator;
