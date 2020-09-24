const tmp = require('tmp-promise');
const { extractZipFiles } = require('./archiveManager');
const { fetchFile } = require('./utils/networkUtils');

const utils = {};

module.exports = utils;

utils.downloadThemeFiles = async options => {
    const { path: tempThemePath, cleanup } = await tmp.file();

    try {
        await fetchFile(options.downloadUrl, tempThemePath);
    } catch (err) {
        throw new Error(`Unable to download theme files from ${options.downloadUrl}: ${err.message}`);
    }

    console.log('ok'.green + ' -- Theme files downloaded');
    console.log('ok'.green + ' -- Extracting theme files');

    await extractZipFiles({ zipPath: tempThemePath, fileToExtract: options.file, exclude: options.exclude });

    console.log('ok'.green + ' -- Theme files extracted');

    await cleanup();

    return options;
};
