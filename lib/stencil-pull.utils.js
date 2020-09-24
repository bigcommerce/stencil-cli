const themeApiClient = require('./theme-api-client');
const tmp = require('tmp-promise');
const { extractZipFiles } = require('./archiveManager');
const { fetchFile } = require('./utils/networkUtils');

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

utils.downloadThemeConfig = async options => {
    const { path: tempThemePath, cleanup } = await tmp.file();

    try {
        await fetchFile(options.downloadUrl, tempThemePath);
    } catch (err) {
        throw new Error(`Unable to download theme config from ${options.downloadUrl}: ${err.message}`);
    }

    console.log('ok'.green + ' -- Theme files downloaded');
    console.log('ok'.green + ' -- Extracting theme config');

    const outputNames = {
        'config.json': options.saveConfigName,
    };
    await extractZipFiles({ zipPath: tempThemePath, fileToExtract: 'config.json', outputNames });

    console.log('ok'.green + ' -- Theme config extracted');

    await cleanup();

    return options;
};
