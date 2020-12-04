require('colors');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendApiRequest } = require('./utils/networkUtils');

/**
 * @param {object} options
 * @param {string} options.variationId
 * @param {string} options.apiHost
 * @param {string} options.storeHash
 * @param {string} options.accessToken
 * @returns {Promise<any>}
 */
async function activateThemeByVariationId({ variationId, apiHost, storeHash, accessToken }) {
    try {
        return await sendApiRequest({
            url: `${apiHost}/stores/${storeHash}/v3/themes/actions/activate`,
            headers: {
                'x-auth-client': 'stencil-cli',
                'x-auth-token': accessToken,
                'content-type': 'application/json',
            },
            method: 'POST',
            data: {
                variation_id: variationId,
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
    return sendApiRequest({
        url: `${apiHost}/stores/${storeHash}/v3/themes/${themeId}`,
        headers: {
            'x-auth-client': 'stencil-cli',
            'x-auth-token': accessToken,
        },
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
        response = await sendApiRequest({
            url: `${apiHost}/stores/${storeHash}/v3/themes/jobs/${jobId}`,
            headers: {
                'cache-control': 'no-cache',
                'x-auth-client': 'stencil-cli',
                'x-auth-token': accessToken,
            },
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
    const response = await sendApiRequest({
        url: `${apiHost}/stores/${storeHash}/v3/themes`,
        headers: {
            'x-auth-client': 'stencil-cli',
            'x-auth-token': accessToken,
        },
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
        const response = await sendApiRequest({
            url: `${apiHost}/stores/${storeHash}/v3/channels/${channelId}/active-theme`,
            headers: {
                'x-auth-client': 'stencil-cli',
                'x-auth-token': accessToken,
            },
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
        const response = await sendApiRequest({
            url: `${apiHost}/stores/${storeHash}/v3/themes/${themeId}/configurations?uuid:in=${configurationId}`,
            headers: {
                'x-auth-client': 'stencil-cli',
                'x-auth-token': accessToken,
            },
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
        const response = await sendApiRequest({
            url: `${apiHost}/stores/${storeHash}/v3/themes/${themeId}`,
            headers: {
                'x-auth-client': 'stencil-cli',
                'x-auth-token': accessToken,
            },
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

    const response = await sendApiRequest({
        url: `${apiHost}/stores/${storeHash}/v3/themes`,
        method: 'POST',
        data: formData,
        headers: {
            ...formData.getHeaders(),
            'cache-control': 'no-cache',
            'x-auth-token': accessToken,
            'x-auth-client': 'stencil-cli',
        },
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
        const response = await sendApiRequest({
            url: `${apiHost}/stores/${storeHash}/v3/themes/${themeId}/actions/download`,
            headers: {
                'cache-control': 'no-cache',
                'x-auth-token': accessToken,
                'x-auth-client': 'stencil-cli',
                'content-type': 'application/json',
            },
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
    activateThemeByVariationId,
    deleteThemeById,
    getChannelActiveTheme,
    getJob,
    getVariationsByThemeId,
    getThemes,
    getThemeConfiguration,
    postTheme,
    downloadTheme,
};
