const themeApiClient = require('./theme-api-client');
const request = require("request");
const yauzl = require('yauzl');
const fs = require('fs');
const path = require('path');
const tmp = require('tmp');
const utils = {};

module.exports = utils;

utils.selectActiveTheme = (options, callback) => {
    const [activeTheme] = options.themes.filter(theme => theme.is_active).map(theme => theme.uuid);

    callback(null, Object.assign({}, options, { activeTheme }));
};

utils.startThemeDownloadJob = (options, callback) => {
    const config = options.config;

    themeApiClient.downloadTheme({
        accessToken: config.accessToken,
        apiHost: options.apiHost,
        themeId: options.activeTheme,
        clientId: 'stencil-cli',
        storeHash: options.storeHash,
    }, (error, result) => {
        if (error) {
            error.name = 'ThemeUploadError';
            return callback(error);
        }

        callback(null, Object.assign({}, options, {
            jobId: result.jobId,
        }));
    });
};

utils.downloadThemeConfig = (options, callback) => {
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
                    (resolve, reject) =>
                        yauzl.open(tempThemePath, { lazyEntries: true }, (error, zipFile) => {
                            if (error) {
                                return reject(error);
                            }

                            zipFile.readEntry();
                            zipFile.on('entry', entry => {
                                if (!/config\.json/.test(entry.fileName)) {
                                    zipFile.readEntry();
                                    return;
                                }

                                zipFile.openReadStream(entry, (readStreamError, readStream) => {
                                    if (readStreamError) {
                                        return reject(readStreamError);
                                    }

                                    let configFileData = '';

                                    readStream.on('end', () => {
                                        resolve(JSON.parse(configFileData));
                                        zipFile.close();
                                    });
                                    readStream.on('data', chunk => {
                                        configFileData += chunk;
                                    });
                                });
                            });
                        }),
                ),
            )
            .then(
                liveStencilConfig =>
                    new Promise(
                        (resolve, reject) =>
                            fs.writeFile(path.resolve(options.saveConfigName), JSON.stringify(liveStencilConfig, null, 2), error => {
                                if (error) {
                                    reject(error);
                                }

                                resolve();
                            }),
                    ),
            )
            .then(() => {
                cleanupCallback();
                callback(null, options);
            })
            .catch(callback);
    });
};
