require('colors');
const fs = require('fs');
const path = require('path');

const cssCompiler = require('./css/compile');
const { recursiveReadDir } = require('./utils/fsUtils');

/* eslint-disable no-useless-escape */
const STYLESHEET_REGEXP = /{{\s*stylesheet\s*([\/a-zA-Z'"\.-]+)\s*}}/i;

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
                console.log(e.file);
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

    async getCssFiles() {
        const templatesPath = path.join(this.themePath, 'templates');
        const files = await recursiveReadDir(templatesPath);
        const cssFiles = [];
        for await (const file of files) {
            const content = await fs.promises.readFile(file, { encoding: 'utf-8' });
            const result = content.match(STYLESHEET_REGEXP);
            if (result) {
                // remove quotes
                const fileName = result[1].slice(1, -1);

                const filePath = this.tryToResolveCssFileLocation(fileName, result);
                if (!cssFiles.includes(filePath)) {
                    // check if file exist
                    cssFiles.push(filePath);
                }
            }
        }

        return cssFiles;
    }

    // returns relative path starting from root scss/css folder
    tryToResolveCssFileLocation(fileName, result) {
        const possibleLocations = [
            fileName,
            fileName.replace('/css/', '/scss/'),
            fileName.replace('/scss/', '/css/'),
            fileName.replace('/css/', '/scss/').replace('.css', '.scss'),
            fileName.replace('/scss/', '/css/').replace('.scss', '.css'),
        ];

        for (const location of possibleLocations) {
            const filePath = path.join(this.themePath, location);
            if (fs.existsSync(filePath)) {
                if (!this.isRootCssFile(location)) {
                    return this.getCssFileWithoutRootFolder(location);
                }
                const fileParts = path.parse(filePath);
                return fileParts.name;
            }
        }

        throw new Error(`Couldn't find file for this statement: ${result[0]}`.red);
    }

    // root folders are /assets/css /assets/scss
    // so after split, there can be 3 or 4 elements in the array (depending if the leading slash is present)
    isRootCssFile(location) {
        return location.split('/').length <= 4;
    }

    getCssFileWithoutRootFolder(location) {
        const locationParts = location.split('/');
        if (locationParts[0] === '') {
            locationParts.shift();
        }
        locationParts.shift();
        locationParts.shift();

        return locationParts.join('/');
    }
}

module.exports = ScssValidator;
