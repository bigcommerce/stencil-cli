const fs = require('fs');
const _ = require('lodash');
const themeApiClient = require('./theme-api-client');
const { parseJsonFile } = require('./utils/fsUtils');

const utils = {};

utils.getChannelActiveTheme = async (options) => {
    const {
        config: { accessToken },
        apiHost,
        storeHash,
        channelId,
    } = options;

    const activeTheme = await themeApiClient.getChannelActiveTheme({
        accessToken,
        apiHost,
        storeHash,
        channelId,
    });

    console.log('ok'.green + ` -- Fetched theme details for channel ${channelId}`);

    return { ...options, activeTheme };
};

utils.getThemeConfiguration = async (options) => {
    const {
        config: { accessToken },
        apiHost,
        storeHash,
        activeTheme,
        saved,
    } = options;

    const themeId = activeTheme.active_theme_uuid;

    const configurationId = saved
        ? activeTheme.saved_theme_configuration_uuid
        : activeTheme.active_theme_configuration_uuid;

    const remoteThemeConfiguration = await themeApiClient.getThemeConfiguration({
        accessToken,
        apiHost,
        storeHash,
        themeId,
        configurationId,
    });

    console.log('ok'.green + ` -- Fetched ${saved ? 'saved' : 'active'} configuration`);

    return { ...options, remoteThemeConfiguration };
};

utils.mergeThemeConfiguration = async (options) => {
    const { remoteThemeConfiguration } = options;

    const localConfig = await parseJsonFile('config.json');
    let diffDetected = false;

    // For any keys the remote configuration has in common with the local configuration,
    // overwrite the local configuration if the remote configuration differs
    for (const [key, remoteVal] of Object.entries(remoteThemeConfiguration.settings)) {
        if (!(key in localConfig.settings)) {
            continue;
        }
        const localVal = localConfig.settings[key];

        // Check for different types, and throw an error if they are found
        if (typeof localVal !== typeof remoteVal) {
            throw new Error(
                `Theme configuration key "${key}" cannot be merged because it is not of the same type. ` +
                    `Remote configuration is of type ${typeof remoteVal} while local configuration is of type ${typeof localVal}.`,
            );
        }

        // If a different value is found, overwrite the local config
        if (!_.isEqual(localVal, remoteVal)) {
            localConfig.settings[key] = remoteVal;
            diffDetected = true;
        }
    }

    // Does a file need to be written?
    if (diffDetected || options.saveConfigName !== 'config.json') {
        if (diffDetected) {
            console.log('ok'.green + ' -- Remote configuration merged with local configuration');
        } else {
            console.log(
                'ok'.green + ' -- Remote and local configurations are in sync for all common keys',
            );
        }

        await fs.promises.writeFile(options.saveConfigName, JSON.stringify(localConfig, null, 2));
        console.log('ok'.green + ` -- Configuration written to ${options.saveConfigName}`);
    } else {
        console.log(
            'ok'.green +
                ` -- Remote and local configurations are in sync for all common keys, no action taken`,
        );
    }

    return options;
};

module.exports = utils;
