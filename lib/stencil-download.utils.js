const request = require("request");
const yauzl = require('yauzl');
const fs = require('fs');
const tmp = require('tmp');
const path = require('path');
const utils = {};

module.exports = utils;

utils.downloadThemeFiles = (options, callback) => {
    tmp.file(function _tempFileCreated(err, tempThemePath, fd, cleanupCallback) {
        if (err) {
            callback(err);
        }

        (
            new Promise(
                (resolve, reject) =>
                    request(options.downloadUrl)
                        .pipe(fs.createWriteStream(tempThemePath))
                        .on('finish', () => resolve(tempThemePath))
                        .on('error', reject),
            )
        )
            .then(tempThemePath =>
                new Promise(
                    (resolve, reject) => {
                        let foundMatch = false;

                        console.log('ok'.green + ' -- Theme files downloaded');
                        console.log('ok'.green + ' -- Extracting theme files');

                        yauzl.open(tempThemePath, {lazyEntries: true}, (error, zipFile) => {

                            if (error) {
                                return reject(error);
                            }

                            zipFile.on('entry', entry => {

                                zipFile.openReadStream(entry, (readStreamError, readStream) => {
                                    if (readStreamError) {
                                        return reject(readStreamError);
                                    }

                                    let configFileData = '';

                                    if (options.file && options.file.length) {

                                        if (options.file !== entry.fileName) {
                                            zipFile.readEntry();
                                            return;
                                        }
                                        foundMatch = true;

                                    } else if (options.exclude && options.exclude.length) {

                                        /**
                                         * Do not process any file or directory within the exclude option
                                         */
                                        for (let i = 0; i < options.exclude.length; i++) {
                                            if ((entry.fileName).startsWith(options.exclude[i])) {
                                                zipFile.readEntry();
                                                return;
                                            }
                                        }
                                    }

                                    /**
                                     * Create a directory if the parent directory does not exists
                                     */
                                    const parsedPath = path.parse(entry.fileName);

                                    if (parsedPath.dir && !fs.existsSync(parsedPath.dir)) {
                                        fs.mkdirSync(parsedPath.dir, {recursive: true});
                                    }

                                    /**
                                     * If file is a directory, then move to next
                                     */
                                    if (/\/$/.test(entry.fileName)) {
                                        zipFile.readEntry();
                                        return;
                                    }

                                    readStream.on('end', () => {
                                        if (entry.fileName.endsWith('.json')) {
                                            configFileData = JSON.stringify(JSON.parse(configFileData), null, 2);
                                        }

                                        fs.writeFile(entry.fileName, configFileData, {flag: 'w+'}, error => {
                                            if (error) {
                                                reject(error);
                                            }

                                            /**
                                             * Close read if file requested is found
                                             */
                                            if (options.file && options.file.length) {
                                                console.log('ok'.green + ' -- Theme files extracted');
                                                zipFile.close();
                                                resolve(options);
                                            } else {
                                                zipFile.readEntry();
                                            }
                                        });
                                    });

                                    readStream.on('data', chunk => {
                                        configFileData += chunk;
                                    });
                                });
                            });

                            zipFile.readEntry();

                            zipFile.once('end', function () {
                                if (!foundMatch && (options.file && options.file.length)) {
                                    console.log('Warning'.yellow + ` -- ${options.file} not found!`);
                                    reject(`${options.file} not found`);
                                    return;
                                }

                                console.log('ok'.green + ' -- Theme files extracted');
                                zipFile.close();
                                resolve(options);
                            });
                        });
                    },
                ),
            )
            .then(() => {
                cleanupCallback();
                callback(null, options);
            })
            .catch(callback);
    });
};
