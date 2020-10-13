require('colors');
const browserSyncInstance = require('browser-sync').create();
const { promisify } = require('util');
const fetchModule = require('node-fetch');
const fsModule = require('fs');
const path = require('path');

const Cycles = require('./Cycles');
const templateAssemblerModule = require('./template-assembler');
const { THEME_PATH } = require('../constants');
const Server = require('../server');
const ThemeConfig = require('./theme-config');
const BuildConfigManager = require('./BuildConfigManager');
const fsUtilsModule = require('./utils/fsUtils');
const cliCommonModule = require('./cliCommon');

const themeConfigManagerInstance = ThemeConfig.getInstance(THEME_PATH);
const buildConfigManagerInstance = new BuildConfigManager({ fs: fsModule, workDir: THEME_PATH });

class StencilStart {
    constructor({
        browserSync = browserSyncInstance,
        fetch = fetchModule,
        fs = fsModule,
        fsUtils = fsUtilsModule,
        cliCommon = cliCommonModule,
        themeConfigManager = themeConfigManagerInstance,
        buildConfigManger = buildConfigManagerInstance,
        templateAssembler = templateAssemblerModule,
        CyclesDetector = Cycles,
        logger = console,
    } = {}) {
        this.browserSync = browserSync;
        this.fetch = fetch;
        this.fs = fs;
        this.fsUtils = fsUtils;
        this.cliCommon = cliCommon;
        this.themeConfigManager = themeConfigManager;
        this.buildConfigManger = buildConfigManger;
        this.templateAssembler = templateAssembler;
        this.CyclesDetector = CyclesDetector;
        this.logger = logger;
    }

    async run(cliOptions, dotStencilFilePath, stencilCliVersion) {
        this.performChecks(cliOptions, dotStencilFilePath);

        if (cliOptions.variation) {
            await this.themeConfigManager.setVariationByName(cliOptions.variation);
        }

        const stencilConfig = await this.fsUtils.parseJsonFile(dotStencilFilePath);
        const browserSyncPort = stencilConfig.port;
        stencilConfig.port = Number(stencilConfig.port) + 1;

        if (!stencilConfig.normalStoreUrl || !stencilConfig.customLayouts) {
            throw new Error(
                'Error: Your stencil config is outdated. Please run'.red +
                    ' $ stencil init'.cyan +
                    ' again.'.red,
            );
        }

        const storeInfoFromAPI = await this.runAPICheck(stencilConfig, stencilCliVersion);

        const updatedStencilConfig = {
            ...stencilConfig,
            storeUrl: storeInfoFromAPI.sslUrl,
            normalStoreUrl: storeInfoFromAPI.baseUrl,
        };

        await this.startLocalServer(cliOptions, updatedStencilConfig);

        this.logger.log(this.getStartUpInfo(updatedStencilConfig, dotStencilFilePath));

        await this.startBrowserSync(cliOptions, updatedStencilConfig, browserSyncPort);
    }

    /**
     * @param {Object} cliOptions
     * @param {string} dotStencilFilePath
     */
    performChecks(cliOptions, dotStencilFilePath) {
        this.cliCommon.checkNodeVersion();

        if (!this.fs.existsSync(dotStencilFilePath)) {
            throw new Error('Please run'.red + ' $ stencil init'.cyan + ' first.'.red);
        }

        if (!this.fs.existsSync(this.themeConfigManager.configPath)) {
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

    /**
     *
     * @param {object} stencilConfig
     * @param {string} currentCliVersion
     * @returns {Promise<object>}
     */
    async runAPICheck(stencilConfig, currentCliVersion) {
        const staplerUrl = stencilConfig.staplerUrl
            ? stencilConfig.staplerUrl
            : stencilConfig.normalStoreUrl;
        const reqUrl = new URL(`/stencil-version-check?v=${currentCliVersion}`, staplerUrl);
        let payload;

        const headers = {
            'stencil-cli': currentCliVersion,
        };
        if (stencilConfig.staplerUrl) {
            headers['stencil-store-url'] = stencilConfig.normalStoreUrl;
        }

        try {
            const response = await this.fetch(reqUrl, { headers });
            if (!response.ok) {
                throw new Error(response.statusText);
            }
            payload = await response.json();
            if (!payload) {
                throw new Error('Empty payload in the server response');
            }
        } catch (err) {
            throw new Error(
                'The BigCommerce Store you are pointing to either does not exist or is not available at this time.'
                    .red +
                    '\nError details:\n' +
                    err.message,
            );
        }
        if (payload.error) {
            throw new Error(payload.error.red);
        }
        if (payload.status !== 'ok') {
            throw new Error(
                'Error: You are using an outdated version of stencil-cli, please run '.red +
                    '$ npm install -g @bigcommerce/stencil-cli'.cyan,
            );
        }
        return payload;
    }

    /**
     * @param {Object} cliOptions
     * @param {Object} stencilConfig
     * @return {Promise<any>}
     */
    async startLocalServer(cliOptions, stencilConfig) {
        return Server.create({
            dotStencilFile: stencilConfig,
            variationIndex: this.themeConfigManager.variationIndex || 0,
            useCache: cliOptions.cache,
            themePath: this.themeConfigManager.themePath,
        });
    }

    async startBrowserSync(cliOptions, stencilConfig, browserSyncPort) {
        const DEFAULT_WATCH_FILES = ['/assets', '/templates', '/lang', '/.config'];
        const DEFAULT_WATCH_IGNORED = ['/assets/scss', '/assets/css'];
        const { themePath, configPath } = this.themeConfigManager;

        // Watch sccs directory and automatically reload all css files if a file changes
        const stylesPath = path.join(themePath, 'assets/scss');
        this.browserSync.watch(stylesPath, (event) => {
            if (event === 'change') {
                this.browserSync.reload('*.css');
            }
        });

        this.browserSync.watch(configPath, (event) => {
            if (event === 'change') {
                this.themeConfigManager.resetVariationSettings();
                this.browserSync.reload();
            }
        });

        const storefrontConfigPath = path.join(themePath, '.config/storefront.json');
        this.browserSync.watch(storefrontConfigPath, (event, file) => {
            if (event === 'change') {
                this.logger.log('storefront.json changed');
                this.browserSync.emitter.emit('storefront_config_file:changed', {
                    event,
                    path: file,
                    namespace: '',
                });
                this.browserSync.reload();
            }
        });

        const templatesPath = path.join(themePath, 'templates');
        this.browserSync.watch(templatesPath, { ignoreInitial: true }, async () => {
            try {
                const results = await this.assembleTemplates(templatesPath);
                new this.CyclesDetector(results).detect();
            } catch (e) {
                this.logger.error(e);
            }
        });

        // tunnel value should be true/false or a string with name
        // https://browsersync.io/docs/options#option-tunnel
        // convert undefined/true -> false/true
        const tunnel =
            typeof cliOptions.tunnel === 'string' ? cliOptions.tunnel : Boolean(cliOptions.tunnel);
        const watchFiles =
            (this.buildConfigManger.watchOptions && this.buildConfigManger.watchOptions.files) ||
            DEFAULT_WATCH_FILES;
        const watchIgnored =
            (this.buildConfigManger.watchOptions && this.buildConfigManger.watchOptions.ignored) ||
            DEFAULT_WATCH_IGNORED;

        this.browserSync.init({
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
                this.browserSync.reload();
            }
        });

        if (this.buildConfigManger.development) {
            this.buildConfigManger.initWorker().development(this.browserSync);
        }
    }

    /**
     * Assembles all the needed templates and resolves their partials.
     *
     * @param {string} templatesPath
     * @returns {object[]}
     */
    async assembleTemplates(templatesPath) {
        const filesPaths = await this.fsUtils.recursiveReadDir(templatesPath, ['!*.html']);
        const templateNames = filesPaths.map((file) =>
            file.replace(templatesPath + path.sep, '').replace('.html', ''),
        );

        return Promise.all(
            templateNames.map(async (templateName) =>
                promisify(this.templateAssembler.assemble)(templatesPath, templateName),
            ),
        );
    }

    /**
     * Displays information about your environment and configuration.
     * @param {Object} stencilConfig
     * @param {string} dotStencilFilePath
     * @returns {string}
     */
    getStartUpInfo(stencilConfig, dotStencilFilePath) {
        let information = '\n';

        information += '-----------------Startup Information-------------\n'.gray;
        information += '\n';
        information += `.stencil location: ${dotStencilFilePath.cyan}\n`;
        information += `config.json location: ${this.themeConfigManager.configPath.cyan}\n`;
        information += `Store URL: ${stencilConfig.normalStoreUrl.cyan}\n`;

        if (stencilConfig.staplerUrl) {
            information += `Stapler URL: ${stencilConfig.staplerUrl.cyan}\n`;
        }

        information += `SSL Store URL: ${stencilConfig.storeUrl.cyan}\n`;
        information += `Node Version: ${process.version.cyan}\n`;
        information += '\n';
        information += '-------------------------------------------------\n'.gray;

        return information;
    }
}

module.exports = StencilStart;
