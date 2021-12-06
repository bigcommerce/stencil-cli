require('colors');
const fsUtilsModule = require('./utils/fsUtils');

function flattenObject(object, result = {}, parentKey = '') {
    return Object.entries(object).reduce((currentLayer, [key, innerValue]) => {
        const resultKey = parentKey !== '' ? `${parentKey}.${key}` : key;
        if (typeof innerValue === 'object') {
            return flattenObject(innerValue, currentLayer, resultKey);
        }
        // eslint-disable-next-line no-param-reassign
        currentLayer[resultKey] = innerValue;
        return currentLayer;
    }, result);
}

class LangHelper {
    constructor({ fsUtils = fsUtilsModule, logger = console } = {}) {
        this._fsUtils = fsUtils;
        this._logger = logger;
    }

    async checkLangKeysPresence(filesPaths, themeLang) {
        const themeLangFilename = `${themeLang}.json`;
        const defaultLangFilePath = filesPaths.find((filePath) =>
            filePath.includes(themeLangFilename),
        );
        const defaultLangFile = await this._fsUtils.parseJsonFile(defaultLangFilePath);
        const flattenedDefaultLang = flattenObject(defaultLangFile);
        const alreadyWarnedKey = [];

        for await (const filePath of filesPaths) {
            if (!filePath.includes(themeLangFilename)) {
                const langFile = await this._fsUtils.parseJsonFile(filePath);
                const flattenedLang = flattenObject(langFile);
                const langKeys = Object.keys(flattenedLang);
                for (const langKey of langKeys) {
                    if (!alreadyWarnedKey.includes(langKey)) {
                        if (!flattenedDefaultLang[langKey]) {
                            this._logger.log(
                                `${
                                    'Warning'.yellow
                                }: file: ${defaultLangFilePath} doesn't have ${langKey}, which is present in ${filePath}`,
                            );
                        } else if (flattenedDefaultLang[langKey].trim().length === 0) {
                            this._logger.log(
                                `${
                                    'Warning'.yellow
                                }: file: ${defaultLangFilePath} has ${langKey}, but it's empty`,
                            );
                        }
                        alreadyWarnedKey.push(langKey);
                    }
                }
            }
        }
    }
}

module.exports = LangHelper;
