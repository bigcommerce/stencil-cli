const _ = require('lodash');
const async = require('async');
const Inquirer = require('inquirer');
const ProgressBar = require('progress');
const uuid = require('uuid4');
const os = require('os');

const { THEME_PATH } = require('../constants');
const Bundle = require('./stencil-bundle');
const themeApiClient = require('./theme-api-client');
const ThemeConfig = require('./theme-config');
const StencilConfigManager = require('./StencilConfigManager');

const themeConfigManager = ThemeConfig.getInstance(THEME_PATH);
const stencilConfigManager = new StencilConfigManager();
const utils = {};

const bar = new ProgressBar('Processing [:bar] :percent; ETA: :etas', {
    complete: '=',
    incomplete: ' ',
    total: 100,
});

function validateOptions(options = {}, fields = []) {
    for (const field of fields) {
        if (!_.has(options, field)) {
            throw new Error(`${field} is required!`);
        }
    }
}

utils.readStencilConfigFile = async (options) => {
    try {
        const config = await stencilConfigManager.read();
        return { ...options, config };
    } catch (err) {
        err.name = 'StencilConfigReadError';
        throw err;
    }
};

utils.getStoreHash = async (options) => {
    validateOptions(options, ['config.normalStoreUrl']);

    const storeHash = await themeApiClient.getStoreHash({
        storeUrl: options.config.normalStoreUrl,
    });

    return { ...options, storeHash };
};

utils.getThemes = async (options) => {
    const {
        config: { accessToken },
        storeHash,
    } = options;

    const apiHost = options.apiHost || options.config.apiHost;

    const themes = await themeApiClient.getThemes({ accessToken, apiHost, storeHash });

    return { ...options, themes };
};

utils.generateBundle = async (options) => {
    if (options.bundleZipPath) {
        return options;
    }

    const output = options.saveBundleName
        ? { dest: THEME_PATH, name: options.saveBundleName }
        : { dest: os.tmpdir(), name: uuid() };
    const rawConfig = await themeConfigManager.getRawConfig();
    const bundle = new Bundle(THEME_PATH, themeConfigManager, rawConfig, output);

    try {
        const bundleZipPath = await bundle.initBundle();
        return { ...options, bundleZipPath };
    } catch (err) {
        err.name = 'BundleInitError';
        throw err;
    }
};

utils.uploadBundle = async (options) => {
    const {
        config: { accessToken },
        bundleZipPath,
        storeHash,
        uploadBundleAgain,
    } = options;

    const apiHost = options.apiHost || options.config.apiHost;

    try {
        const result = await themeApiClient.postTheme({
            accessToken,
            apiHost,
            bundleZipPath,
            storeHash,
            uploadBundleAgain,
        });
        return {
            ...options,
            jobId: result.jobId,
            themeLimitReached: !!result.themeLimitReached,
        };
    } catch (err) {
        err.name = 'ThemeUploadError';
        throw err;
    }
};

utils.notifyUserOfThemeLimitReachedIfNecessary = async (options) => {
    if (options.themeLimitReached && !options.deleteOldest) {
        console.log(
            'warning'.yellow +
                ' -- You have reached your upload limit. ' +
                "In order to proceed, you'll need to delete at least one theme.",
        );
    }

    return options;
};

utils.promptUserToDeleteThemesIfNecessary = async (options) => {
    if (!options.themeLimitReached) {
        return options;
    }

    if (options.deleteOldest) {
        const oldestTheme = options.themes
            .filter((theme) => theme.is_private && !theme.is_active)
            .map((theme) => ({
                uuid: theme.uuid,
                updated_at: new Date(theme.updated_at).valueOf(),
            }))
            .reduce((prev, current) => (prev.updated_at < current.updated_at ? prev : current));

        return { ...options, themeIdsToDelete: [oldestTheme.uuid] };
    }

    const questions = [
        {
            choices: options.themes.map((theme) => ({
                disabled: theme.is_active || !theme.is_private,
                name: theme.name,
                value: theme.uuid,
            })),
            message: 'Which theme(s) would you like to delete?',
            name: 'themeIdsToDelete',
            type: 'checkbox',
            validate: (val) => {
                if (val.length > 0) {
                    return true;
                }
                return 'You must delete at least one theme';
            },
        },
    ];
    const answers = await Inquirer.prompt(questions);

    return { ...options, ...answers };
};

utils.deleteThemesIfNecessary = async (options) => {
    const {
        config: { accessToken },
        storeHash,
        themeLimitReached,
        themeIdsToDelete,
    } = options;

    const apiHost = options.apiHost || options.config.apiHost;

    if (!themeLimitReached) {
        return options;
    }

    try {
        const promises = themeIdsToDelete.map((themeId) =>
            themeApiClient.deleteThemeById({ accessToken, apiHost, storeHash, themeId }),
        );
        await Promise.all(promises);
    } catch (err) {
        err.name = 'ThemeDeletionError';
        throw err;
    }

    return options;
};

utils.checkIfDeletionIsComplete = () => {
    return async.retryable(
        {
            interval: 1000,
            errorFilter: (err) => {
                if (err.message === 'ThemeStillExists') {
                    console.log(`${'warning'.yellow} -- Theme still exists;Retrying ...`);
                    return true;
                }
                return false;
            },
            times: 5,
        },
        utils.checkIfThemeIsDeleted(),
    );
};

utils.checkIfThemeIsDeleted = () => async (options) => {
    const {
        themeLimitReached,
        config: { accessToken },
        storeHash,
        themeIdsToDelete,
    } = options;

    if (!themeLimitReached) {
        return options;
    }

    const apiHost = options.apiHost || options.config.apiHost;

    const result = await themeApiClient.getThemes({ accessToken, apiHost, storeHash });

    const themeStillExists = result.some((theme) => themeIdsToDelete.includes(theme.uuid));

    if (themeStillExists) {
        throw new Error('ThemeStillExists');
    }

    return options;
};

utils.uploadBundleAgainIfNecessary = async (options) => {
    if (!options.themeLimitReached) {
        return options;
    }

    return utils.uploadBundle({ ...options, uploadThemeAgain: true });
};

utils.notifyUserOfThemeUploadCompletion = async (options) => {
    console.log(`${'ok'.green} -- Theme Upload Finished`);

    return options;
};

utils.markJobProgressPercentage = (percentComplete) => {
    bar.update(percentComplete / 100);
};

utils.markJobComplete = () => {
    utils.markJobProgressPercentage(100);
    console.log(`${'ok'.green} -- Theme Processing Finished`);
};

utils.pollForJobCompletion = (resultFilter) => {
    return async.retryable(
        {
            interval: 1000,
            errorFilter: (err) => {
                if (err.name === 'JobCompletionStatusCheckPendingError') {
                    utils.markJobProgressPercentage(err.message);
                    return true;
                }

                return false;
            },
            times: Number.POSITIVE_INFINITY,
        },
        utils.checkIfJobIsComplete(resultFilter),
    );
};

utils.checkIfJobIsComplete = (resultFilter) => async (options) => {
    const {
        config: { accessToken },
        storeHash,
        bundleZipPath,
        jobId,
    } = options;

    const apiHost = options.apiHost || options.config.apiHost;

    const result = await themeApiClient.getJob({
        accessToken,
        apiHost,
        storeHash,
        bundleZipPath,
        jobId,
        resultFilter,
    });

    utils.markJobComplete();

    return { ...options, ...result };
};

utils.promptUserWhetherToApplyTheme = async (options) => {
    if (options.activate) {
        return { ...options, applyTheme: true };
    }

    const questions = [
        {
            type: 'confirm',
            name: 'applyTheme',
            message: `Would you like to apply your theme to your store?`,
            default: false,
        },
    ];
    const answers = await Inquirer.prompt(questions);

    return { ...options, ...answers };
};

utils.getChannels = async (options) => {
    const {
        config: { accessToken },
        channelId,
        channelIds,
        storeHash,
        applyTheme,
    } = options;

    const apiHost = options.apiHost || options.config.apiHost;

    if (!applyTheme || channelIds || channelId) {
        return options;
    }

    const channels = await themeApiClient.getStoreChannels({
        accessToken,
        apiHost,
        storeHash,
    });

    return { ...options, channels };
};

utils.getVariations = async (options) => {
    const {
        config: { accessToken },
        storeHash,
        themeId,
        applyTheme,
        activate,
    } = options;

    const apiHost = options.apiHost || options.config.apiHost;

    if (!applyTheme) {
        return options;
    }

    const variations = await themeApiClient.getVariationsByThemeId({
        accessToken,
        apiHost,
        themeId,
        storeHash,
    });

    // Activate the default variation
    if (activate === true) {
        return { ...options, variationId: variations[0].uuid };
    }
    // Activate the specified variation
    if (activate !== undefined) {
        const foundVariation = variations.find((item) => item.name === activate);

        if (!foundVariation || !foundVariation.uuid) {
            const availableOptionsStr = variations.map((item) => `${item.name}`).join(', ');
            throw new Error(
                `Invalid theme variation provided! Available options: ${availableOptionsStr}.`,
            );
        }

        return { ...options, variationId: foundVariation.uuid };
    }

    // Didn't specify a variation explicitly, will ask the user later
    return { ...options, variations };
};

utils.promptUserForChannels = async (options) => {
    const { applyTheme, channelIds, channels, allChannels } = options;

    if (!applyTheme || channelIds) {
        return options;
    }

    if (allChannels) {
        const allIds = channels.map((chanel) => chanel.channel_id);
        return { ...options, channelIds: allIds };
    }

    const selectedChannelIds = await utils.promptUserToSelectChannels(channels);
    return { ...options, channelIds: selectedChannelIds };
};

utils.promptUserToSelectChannels = async (channels) => {
    if (channels.length < 2) {
        return [channels[0].channel_id];
    }

    const questions = [
        {
            type: 'checkbox',
            name: 'channelIds',
            message: 'Which channel(s) would you like to use?',
            choices: channels.map((channel) => ({
                name: channel.url,
                value: channel.channel_id,
            })),
        },
    ];

    const answer = await Inquirer.prompt(questions);
    return answer.channelIds;
};

utils.promptUserForChannel = async (options) => {
    const { applyTheme, channelId, channels } = options;

    if (!applyTheme || channelId) {
        return options;
    }

    const selectedChannelId = await utils.promptUserToSelectChannel(channels);
    return { ...options, channelId: selectedChannelId };
};

utils.promptUserToSelectChannel = async (channels) => {
    if (channels.length < 2) {
        return channels[0].channel_id;
    }

    const questions = [
        {
            type: 'list',
            name: 'channelId',
            message: 'Which channel would you like to use?',
            choices: channels.map((channel) => ({
                name: `${channel.url} [${channel.channel_id}] `,
                value: channel.channel_id,
            })),
        },
    ];

    const answer = await Inquirer.prompt(questions);
    return answer.channelId;
};

utils.promptUserForVariation = async (options) => {
    if (!options.applyTheme || options.variationId) {
        return options;
    }

    const questions = [
        {
            type: 'list',
            name: 'variationId',
            message: 'Which variation would you like to apply?',
            choices: options.variations.map((variation) => ({
                name: variation.name,
                value: variation.uuid,
            })),
        },
    ];
    const answers = await Inquirer.prompt(questions);

    return { ...options, ...answers };
};

utils.requestToApplyVariationWithRetrys = () => {
    return async.retryable(
        {
            interval: 1000,
            errorFilter: (err) => {
                if (err.name === 'VariationActivationTimeoutError') {
                    console.log(`${'warning'.yellow} -- Theme Activation Timed Out; Retrying...`);
                    return true;
                }

                return false;
            },
            times: 3,
        },
        utils.requestToApplyVariation,
    );
};

utils.requestToApplyVariation = async (options) => {
    const {
        config: { accessToken },
        storeHash,
        variationId,
        channelIds,
    } = options;

    const apiHost = options.apiHost || options.config.apiHost;

    if (options.applyTheme) {
        await themeApiClient.activateThemeByVariationId({
            variationId,
            channelIds,
            apiHost,
            storeHash,
            accessToken,
        });
    }

    return options;
};

utils.notifyUserOfCompletion = (options, callback) => {
    callback(null, `Stencil Push Finished. Variation ID: ${options.variationId}`);
};

module.exports = utils;
