'use strict';

require('colors');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');
const Wreck = require('wreck');

const themeApiClient = {
    activateThemeByVariationId,
    deleteThemeById,
    getJob,
    printErrorMessages,
    getVariationsByThemeId,
    getThemes,
    postTheme,
    downloadTheme,
};

module.exports = themeApiClient;

function activateThemeByVariationId(options, callback) {
    Wreck.post(`${options.apiHost}/stores/${options.storeHash}/v3/themes/actions/activate`, {
        headers: {
            'x-auth-client': 'stencil-cli',
            'x-auth-token': options.accessToken,
        },
        json: true,
        payload: {
            variation_id: options.variationId,
            which: 'original',
        },
    }, err => {
        if (err) {
            err.name = err.output && err.output.statusCode === 504 ? 'VariationActivationTimeoutError' : 'VariationActivationError';
            return callback(err);
        }

        callback(null, options);
    });
}

function deleteThemeById(options, callback) {
    Wreck.delete(`${options.apiHost}/stores/${options.storeHash}/v3/themes/${options.themeId}`, {
        headers: {
            'x-auth-client': 'stencil-cli',
            'x-auth-token': options.accessToken,
        },
        json: true,
    }, err => {
        if (err) {
            return callback(err);
        }

        callback(null);
    });
}

async function getJob(options) {
    const { accessToken, apiHost, storeHash, jobId, resultFilter } = options;
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

    const filteredResult = resultFilter ? resultFilter(payload.data.result) : payload.data.result;

    return { ...options, ...filteredResult };
}

/**
 * @param {object[]} errors
 * @returns {void}
 */
function printErrorMessages(errors) {
    if (!Array.isArray(errors)) {
        console.log("unknown error".red);
        return;
    }

    for (let error of errors) {
        if (error && error.message) {
            console.log(error.message.red + '\n');
        }
    }

    console.log('Please visit the troubleshooting page https://developer.bigcommerce.com/stencil-docs/deploying-a-theme/troubleshooting-theme-uploads');
}

function getThemes(options, callback) {
    Wreck.get(`${options.apiHost}/stores/${options.storeHash}/v3/themes`, {
        headers: {
            'x-auth-client': 'stencil-cli',
            'x-auth-token': options.accessToken,
        },
        json: true,
    }, (err, res, payload) => {
        if (err) {
            return callback(err);
        }

        callback(null, Object.assign({}, options, {
            themes: payload.data,
        }));
    });
}

function getVariationsByThemeId(options, callback) {
    Wreck.get(`${options.apiHost}/stores/${options.storeHash}/v3/themes/${options.themeId}`, {
        json: true,
        headers: {
            'x-auth-client': 'stencil-cli',
            'x-auth-token': options.accessToken,
        },
    }, (err, res, payload) => {
        if (err) {
            err.name = "VariationsRetrievalError";
            return callback(err);
        }

        callback(null, Object.assign({}, options, {
            variations: payload.data.variations,
        }));
    });
}

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

async function downloadTheme({accessToken, apiHost, storeHash, themeId}) {
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
