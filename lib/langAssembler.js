var Async = require('async'),
    Fs = require('fs'),
    Path = require('path'),
    _ = require('lodash'),
    localeDirectory = 'lang';

module.exports.assemble = assemble;
module.exports.localeDirectory = localeDirectory;

/**
 * Assembles together all of the lang files.
 * This simply loads the files from the lang directory and puts them in an object where
 * locale name is the key and locale data is the value
 *
 * @param callback
 */
function assemble(callback) {
    Fs.readdir(localeDirectory, function (err, localeFiles) {
        var localesToLoad = {};

        // Ignore hidden files
        // @example: MAC generates .DS_STORE
        localeFiles = _.filter(localeFiles, function(fileName) {
            return fileName[0] !== '.';
        });

        if (err) {
            return callback(err);
        }

        _.each(localeFiles, function (localeFile) {
            var localeName = Path.basename(localeFile, '.json');

            localesToLoad[localeName] = function (callback) {
                var localeFilePath = localeDirectory + '/' + localeFile;

                Fs.readFile(localeFilePath, 'utf-8', callback);
            };
        });

        Async.parallel(localesToLoad, callback);
    });
}
