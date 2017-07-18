'use strict';

const fs = require('fs');
const path = require('path');
const request = require("request");
const Wreck = require('wreck');

const themeApiClient = {
    activateThemeByVariationId,
    deleteThemeById,
    getJob,
    getVariationsByThemeId,
    getThemes,
    postTheme,
};

module.exports = themeApiClient;

function activateThemeByVariationId(options, callback) {
    Wreck.post(`${options.apiHost}/stores/${options.storeHash}/v3/themes/actions/activate`, {
        headers: {
            'x-auth-client': options.clientId,
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
            'x-auth-client': options.clientId,
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

function getJob(options, callback) {
    const opts = {
        headers: {
            'cache-control': 'no-cache',
            'x-auth-client': options.clientId,
            'x-auth-token': options.accessToken,
        },
        json: true,
        method: 'GET',
        url: `${options.apiHost}/stores/${options.storeHash}/v3/themes/jobs/${options.jobId}`,
    };

    request(opts, (err, res, payload) => {
        let error;

        if (err) {
            err.name = "JobCompletionStatusCheckError"
            return callback(err);
        }

        if (res.statusCode !== 200 || payload.data.status === 'FAILED') {
            error = new Error('Job Failed');
            error.name = "JobCompletionStatusCheckError";
            return callback(error);
        }

        if (payload.data.status !== 'COMPLETED') {
            error = new Error(payload.data.percent_complete);
            error.name = "JobCompletionStatusCheckPendingError";
            return callback(error);
        }

        callback(null, Object.assign({}, options, {
            themeId: payload.data.result.theme_id,
        }));
    });
}

function getThemes(options, callback) {
    Wreck.get(`${options.apiHost}/stores/${options.storeHash}/v3/themes`, {
        headers: {
            'x-auth-client': options.clientId,
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
            'x-auth-client': options.clientId,
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

function postTheme(options, callback) {
    const opts = {
        formData: {
            file: {
                options: {
                    contentType: null,
                    filename: path.basename(options.bundleZipPath),
                },
                value: fs.createReadStream(options.bundleZipPath),
            },
        },
        headers: {
            'cache-control': 'no-cache',
            'content-type': 'multipart/form-data',
            'x-auth-token': options.accessToken,
            'x-auth-client': options.clientId,
        },
        json: true,
        method: 'POST',
        url: `${options.apiHost}/stores/${options.storeHash}/v3/themes`,
    };

    request(opts, (error, response, payload) => {
        if (error) {
            return callback(error);
        }

        if (response.statusCode === 409) {
            return callback(null, { themeLimitReached: true });
        }

        if (response.statusCode === 413) {
            return callback(new Error(payload && payload.title || 'Theme Bundle Size Limit Reached'));
        }

        if (response.statusCode !== 201) {
            return callback(new Error(payload && payload.title || 'Server Error'));
        }

        callback(null, {
            jobId: payload.job_id,
        });
    });
}

