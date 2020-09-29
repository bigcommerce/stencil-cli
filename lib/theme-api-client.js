'use strict';

require('colors');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');

const themeApiClient = {
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

module.exports = themeApiClient;

/**
 * @param {object} options
 * @param {string} options.variationId
 * @param {string} options.apiHost
 * @param {string} options.storeHash
 * @param {string} options.accessToken
 * @returns {Promise<void>}
 */
async function activateThemeByVariationId({ variationId, apiHost, storeHash, accessToken }) {
    const reqOpts = {
        headers: {
            'x-auth-client': 'stencil-cli',
            'x-auth-token': accessToken,
            'content-type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
            variation_id: variationId,
            which: 'original',
        }),
    };
    const reqUrl = `${apiHost}/stores/${storeHash}/v3/themes/actions/activate`;

    let response;
    try {
        response = await fetch(reqUrl, reqOpts);
        if (!response.ok) {
            throw new Error(response.statusText);
        }
    } catch (err) {
        err.name = response.status === 504 ? 'VariationActivationTimeoutError' : 'VariationActivationError';
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
    const reqOpts = {
        headers: {
            'x-auth-client': 'stencil-cli',
            'x-auth-token': accessToken,
        },
        method: 'DELETE',
    };
    const reqUrl = `${apiHost}/stores/${storeHash}/v3/themes/${themeId}`;

    const response = await fetch(reqUrl, reqOpts);

    if (!response.ok) {
        throw new Error(response.statusText);
    }
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
    const reqOpts = {
        headers: {
            'cache-control': 'no-cache',
            'x-auth-client': 'stencil-cli',
            'x-auth-token': accessToken,
        },
    };
    const reqUrl = `${apiHost}/stores/${storeHash}/v3/themes/jobs/${jobId}`;
    let response, payload;

    try {
        response = await fetch(reqUrl, reqOpts);
        payload = await response.json();
    } catch (err) {
        err.name = "JobCompletionStatusCheckError";
        throw err;
    }

    if (response.status === 404) {
        const error = new Error('Job Failed');
        error.name = "JobCompletionStatusCheckError";
        error.messages = [{ message: payload.title }];
        throw error;
    }
    if (response.status !== 200 || payload.data.status === 'FAILED') {
        const error = new Error('Job Failed');
        error.name = "JobCompletionStatusCheckError";
        error.messages = payload.data.errors;
        throw error;
    }
    if (payload.data.status !== 'COMPLETED') {
        const error = new Error(payload.data.percent_complete);
        error.name = "JobCompletionStatusCheckPendingError";
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
    const reqOpts = {
        headers: {
            'x-auth-client': 'stencil-cli',
            'x-auth-token': accessToken,
        },
    };
    const reqUrl = `${apiHost}/stores/${storeHash}/v3/themes`;

    const response = await fetch(reqUrl, reqOpts);
    if (!response.ok) {
        throw new Error(response.statusText);
    }
    const payload = await response.json();

    return payload.data;
}

/**
 * @param {object} options
 * @param {string} options.accessToken
 * @param {string} options.apiHost
 * @param {string} options.storeHash
 * @param {int} options.channelId
 * @returns {Promise<object[]>}
 */
async function getChannelActiveTheme({ accessToken, apiHost, storeHash, channelId}) {
    const reqOpts = {
        headers: {
            'x-auth-client': 'stencil-cli',
            'x-auth-token': accessToken,
        },
    };
    const reqUrl = `${apiHost}/stores/${storeHash}/v3/channels/${channelId}/active-theme`;

    const response = await fetch(reqUrl, reqOpts);
    if (!response.ok) {
        throw new Error(`Could not fetch active theme details for channel ${channelId}: ${response.statusText}`);
    }
    const payload = await response.json();

    return payload.data;
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
async function getThemeConfiguration({ accessToken, apiHost, storeHash,
                                       themeId, configurationId}) {
    const reqOpts = {
        headers: {
            'x-auth-client': 'stencil-cli',
            'x-auth-token': accessToken,
        },
    };

    const reqUrl = `${apiHost}/stores/${storeHash}/v3/themes/${themeId}`
      + `/configurations?uuid:in=${configurationId}`;

    const response = await fetch(reqUrl, reqOpts);
    if (!response.ok) {
        throw new Error(`Could not fetch theme configuration: ${response.statusText}`);
    }
    const payload = await response.json();

    // If configurations array is empty, the theme ID was valid but the configuration ID was not    
    if (!payload.data.length) {
        throw new Error(`Configuration ID ${configurationId} not found for theme ID ${themeId}`);
    }

    return payload.data[0];
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
    const reqOpts = {
        headers: {
            'x-auth-client': 'stencil-cli',
            'x-auth-token': accessToken,
        },
    };
    const reqUrl = `${apiHost}/stores/${storeHash}/v3/themes/${themeId}`;

    try {
        const response = await fetch(reqUrl, reqOpts);
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        const payload = await response.json();

        return payload.data.variations;
    } catch (err) {
        err.name = "VariationsRetrievalError";
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
    formData.append(
        'file',
        fs.createReadStream(bundleZipPath),
        { filename: path.basename(bundleZipPath) },
    );

    const reqOpts = {
        body: formData,
        headers: {
            'cache-control': 'no-cache',
            'x-auth-token': accessToken,
            'x-auth-client': 'stencil-cli',
        },
        method: 'POST',
    };
    const reqUrl = `${apiHost}/stores/${storeHash}/v3/themes`;

    const response = await fetch(reqUrl, reqOpts);
    const payload = await response.json();

    if (response.status === 409) {
        // This status code is overloaded, so we need to check the message to determine
        // if we want to trigger the theme deletion flow.
        const uploadLimitPattern = /You have reached your upload limit/;
        if (payload && payload.title && uploadLimitPattern.exec(payload.title)) {
            return { themeLimitReached: true };
        }

        const message = 'You already have a theme upload in progress. You will need to wait for it to finish processing before uploading a new one.';
        throw new Error(payload && payload.title || message);
    }

    if (response.status === 413) {
        const message = 'Your theme bundle is too large. Please reduce the size of your assets to bring the zip file size under 50MB.';
        throw new Error(payload && payload.title || message);
    }

    if (response.status !== 201) {
        throw new Error(payload && payload.title || 'Server Error');
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
    const reqOpts = {
        headers: {
            'cache-control': 'no-cache',
            'x-auth-token': accessToken,
            'x-auth-client': 'stencil-cli',
            'content-type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
            which: 'last_activated',
        }),
    };
    const reqUrl = `${apiHost}/stores/${storeHash}/v3/themes/${themeId}/actions/download`;

    try {
        const response = await fetch(reqUrl, reqOpts);
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        const payload = await response.json();

        return {
            jobId: payload.job_id,
        };
    } catch (err) {
        err.name = "ThemeDownloadError";
        throw err;
    }
}
