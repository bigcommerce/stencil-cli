'use strict';
const _ = require('lodash');
const async = require('async');
const Bundle = require('./stencil-bundle');
const fs = require('fs');
const Inquirer = require('inquirer');
const os = require('os');
const ProgressBar = require('progress');
const themeApiClient = require('./theme-api-client');
const themePath = process.cwd();
const themeConfig = require('./theme-config').getInstance(themePath);
const uuid = require('uuid4');
const utils = {};
const Wreck = require('wreck');

const bar = new ProgressBar('Processing [:bar] :percent; ETA: :etas', {
    complete: '=',
    incomplete: ' ',
    total: 100,
});

module.exports = utils;

function validateOptions(options, fields) {
    options = options || {};
    fields = fields || [];

    fields.forEach(field => {
        if (!_.has(options, field)) {
            throw new Error(`${field} is required!`);
        }
    });

    return options;
}

utils.readStencilConfigFile = (options, callback) => {
    options = validateOptions(options, ['dotStencilFilePath']);

    fs.readFile(options.dotStencilFilePath, { encoding: 'utf8' }, (err, data) => {
        if (err) {
            err.name = 'StencilConfigReadError';
            return callback(err);
        }

        callback(null, Object.assign({}, options, {
            config: JSON.parse(data),
        }));
    });
};

utils.getStoreHash = (options, callback) => {
    options = validateOptions(options, ['config.normalStoreUrl']);

    Wreck.get(`https://${options.config.normalStoreUrl.replace(/http(s?):\/\//, '').split('/')[0]}/admin/oauth/info`, {
        json: true,
        rejectUnauthorized: false,
    }, (error, response, payload) => {
        if (error) {
            error.name = 'StoreHashReadError';
            return callback(error);
        }

        if (response.statusCode !== 200 || !payload.store_hash) {
            const err = new Error('Failed to retrieve store hash');
            err.name = 'StoreHashReadError';
            return callback(err);
        }

        callback(null, Object.assign({}, options, { storeHash: payload.store_hash }));
    });
};

utils.getThemes = (options, callback) => {
    const config = options.config;

    themeApiClient.getThemes({
        accessToken: config.accessToken,
        apiHost: options.apiHost,
        clientId: 'stencil-cli',
        storeHash: options.storeHash,
    }, (error, result) => {
        if (error) {
            return callback(error);
        }

        callback(null, Object.assign({}, options, {
            themes: result.themes,
        }));
    });
};

utils.generateBundle = (options, callback) => {
    let bundle;
    let output = {
        dest: os.tmpdir(),
        name: uuid(),
    };

    if (options.bundleZipPath) {
        return async.nextTick(callback.bind(null, null, options));
    }

    if (options.saveBundleName) {
        output = {
            dest: themePath,
            name: options.saveBundleName,
        };
    }

    bundle = new Bundle(themePath, themeConfig, themeConfig.getRawConfig(), output);

    bundle.initBundle((err, bundleZipPath) => {
        if (err) {
            err.name = 'BundleInitError';
            return callback(err);
        }

        callback(null, Object.assign(options, { bundleZipPath: options.bundleZipPath || bundleZipPath }));
    });
};

utils.uploadBundle = (options, callback) => {
    const config = options.config;

    themeApiClient.postTheme({
        accessToken: config.accessToken,
        apiHost: options.apiHost,
        bundleZipPath: options.bundleZipPath,
        clientId: 'stencil-cli',
        storeHash: options.storeHash,
    }, (error, result) => {
        if (error) {
            error.name = 'ThemeUploadError';
            return callback(error);
        }
        callback(null, Object.assign({}, options, {
            jobId: result.jobId,
            themeLimitReached: !!result.themeLimitReached,
        }));
    });
};

utils.notifyUserOfThemeLimitReachedIfNecessary = (options, callback) => {
    if (options.themeLimitReached && !options.deleteOldest) {
        console.log('warning'.yellow + ` -- You have reached your upload limit.  In order to proceed, you'll need to delete at least one theme.`);
    }

    return async.nextTick(callback.bind(null, null, options));
};

utils.promptUserToDeleteThemesIfNecessary = (options, callback) => {
    if (!options.themeLimitReached) {
        return async.nextTick(callback.bind(null, null, options));
    }

    if (options.deleteOldest) {
        const oldestTheme = options.themes
            .filter(theme => theme.is_private && !theme.is_active)
            .map(theme => ({ uuid: theme.uuid, updated_at: new Date(theme.updated_at).valueOf() }))
            .reduce((prev, current) => prev.updated_at < current.updated_at ? prev : current);
        return callback(null, Object.assign({}, options, { themeIdsToDelete: [oldestTheme.uuid] }));
    }

    const questions = [{
        choices: options.themes.map(theme => ({
            disabled: theme.is_active || !theme.is_private,
            name: theme.name,
            value: theme.uuid,
        })),
        message: 'Which theme(s) would you like to delete?',
        name: 'themeIdsToDelete',
        type: 'checkbox',
        validate: val => {
            if (val.length > 0) {
                return true;
            } else {
                return 'You must delete at least one theme';
            }
        },
    }];

    Inquirer.prompt(questions, answers => {
        callback(null, Object.assign({}, options, answers));
    });
};

utils.deleteThemesIfNecessary = (options, callback) => {
    const config = options.config;

    if (!options.themeLimitReached) {
        return async.nextTick(callback.bind(null, null, options));
    }

    async.parallel(options.themeIdsToDelete.map(themeId => {
        return cb => {
            themeApiClient.deleteThemeById(Object.assign({
                accessToken: config.accessToken,
                apiHost: options.apiHost,
                clientId: 'stencil-cli',
                storeHash: options.storeHash,
                themeId,
            }, options), cb);
        };
    }), err => {
        if (err) {
            err.name = 'ThemeDeletionError';
            return callback(err);
        }

        callback(null, options);
    });
};

utils.uploadBundleAgainIfNecessary = (options, callback) => {
    if (!options.themeLimitReached) {
        return async.nextTick(callback.bind(null, null, options));
    }

    utils.uploadBundle(options, callback);
};

utils.notifyUserOfThemeUploadCompletion = (options, callback) => {
    console.log('ok'.green + ' -- Theme Upload Finished');
    return async.nextTick(callback.bind(null, null, options));
};

utils.markJobProgressPercentage = percentComplete => {
    bar.update(percentComplete / 100);
};

utils.markJobComplete = () => {
    utils.markJobProgressPercentage(100);
    console.log('ok'.green + ' -- Theme Processing Finished');
};

utils.pollForJobCompletion = resultFilter => {
    return async.retryable({
        interval: 1000,
        errorFilter: err => {
            if (err.name === "JobCompletionStatusCheckPendingError") {
                utils.markJobProgressPercentage(err.message);
                return true;
            }

            return false;
        },
        times: Number.POSITIVE_INFINITY,
    }, utils.checkIfJobIsComplete(resultFilter));
};

utils.checkIfJobIsComplete = resultFilter => (options, callback) => {
    const config = options.config;

    themeApiClient.getJob({
        accessToken: config.accessToken,
        apiHost: options.apiHost,
        clientId: 'stencil-cli',
        storeHash: options.storeHash,
        bundleZipPath: options.bundleZipPath,
        jobId: options.jobId,
        resultFilter,
    }, (error, result) => {
        if (error) {
            return callback(error);
        }

        utils.markJobComplete();

        callback(null, Object.assign({}, options, result));
    });
};

utils.promptUserWhetherToApplyTheme = (options, callback) => {
    if (options.activate) {
        callback(null, Object.assign({}, options, { applyTheme: true }));
    } else {
        const questions = [{
            type: 'confirm',
            name: 'applyTheme',
            message: `Would you like to apply your theme to your store at ${options.config.normalStoreUrl}?`,
            default: false,
        }];

        Inquirer.prompt(questions, answers => {
            callback(null, Object.assign({}, options, { applyTheme: answers.applyTheme }));
        });
    }
};

utils.getVariations = (options, callback) => {
    if (!options.applyTheme) {
        return async.nextTick(callback.bind(null, null, options));
    }

    themeApiClient.getVariationsByThemeId({
        accessToken: options.accessToken,
        apiHost: options.apiHost,
        clientId: 'stencil-cli',
        themeId: options.themeId,
        storeHash: options.storeHash,
    }, (error, result) => {
        if (error) {
            return callback(error);
        }
        if (options.activate !== true && options.activate !== undefined) {
            const findVariation = result.variations.find(item => item.name === options.activate);
            if (!findVariation || !findVariation.uuid) {
                throw new Error(`Invalid theme variation provided!. Available options${result.variations.map(item => ` ${item.name}`).join(',')}...`);
            }
            callback(null, Object.assign({}, options, { variationId: findVariation.uuid }));
        } else if (options.activate === true) {
            callback(null, Object.assign({}, options, { variationId: result.variations[0].uuid }));
        } else {
            callback(null, Object.assign({}, options, result));
        }
    });
};

utils.promptUserForVariation = (options, callback) => {
    if (!options.applyTheme) {
        return async.nextTick(callback.bind(null, null, options));
    }

    if (options.variationId) {
        callback(null, options);
    } else {
        const questions = [{
            type: 'list',
            name: 'variationId',
            message: 'Which variation would you like to apply?',
            choices: options.variations.map(variation => ({ name: variation.name, value: variation.uuid })),
        }];

        Inquirer.prompt(questions, answers => {
            callback(null, Object.assign({}, options, answers));
        });
    }
};

utils.requestToApplyVariationWithRetrys = () => {
    return async.retryable({
        interval: 1000,
        errorFilter: err => {
            if (err.name === "VariationActivationTimeoutError") {
                console.log('warning'.yellow + ` -- Theme Activation Timed Out; Retrying...`);
                return true;
            }

            return false;
        },
        times: 3,
    }, utils.requestToApplyVariation);
};

utils.requestToApplyVariation = (options, callback) => {
    if (!options.applyTheme) {
        return async.nextTick(callback.bind(null, null, options));
    }

    themeApiClient.activateThemeByVariationId({
        accessToken: options.accessToken,
        apiHost: options.apiHost,
        clientId: 'stencil-cli',
        storeHash: options.storeHash,
        variationId: options.variationId,
    }, (error, result) => {
        if (error) {
            return callback(error);
        }

        callback(null, Object.assign({}, options, result));
    });
};

utils.notifyUserOfCompletion = (options, callback) => {
    callback(null, 'Stencil Push Finished');
};
