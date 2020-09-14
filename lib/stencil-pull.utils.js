const themeApiClient = require('./theme-api-client');
const fetch = require('node-fetch');
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

utils.startThemeDownloadJob = async options => {
    const { config: { accessToken }, apiHost, activeTheme, storeHash } = options;

    const { jobId } = await themeApiClient.downloadTheme({
        accessToken: accessToken,
        themeId: activeTheme,
        apiHost,
        storeHash,
    });

    return {
        ...options,
        jobId,
    };
};

utils.downloadThemeConfig = (options, callback) => {
    tmp.file(function _tempFileCreated(err, tempThemePath, fd, cleanupCallback) {
        if (err) {
            callback(err);
        }

        Promise.resolve()
            .then(() => fetch(options.downloadUrl))
            .then(response => new Promise((resolve, reject) => {
                if (!response.ok) {
                    reject(`Unable to download theme config from ${options.downloadUrl}: ${response.statusText}`);
                }

                response.body.pipe(fs.createWriteStream(tempThemePath))
                .on('finish', () => resolve(tempThemePath))
                .on('error', reject);
            }))
            .then(tempThemePath => new Promise((resolve, reject) =>
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
            ))
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
