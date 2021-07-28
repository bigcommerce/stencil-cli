const fsModule = require('fs');
const _ = require('lodash');
const StencilConfigManager = require('./StencilConfigManager');
const themeApiClientModule = require('./theme-api-client');
const stencilPushUtilsModule = require('./stencil-push.utils');
const fsUtilsModule = require('./utils/fsUtils');

require('colors');

class StencilPull {
    constructor({
        stencilConfigManager = new StencilConfigManager(),
        themeApiClient = themeApiClientModule,
        stencilPushUtils = stencilPushUtilsModule,
        fsUtils = fsUtilsModule,
        fs = fsModule,
    } = {}) {
        this._stencilConfigManager = stencilConfigManager;
        this._themeApiClient = themeApiClient;
        this._stencilPushUtils = stencilPushUtils;
        this._fsUtils = fsUtils;
        this._fs = fs;
    }

    /**
     * @param {Object} cliOptions
     */
    async run(cliOptions) {
        const stencilConfig = await this._stencilConfigManager.read();
        const storeHash = await this._themeApiClient.getStoreHash({
            storeUrl: stencilConfig.normalStoreUrl,
        });

        let { channelId } = cliOptions;
        if (!channelId) {
            const channels = await this._themeApiClient.getStoreChannels({
                accessToken: stencilConfig.accessToken,
                apiHost: cliOptions.apiHost,
                storeHash,
            });

            channelId = await this._stencilPushUtils.promptUserToSelectChannel(channels);
        }

        const activeTheme = await this.getActiveTheme({
            accessToken: stencilConfig.accessToken,
            apiHost: cliOptions.apiHost,
            storeHash,
            channelId,
        });

        console.log('ok'.green + ` -- Fetched theme details for channel ${channelId}`);

        const variations = await this._themeApiClient.getVariationsByThemeId({
            accessToken: stencilConfig.accessToken,
            apiHost: cliOptions.apiHost,
            themeId: activeTheme.active_theme_uuid,
            storeHash,
        });

        const variationId = this._stencilPushUtils.getActivatedVariation(
            variations,
            cliOptions.activate,
        );

        const remoteThemeConfiguration = await this.getThemeConfiguration({
            saved: cliOptions.saved,
            activeTheme,
            accessToken: stencilConfig.accessToken,
            apiHost: cliOptions.apiHost,
            storeHash,
            variationId,
        });

        console.log(
            'ok'.green + ` -- Fetched ${cliOptions.saved ? 'saved' : 'active'} configuration`,
        );

        await this.mergeThemeConfiguration({
            variationId,
            activate: cliOptions.activate,
            remoteThemeConfiguration,
            saveConfigName: cliOptions.saveConfigName,
        });

        return true;
    }

    /**
     * @param {Object} options
     * @param {String} options.accessToken
     * @param {String} options.apiHost
     * @param {String} options.storeHash
     * @param {Number} options.channelId
     */
    async getActiveTheme({ accessToken, apiHost, storeHash, channelId }) {
        const activeTheme = await this._themeApiClient.getChannelActiveTheme({
            accessToken,
            apiHost,
            storeHash,
            channelId,
        });

        return activeTheme;
    }

    /**
     * @param {Object} options
     * @param {Boolean} options.saved
     * @param {Object} options.activeTheme
     * @param {String} options.accessToken
     * @param {String} options.apiHost
     * @param {String} options.storeHash
     * @param {String} options.variationId
     */
    async getThemeConfiguration({
        saved,
        activeTheme,
        accessToken,
        apiHost,
        storeHash,
        variationId,
    }) {
        const configurationId = saved
            ? activeTheme.saved_theme_configuration_uuid
            : activeTheme.active_theme_configuration_uuid;

        const remoteThemeConfiguration = await this._themeApiClient.getThemeConfiguration({
            accessToken,
            apiHost,
            storeHash,
            themeId: activeTheme.active_theme_uuid,
            configurationId,
            variationId,
        });

        return remoteThemeConfiguration;
    }

    /**
     * @param {Object} options
     * @param {String} options.variationId
     * @param {String} options.activate
     * @param {Object} options.remoteThemeConfiguration
     * @param {Object} options.remoteThemeConfiguration
     */
    async mergeThemeConfiguration({
        variationId,
        activate,
        remoteThemeConfiguration,
        saveConfigName,
    }) {
        const localConfig = await this._fsUtils.parseJsonFile('config.json');
        let diffDetected = false;
        let { settings } = localConfig;

        if (variationId) {
            ({ settings } = localConfig.variations.find((v) => v.name === activate));
        }

        // For any keys the remote configuration has in common with the local configuration,
        // overwrite the local configuration if the remote configuration differs
        for (const [key, remoteVal] of Object.entries(remoteThemeConfiguration.settings)) {
            if (!(key in settings)) {
                continue;
            }
            const localVal = settings[key];

            // Check for different types, and throw an error if they are found
            if (typeof localVal !== typeof remoteVal) {
                throw new Error(
                    `Theme configuration key "${key}" cannot be merged because it is not of the same type. ` +
                        `Remote configuration is of type ${typeof remoteVal} while local configuration is of type ${typeof localVal}.`,
                );
            }

            // If a different value is found, overwrite the local config
            if (!_.isEqual(localVal, remoteVal)) {
                settings[key] = remoteVal;
                diffDetected = true;
            }
        }

        // Does a file need to be written?
        if (diffDetected || saveConfigName !== 'config.json') {
            if (diffDetected) {
                console.log(
                    'ok'.green + ' -- Remote configuration merged with local configuration',
                );
            } else {
                console.log(
                    'ok'.green +
                        ' -- Remote and local configurations are in sync for all common keys',
                );
            }

            await this._fs.promises.writeFile(saveConfigName, JSON.stringify(localConfig, null, 2));
            console.log('ok'.green + ` -- Configuration written to ${saveConfigName}`);
        } else {
            console.log(
                'ok'.green +
                    ` -- Remote and local configurations are in sync for all common keys, no action taken`,
            );
        }
    }
}

module.exports = StencilPull;
