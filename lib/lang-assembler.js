const async = require('async');
const fs = require('fs');
const path = require('path');

const LOCALE_DIRECTORY = 'lang';

/**
 * Assembles together all of the lang files.
 * This simply loads the files from the lang directory and puts them in an object where
 * locale name is the key and locale data is the value
 *
 * @param callback
 */
function assemble(callback) {
    fs.readdir(LOCALE_DIRECTORY, (err, localeFiles) => {
        if (err) {
            callback(err);
            return;
        }

        // Ignore hidden files
        // @example: MAC generates .DS_STORE
        const filteredLocaleFiles = localeFiles.filter((fileName) => fileName[0] !== '.');
        const localesToLoad = {};

        for (const localeFile of filteredLocaleFiles) {
            const localeName = path.basename(localeFile, '.json');

            localesToLoad[localeName.toLowerCase()] = (cb2) => {
                const localeFilePath = `${LOCALE_DIRECTORY}/${localeFile}`;

                fs.readFile(localeFilePath, 'utf-8', cb2);
            };
        }

        async.parallel(localesToLoad, callback);
    });
}

module.exports = {
    assemble,
    LOCALE_DIRECTORY,
};
