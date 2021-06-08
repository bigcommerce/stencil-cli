require('colors');
const BrowserSync = require('browser-sync');
const { promisify } = require('util');
const path = require('path');

const Cycles = require('./Cycles');
const templateAssemblerModule = require('./template-assembler');
const { THEME_PATH } = require('../constants');
const Server = require('../server');
const StencilConfigManager = require('./StencilConfigManager');
const ThemeConfig = require('./theme-config');
const BuildConfigManager = require('./BuildConfigManager');
const fsUtilsModule = require('./utils/fsUtils');
const stencilPushUtilsModule = require('./stencil-push.utils');
const cliCommonModule = require('./cliCommon');
const themeApiClientModule = require('./theme-api-client');

class StencilStart {
    constructor({
        browserSync = BrowserSync.create(),
        themeApiClient = themeApiClientModule,
        fsUtils = fsUtilsModule,
        cliCommon = cliCommonModule,
        stencilConfigManager = new StencilConfigManager(),
        themeConfigManager = ThemeConfig.getInstance(THEME_PATH),
        buildConfigManger = new BuildConfigManager(),
        templateAssembler = templateAssemblerModule,
        CyclesDetector = Cycles,
        stencilPushUtils = stencilPushUtilsModule,
        logger = console,
    } = {}) {
        this._browserSync = browserSync;
        this._themeApiClient = themeApiClient;
        this._fsUtils = fsUtils;
        this._cliCommon = cliCommon;
        this._stencilConfigManager = stencilConfigManager;
        this._themeConfigManager = themeConfigManager;
        this._buildConfigManger = buildConfigManger;
        this._templateAssembler = templateAssembler;
        this._CyclesDetector = CyclesDetector;
        this._stencilPushUtils = stencilPushUtils;
        this._logger = logger;
    }

    async run(cliOptions) {
        this.runBasicChecks(cliOptions);

        if (cliOptions.variation) {
            await this._themeConfigManager.setVariationByName(cliOptions.variation);
        }
        const initialStencilConfig = await this._stencilConfigManager.read();
        // Use initial (before updates) port for BrowserSync
        const browserSyncPort = initialStencilConfig.port;

        const channelUrl = await this.getChannelUrl(initialStencilConfig, cliOptions);

        const storeInfoFromAPI = await this._themeApiClient.checkCliVersion({
            storeUrl: channelUrl,
        });
        const updatedStencilConfig = this.updateStencilConfig(
            initialStencilConfig,
            storeInfoFromAPI,
        );

        await this.startLocalServer(cliOptions, updatedStencilConfig);

        this._logger.log(this.getStartUpInfo(updatedStencilConfig));

        await this.startBrowserSync(cliOptions, updatedStencilConfig, browserSyncPort);
    }

    async getChannelUrl(stencilConfig, cliOptions) {
        const { accessToken } = stencilConfig;
        const { apiHost } = cliOptions;
        const storeHash = await this._themeApiClient.getStoreHash({
            storeUrl: stencilConfig.normalStoreUrl,
        });
        const channels = await this._themeApiClient.getStoreChannels({
            storeHash,
            accessToken,
            apiHost,
        });

        const channelId = cliOptions.channelId
            ? cliOptions.channelId
            : await this._stencilPushUtils.promptUserToSelectChannel(channels);

        const foundChannel = channels.find(
            (channel) => channel.channel_id === parseInt(channelId, 10),
        );
        return foundChannel ? foundChannel.url : null;
    }

    /**
     * @param {Object} cliOptions
     */
    runBasicChecks(cliOptions) {
        this._cliCommon.checkNodeVersion();

        if (!this._fsUtils.existsSync(this._themeConfigManager.configPath)) {
            throw new Error(
                'You must have a '.red +
                    ' config.json '.cyan +
                    'file in your top level theme directory.',
            );
        }

        // If the value is true it means that no variation was passed in.
        if (cliOptions.variation === true) {
            throw new Error('You have to specify a value for -v or --variation'.red);
        }
    }

    updateStencilConfig(stencilConfig, storeInfoFromAPI) {
        return {
            ...stencilConfig,
            storeUrl: storeInfoFromAPI.sslUrl,
            normalStoreUrl: storeInfoFromAPI.baseUrl,
            port: Number(stencilConfig.port) + 1,
        };
    }

    /**
     * @param {Object} cliOptions
     * @param {Object} stencilConfig
     * @return {Promise<any>}
     */
    async startLocalServer(cliOptions, stencilConfig) {
        return Server.create({
            dotStencilFile: stencilConfig,
            variationIndex: this._themeConfigManager.variationIndex || 0,
            useCache: cliOptions.cache,
            themePath: this._themeConfigManager.themePath,
        });
    }

    async startBrowserSync(cliOptions, stencilConfig, browserSyncPort) {
        const DEFAULT_WATCH_FILES = ['/assets', '/templates', '/lang', '/.config'];
        const DEFAULT_WATCH_IGNORED = ['/assets/scss', '/assets/css'];
        const { themePath, configPath } = this._themeConfigManager;
        const { watchOptions } = this._buildConfigManger;

        // Watch sccs directory and automatically reload all css files if a file changes
        const stylesPath = path.join(themePath, 'assets/scss');
        this._browserSync.watch(stylesPath, (event) => {
            if (event === 'change') {
                this._browserSync.reload('*.css');
            }
        });

        this._browserSync.watch(configPath, (event) => {
            if (event === 'change') {
                this._themeConfigManager.resetVariationSettings();
                this._browserSync.reload();
            }
        });

        const storefrontConfigPath = path.join(themePath, '.config/storefront.json');
        this._browserSync.watch(storefrontConfigPath, (event, file) => {
            if (event === 'change') {
                this._logger.log('storefront.json changed');
                this._browserSync.emitter.emit('storefront_config_file:changed', {
                    event,
                    path: file,
                    namespace: '',
                });
                this._browserSync.reload();
            }
        });

        const templatesPath = path.join(themePath, 'templates');
        this._browserSync.watch(templatesPath, { ignoreInitial: true }, async () => {
            try {
                const results = await this.assembleTemplates(templatesPath);
                new this._CyclesDetector(results).detect();
            } catch (e) {
                this._logger.error(e);
            }
        });

        // tunnel value should be true/false or a string with name
        // https://browsersync.io/docs/options#option-tunnel
        // convert undefined/true -> false/true
        const tunnel =
            typeof cliOptions.tunnel === 'string' ? cliOptions.tunnel : Boolean(cliOptions.tunnel);
        const watchFiles = (watchOptions && watchOptions.files) || DEFAULT_WATCH_FILES;
        const watchIgnored = (watchOptions && watchOptions.ignored) || DEFAULT_WATCH_IGNORED;

        this._browserSync.init({
            open: !!cliOptions.open,
            port: browserSyncPort,
            files: watchFiles.map((val) => path.join(themePath, val)),
            watchOptions: {
                ignoreInitial: true,
                ignored: watchIgnored.map((val) => path.join(themePath, val)),
            },
            proxy: `localhost:${stencilConfig.port}`,
            tunnel,
        });

        // Handle manual reloading of browsers by typing 'rs';
        // Borrowed from https://github.com/remy/nodemon
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (data) => {
            const normalizedData = `${data}`.trim().toLowerCase();

            // if the keys entered match the restartable value, then restart!
            if (normalizedData === 'rs') {
                this._browserSync.reload();
            }
        });

        if (this._buildConfigManger.development) {
            this._buildConfigManger.initWorker().development(this._browserSync);
        }
    }

    /**
     * Assembles all the needed templates and resolves their partials.
     *
     * @param {string} templatesPath
     * @returns {object[]}
     */
    async assembleTemplates(templatesPath) {
        const filesPaths = await this._fsUtils.recursiveReadDir(templatesPath, ['!*.html']);
        const templateNames = filesPaths.map((file) =>
            file.replace(templatesPath + path.sep, '').replace('.html', ''),
        );

        return Promise.all(
            templateNames.map(async (templateName) =>
                promisify(this._templateAssembler.assemble)(templatesPath, templateName),
            ),
        );
    }

    /**
     * Displays information about your environment and configuration.
     * @param {Object} stencilConfig
     * @returns {string}
     */
    getStartUpInfo(stencilConfig) {
        const {
            configPath,
            secretsPath,
            configFileName,
            secretsFileName,
        } = this._stencilConfigManager;
        let information = '\n';

        information += '-----------------Startup Information-------------\n'.gray;
        information += '\n';
        information += `${configFileName} location: ${configPath.cyan}\n`;
        information += `${secretsFileName} location: ${secretsPath.cyan}\n`;
        information += `config.json location: ${this._themeConfigManager.configPath.cyan}\n`;
        information += `Store URL: ${stencilConfig.normalStoreUrl.cyan}\n`;

        information += `SSL Store URL: ${stencilConfig.storeUrl.cyan}\n`;
        information += `Node Version: ${process.version.cyan}\n`;
        information += '\n';
        information += '-------------------------------------------------\n'.gray;

        return information;
    }
}

module.exports = StencilStart;
