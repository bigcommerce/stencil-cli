import * as fs from 'fs';
import * as _ from 'lodash-es';
import themeApiClient from './theme-api-client.js';
import { parseJsonFile } from './utils/fsUtils.js';

const utils = {};
utils.getChannelActiveTheme = async (options) => {
    const {
        config: { accessToken },
        storeHash,
        channelId,
    } = options;
    const apiHost = options.apiHost || options.config.apiHost;
    const activeTheme = await themeApiClient.getChannelActiveTheme({
        accessToken,
        apiHost,
        storeHash,
        channelId,
    });
    console.log('ok'.green + ` -- Fetched theme details for channel ${channelId}`);
    return { ...options, activeTheme };
};
utils.getCurrentVariation = async (options) => {
    const {
        config: { accessToken },
        storeHash,
        activeTheme,
        saved,
        remoteThemeConfiguration,
    } = options;
    const apiHost = options.apiHost || options.config.apiHost;
    const themeId = activeTheme.active_theme_uuid;
    const variations = await themeApiClient.getVariationsByThemeId({
        accessToken,
        apiHost,
        storeHash,
        themeId,
    });
    const variation = variations.find((v) => v.uuid === remoteThemeConfiguration.variation_uuid);
    console.log('ok'.green + ` -- Fetched ${saved ? 'saved' : 'active'} variation name`);
    return { ...options, variation };
};
utils.getThemeConfiguration = async (options) => {
    const {
        config: { accessToken },
        storeHash,
        activeTheme,
        saved,
    } = options;
    const apiHost = options.apiHost || options.config.apiHost;
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
    const variation = localConfig.variations.find((v) => v.name === options.variation.name);
    let diffDetected = false;
    // For any keys the remote configuration has in common with the local configuration,
    // overwrite the local configuration if the remote configuration differs
    for (const [key, remoteVal] of Object.entries(remoteThemeConfiguration.settings)) {
        if (!(key in localConfig.settings)) {
            continue;
        }
        const defaultVal = localConfig.settings[key];
        // Check for different types, and throw an error if they are found
        if (typeof defaultVal !== typeof remoteVal) {
            throw new Error(
                `Theme configuration key "${key}" cannot be merged because it is not of the same type. ` +
                    `Remote configuration is of type ${typeof remoteVal} while local configuration is of type ${typeof defaultVal}.`,
            );
        }
        // If a different value is found, overwrite the local config
        if (!_.isEqual(defaultVal, remoteVal)) {
            if (!variation.settings) {
                variation.settings = {};
            }
            variation.settings[key] = remoteVal;
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
export default utils;
