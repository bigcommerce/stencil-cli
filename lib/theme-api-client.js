require('colors');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const NetworkUtils = require('./utils/NetworkUtils');
const { PACKAGE_INFO } = require('../constants');

const networkUtils = new NetworkUtils();

/**
 * @param {object} options
 * @param {string} options.storeUrl
 * @returns {Promise<object[]>}
 */
async function getStoreHash({ storeUrl }) {
    try {
        const url = new URL(`/admin/oauth/info`, storeUrl).toString();
        const response = await networkUtils.sendApiRequest({ url });
        if (!response.data || !response.data.store_hash) {
            throw new Error('Received empty store_hash value in the server response');
        }
        return response.data.store_hash;
    } catch (err) {
        err.name = 'StoreHashReadError';
        throw err;
    }
}

/**
 * @param {object} options
 * @param {string} options.storeUrl
 * @param {string} [options.currentCliVersion]
 * @returns {Promise<object>}
 */
async function checkCliVersion({ storeUrl, currentCliVersion = PACKAGE_INFO.version }) {
    const url = new URL(`/stencil-version-check?v=${currentCliVersion}`, storeUrl).toString();
    let payload;

    try {
        const response = await networkUtils.sendApiRequest({ url });
        payload = response.data;
        if (!payload) {
            throw new Error('Empty payload in the server response');
        }
    } catch (err) {
        throw new Error(
            'The BigCommerce Store you are pointing to either does not exist or is not available at this time.'
                .red +
                '\nError details:\n' +
                err.message,
        );
    }
    if (payload.error) {
        throw new Error(payload.error.red);
    }
    if (payload.status !== 'ok') {
        throw new Error(
            'Error: You are using an outdated version of stencil-cli, please run '.red +
                '$ npm install -g @bigcommerce/stencil-cli'.cyan,
        );
    }
    return payload;
}

/**
 * @param {object} options
 * @param {string} options.variationId
 * @param {string} options.channelId
 * @param {string} options.apiHost
 * @param {string} options.storeHash
 * @param {string} options.accessToken
 * @returns {Promise<any>}
 */
async function activateThemeByVariationId({
    variationId,
    channelId,
    apiHost,
    storeHash,
    accessToken,
}) {
    try {
        return await networkUtils.sendApiRequest({
            url: `${apiHost}/stores/${storeHash}/v3/themes/actions/activate`,
            headers: {
                'content-type': 'application/json',
            },
            method: 'POST',
            accessToken,
            data: {
                variation_id: variationId,
                channel_id: channelId,
                which: 'original',
            },
        });
    } catch (err) {
        err.name =
            err.response && err.response.status === 504
                ? 'VariationActivationTimeoutError'
                : 'VariationActivationError';
        throw err;
    }
}

/**
 * @param {object} options
 * @param {string} options.themeId
 * @param {string} options.accessToken
 * @param {string} options.apiHost
 * @param {string} options.storeHash
 * @returns {Promise<void>}
 */
async function deleteThemeById({ themeId, accessToken, apiHost, storeHash }) {
    return networkUtils.sendApiRequest({
        url: `${apiHost}/stores/${storeHash}/v3/themes/${themeId}`,
        accessToken,
        method: 'DELETE',
    });
}

/**
 * @param {object} options
 * @param {string} options.accessToken
 * @param {string} options.apiHost
 * @param {string} options.storeHash
 * @param {string} options.jobId
 * @param {Function} [options.resultFilter]
 * @returns {Promise<object>}
 */
async function getJob({ accessToken, apiHost, storeHash, jobId, resultFilter }) {
    let response;
    let payload;
    try {
        response = await networkUtils.sendApiRequest({
            url: `${apiHost}/stores/${storeHash}/v3/themes/jobs/${jobId}`,
            headers: {
                'cache-control': 'no-cache',
            },
            accessToken,
            validateStatus: () => true, // Wanna handle the statuses manually later
        });
        payload = response.data;
    } catch (err) {
        err.name = 'JobCompletionStatusCheckError';
        throw err;
    }

    if (response.status !== 200 || (payload.data && payload.data.status === 'FAILED')) {
        const error = new Error('Job Failed');
        error.name = 'JobCompletionStatusCheckError';
        error.messages = (payload.data && payload.data.errors) || [{ message: payload.title }];
        throw error;
    }
    if (!payload.data || payload.data.status !== 'COMPLETED') {
        const error = new Error(payload.data.percent_complete);
        error.name = 'JobCompletionStatusCheckPendingError';
        throw error;
    }

    return resultFilter ? resultFilter(payload.data.result) : payload.data.result;
}

/**
 * @param {object} options
 * @param {string} options.accessToken
 * @param {string} options.apiHost
 * @param {string} options.storeHash
 * @returns {Promise<object[]>}
 */
async function getThemes({ accessToken, apiHost, storeHash }) {
    const response = await networkUtils.sendApiRequest({
        url: `${apiHost}/stores/${storeHash}/v3/themes`,
        accessToken,
    });
    return response.data.data;
}

/**
 * @param {object} options
 * @param {string} options.accessToken
 * @param {string} options.apiHost
 * @param {string} options.storeHash
 * @param {int} options.channelId
 * @returns {Promise<object[]>}
 */
async function getChannelActiveTheme({ accessToken, apiHost, storeHash, channelId }) {
    try {
        const response = await networkUtils.sendApiRequest({
            url: `${apiHost}/stores/${storeHash}/v3/channels/${channelId}/active-theme`,
            accessToken,
        });
        return response.data.data;
    } catch (err) {
        throw new Error(
            `Could not fetch active theme details for channel ${channelId}: ${err.message}`,
        );
    }
}

/**
 * @param {object} options
 * @param {string} options.accessToken
 * @param {string} options.apiHost
 * @param {string} options.storeHash
 * @returns {Promise<[{channel_id, url}]>}
 */
async function getStoreChannels({ accessToken, apiHost, storeHash }) {
    try {
        const response = await networkUtils.sendApiRequest({
            url: `${apiHost}/stores/${storeHash}/v3/sites`,
            accessToken,
        });
        return response.data.data;
    } catch (err) {
        throw new Error(`Could not fetch a list of the store channels: ${err.message}`);
    }
}

/**
 * @param {object} options
 * @param {string} options.accessToken
 * @param {string} options.apiHost
 * @param {string} options.storeHash
 * @param {string} options.themeId
 * @param {string} options.configurationId
 * @returns {Promise<object[]>}
 */
async function getThemeConfiguration({
    accessToken,
    apiHost,
    storeHash,
    themeId,
    configurationId,
}) {
    try {
        const response = await networkUtils.sendApiRequest({
            url: `${apiHost}/stores/${storeHash}/v3/themes/${themeId}/configurations?uuid:in=${configurationId}`,
            accessToken,
        });
        // If configurations array is empty, the theme ID was valid but the configuration ID was not
        if (!response.data || !response.data.data.length) {
            throw new Error(
                `Configuration ID ${configurationId} not found for theme ID ${themeId}`,
            );
        }
        return response.data.data[0];
    } catch (err) {
        throw new Error(`Could not fetch theme configuration: ${err.message}`);
    }
}

/**
 * @param {object} options
 * @param {string} options.themeId
 * @param {string} options.accessToken
 * @param {string} options.apiHost
 * @param {string} options.storeHash
 * @returns {Promise<object[]>}
 */
async function getVariationsByThemeId({ accessToken, apiHost, storeHash, themeId }) {
    try {
        const response = await networkUtils.sendApiRequest({
            url: `${apiHost}/stores/${storeHash}/v3/themes/${themeId}`,
            accessToken,
        });
        return response.data.data.variations;
    } catch (err) {
        err.name = 'VariationsRetrievalError';
        throw err;
    }
}

/**
 * @param {object} options
 * @param {string} options.bundleZipPath
 * @param {string} options.accessToken
 * @param {string} options.apiHost
 * @param {string} options.storeHash
 * @returns {Promise<object>}
 */
async function postTheme({ bundleZipPath, accessToken, apiHost, storeHash }) {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(bundleZipPath), {
        filename: path.basename(bundleZipPath),
    });

    const response = await networkUtils.sendApiRequest({
        url: `${apiHost}/stores/${storeHash}/v3/themes`,
        method: 'POST',
        data: formData,
        headers: {
            ...formData.getHeaders(),
            'cache-control': 'no-cache',
        },
        accessToken,
        validateStatus: () => true, // Wanna handle the statuses manually later
    });
    const payload = response.data;

    if (response.status === 409) {
        // This status code is overloaded, so we need to check the message to determine
        // if we want to trigger the theme deletion flow.
        const uploadLimitPattern = /You have reached your upload limit/;
        if (payload && payload.title && uploadLimitPattern.exec(payload.title)) {
            return { themeLimitReached: true };
        }

        const message =
            'You already have a theme upload in progress. You will need to wait for it to finish processing before uploading a new one.';
        throw new Error((payload && payload.title) || message);
    }

    if (response.status === 413) {
        const message =
            'Your theme bundle is too large. Please reduce the size of your assets to bring the zip file size under 50MB.';
        throw new Error((payload && payload.title) || message);
    }

    if (response.status !== 201) {
        throw new Error((payload && payload.title) || 'Server Error');
    }

    return { jobId: payload.job_id };
}

/**
 * @param {object} options
 * @param {string} options.accessToken
 * @param {string} options.apiHost
 * @param {string} options.storeHash
 * @param {string} options.themeId
 * @returns {Promise<{jobId: string}>}
 */
async function downloadTheme({ accessToken, apiHost, storeHash, themeId }) {
    try {
        const response = await networkUtils.sendApiRequest({
            url: `${apiHost}/stores/${storeHash}/v3/themes/${themeId}/actions/download`,
            headers: {
                'cache-control': 'no-cache',
                'content-type': 'application/json',
            },
            accessToken,
            method: 'POST',
            data: {
                which: 'last_activated',
            },
        });
        return {
            jobId: response.data.job_id,
        };
    } catch (err) {
        err.name = 'ThemeDownloadError';
        throw err;
    }
}

module.exports = {
    getStoreHash,
    checkCliVersion,
    activateThemeByVariationId,
    deleteThemeById,
    getStoreChannels,
    getChannelActiveTheme,
    getJob,
    getVariationsByThemeId,
    getThemes,
    getThemeConfiguration,
    postTheme,
    downloadTheme,
};
