require('colors');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const cssCompiler = require('./css/compile');
const { recursiveReadDir } = require('./utils/fsUtils');

/* eslint-disable no-useless-escape */
const STYLESHEET_REGEXP = /{{\s*stylesheet\s*([\/a-zA-Z'"\.-]+)\s*}}/gi;

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

    async getCssFiles() {
        const templatesPath = path.join(this.themePath, 'templates');
        const files = await recursiveReadDir(templatesPath);
        const cssFiles = [];
        for await (const file of files) {
            const content = await fs.promises.readFile(file, { encoding: 'utf-8' });
            const result = content.matchAll(STYLESHEET_REGEXP);
            if (result) {
                for (const item of result) {
                    // remove quotes
                    const filePath = item[1].slice(1, -1);
                    const fileName = this.tryToResolveCssFileLocation(filePath);
                    if (
                        !this.isStyleSheetAComment(content, filePath) &&
                        !cssFiles.includes(fileName)
                    ) {
                        cssFiles.push(fileName);
                    }
                }
            }
        }

        return cssFiles;
    }

    isStyleSheetAComment(content, cssFilePath) {
        const $ = cheerio.load(content);
        const comments = $('*')
            .contents()
            .filter(function () {
                return this.nodeType === 8;
            });
        for (const comment of comments) {
            const { data } = comment;
            if (data && data.includes('stylesheet') && data.includes(cssFilePath)) {
                return true;
            }
        }

        return false;
    }

    // returns relative path starting from root scss/css folder
    tryToResolveCssFileLocation(filePath) {
        const possibleLocations = [
            filePath,
            filePath.replace('/css/', '/scss/'),
            filePath.replace('/scss/', '/css/'),
            filePath.replace('/css/', '/scss/').replace('.css', '.scss'),
            filePath.replace('/scss/', '/css/').replace('.scss', '.css'),
        ];

        for (const location of possibleLocations) {
            const fullFilePath = path.join(this.themePath, location);
            if (fs.existsSync(fullFilePath)) {
                if (!this.isRootCssFile(location)) {
                    return this.getCssFileWithoutRootFolder(location);
                }
                const fileParts = path.parse(fullFilePath);
                return fileParts.name;
            }
        }

        console.log(`Couldn't validate scss compilation for this file path: ${filePath}`.yellow);
        return null;
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
