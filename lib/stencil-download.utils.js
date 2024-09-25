import * as tmp from 'tmp-promise';
import { extractZipFiles } from './archiveManager.js';
import NetworkUtils from './utils/NetworkUtils.js';
import themeApiClient from './theme-api-client.js';

const networkUtils = new NetworkUtils();
const utils = {};
utils.downloadThemeFiles = async (options) => {
    const { path: tempThemePath, cleanup } = await tmp.file();
    try {
        await networkUtils.fetchFile(options.downloadUrl, tempThemePath);
    } catch (err) {
        throw new Error(
            `Unable to download theme files from ${options.downloadUrl}: ${err.message}`,
        );
    }
    console.log(`${'ok'.green} -- Theme files downloaded`);
    console.log(`${'ok'.green} -- Extracting theme files`);
    await extractZipFiles({
        zipPath: tempThemePath,
        fileToExtract: options.file,
        exclude: options.exclude,
    });
    console.log(`${'ok'.green} -- Theme files extracted`);
    await cleanup();
    return options;
};
utils.startThemeDownloadJob = async (options) => {
    const {
        config: { accessToken },
        activeTheme,
        storeHash,
    } = options;
    const apiHost = options.apiHost || options.config.apiHost;
    const { jobId } = await themeApiClient.downloadTheme({
        accessToken,
        themeId: activeTheme.active_theme_uuid,
        apiHost,
        storeHash,
    });
    return {
        ...options,
        jobId,
    };
};
export default utils;
