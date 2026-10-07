import 'colors';
import BrowserSync from 'browser-sync';
import { promisify } from 'util';
import path from 'path';
import Cycles from './Cycles.js';
import templateAssemblerModule from './template-assembler.js';
import { PACKAGE_INFO, THEME_PATH } from '../constants.js';
import Server from '../server/index.js';
import StencilConfigManager from './StencilConfigManager.js';
import ThemeConfig from './theme-config.js';
import BuildConfigManager from './BuildConfigManager.js';
import fsUtilsModule from './utils/fsUtils.js';
import stencilPushUtilsModule from './stencil-push.utils.js';
import cliCommonModule from './cliCommon.js';
import themeApiClientModule from './theme-api-client.js';
import storeSettingsApiClientModule from './store-settings-api-client.js';
import LangHelper from './lang-helper.js';
import LangValidator from './lang/validator.js';
import makeswiftProxyHealthModule from './makeswift-proxy-health.js';
import tunnelManagerModule from './TunnelManager.js';
import previewSessionClientModule from './PreviewSessionClient.js';
import PreviewSessionHeartbeat from './PreviewSessionHeartbeat.js';
import { createPreviewProxy } from './preview-proxy.js';

const PREVIEW_LISTEN_HOST = 'localhost';
// Ctrl-C must not be slow. A session that is not revoked expires with its TTL.
const SHUTDOWN_TIMEOUT_MS = 3000;

class StencilStart {
    constructor({
        browserSync = BrowserSync.create(),
        themeApiClient = themeApiClientModule,
        storeSettingsApiClient = storeSettingsApiClientModule,
        langHelper = new LangHelper(),
        fsUtils = fsUtilsModule,
        cliCommon = cliCommonModule,
        stencilConfigManager = new StencilConfigManager(),
        themeConfigManager = ThemeConfig.getInstance(THEME_PATH),
        buildConfigManager = new BuildConfigManager(),
        templateAssembler = templateAssemblerModule,
        CyclesDetector = Cycles,
        stencilPushUtils = stencilPushUtilsModule,
        logger = console,
        langValidator = new LangValidator(THEME_PATH),
        makeswiftProxyHealth = makeswiftProxyHealthModule,
        tunnelManager = tunnelManagerModule,
        previewSessionClient = previewSessionClientModule,
        previewProxyFactory = createPreviewProxy,
        previewSessionHeartbeatFactory = (options) => new PreviewSessionHeartbeat(options),
        processObj = process,
        shutdownTimeout = SHUTDOWN_TIMEOUT_MS,
    } = {}) {
        this._browserSync = browserSync;
        this._themeApiClient = themeApiClient;
        this._storeSettingsApiClient = storeSettingsApiClient;
        this._langHelper = langHelper;
        this._fsUtils = fsUtils;
        this._cliCommon = cliCommon;
        this._stencilConfigManager = stencilConfigManager;
        this._themeConfigManager = themeConfigManager;
        this._buildConfigManager = buildConfigManager;
        this._templateAssembler = templateAssembler;
        this._CyclesDetector = CyclesDetector;
        this._stencilPushUtils = stencilPushUtils;
        this._logger = logger;
        this._langValidator = langValidator;
        this._makeswiftProxyHealth = makeswiftProxyHealth;
        this._tunnelManager = tunnelManager;
        this._previewSessionClient = previewSessionClient;
        this._previewProxyFactory = previewProxyFactory;
        this._previewSessionHeartbeatFactory = previewSessionHeartbeatFactory;
        this._process = processObj;
        this._shutdownTimeout = shutdownTimeout;
        this._tunnel = null;
        this._previewSession = null;
        this._previewAccessToken = null;
        this._previewSessionHeartbeat = null;
        this._shutdownPromise = null;
    }

    async run(cliOptions) {
        this.runBasicChecks(cliOptions);
        if (cliOptions.variation) {
            await this._themeConfigManager.setVariationByName(cliOptions.variation);
        }
        const initialStencilConfig = await this._stencilConfigManager.read();
        // Use initial (before updates) port for BrowserSync
        const browserSyncPort = cliOptions.port || initialStencilConfig.port;
        const channelUrl = await this.getChannelUrl(initialStencilConfig, cliOptions);
        const storeInfoFromAPI = await this._themeApiClient.checkCliVersion({
            storeUrl: channelUrl,
        });
        const updatedStencilConfig = this.updateStencilConfig(
            initialStencilConfig,
            storeInfoFromAPI,
            browserSyncPort,
        );
        this._storeSettingsLocale = await this.getStoreSettingsLocale(
            cliOptions,
            updatedStencilConfig,
        );
        const previewStoreUrl = channelUrl || updatedStencilConfig.storeUrl;
        const makeswiftPreview = await this.isMakeswiftPreviewEnabled(cliOptions, previewStoreUrl);
        if (makeswiftPreview && !updatedStencilConfig.accessToken) {
            throw new Error(
                'Makeswift preview requires an access token. Add accessToken to your .stencil file.'.red,
            );
        }
        if (makeswiftPreview) {
            await this.startMakeswiftPreview({
                localPort: browserSyncPort,
                rendererPort: this.getRendererPort(browserSyncPort),
                storeUrl: previewStoreUrl,
                accessToken: updatedStencilConfig.accessToken,
                secret: this._previewSessionClient.createSecret(),
            });
        }
        try {
            await this.startLocalServer(
                cliOptions,
                updatedStencilConfig,
                this._previewSession?.secret,
            );
            this._logger.log(this.getStartUpInfo(updatedStencilConfig));
            await this.startBrowserSync(cliOptions, browserSyncPort);
        } catch (err) {
            await this.shutdownMakeswiftPreview();
            throw err;
        }
    }

    /**
     * The registered Makeswift preview session, or null when preview is off.
     *
     * @returns {{ storeUrl: string, tunnelUrl: string, secret: string, sessionId: string, accessKey: string, expiresIn: number } | null}
     */
    get previewSession() {
        return this._previewSession;
    }

    getRendererPort(browserSyncPort) {
        return Number(browserSyncPort) + 1;
    }

    /**
     * Preview mode turns on when the storefront host is routed through the Makeswift proxy.
     * A failed check never stops `stencil start`; it only turns preview mode off.
     *
     * @param {Object} cliOptions
     * @param {string} storeUrl
     * @returns {Promise<boolean>}
     */
    async isMakeswiftPreviewEnabled(cliOptions, storeUrl) {
        const enabled = await this._makeswiftProxyHealth.isMakeswiftProxyActive({ storeUrl });
        if (enabled && cliOptions.tunnel) {
            this._logger.log(
                `${'Notice'.yellow}: Makeswift preview is off because --tunnel is set. ` +
                    'Remove --tunnel to use Makeswift preview.',
            );
            return false;
        }
        return enabled;
    }

    /**
     * Starts the Cloudflare tunnel to the renderer port (not the BrowserSync port) and registers
     * the preview session. If either fails, `stencil start` continues without Makeswift preview.
     *
     * @param {object} options
     * @param {number} options.localPort - BrowserSync port, the local front door
     * @param {number} options.rendererPort
     * @param {string} options.storeUrl
     * @param {string} options.accessToken
     * @param {string} options.secret
     */
    async startMakeswiftPreview({ localPort, rendererPort, storeUrl, accessToken, secret }) {
        this._logger.log('Makeswift is enabled for this storefront. Starting Makeswift preview...');
        try {
            this._tunnel = await this._tunnelManager.start(rendererPort);
        } catch (err) {
            this.warnPreviewUnavailable(err);
            return;
        }
        this.registerShutdownHandlers();
        try {
            const tunnelUrl = this._tunnel.url;
            const registration = await this._previewSessionClient.register({
                storeUrl,
                accessToken,
                tunnelUrl,
                secret,
            });
            this._previewSession = { storeUrl, tunnelUrl, secret, ...registration };
            this._previewAccessToken = accessToken;
        } catch (err) {
            await this.stopMakeswiftPreview();
            this.warnPreviewUnavailable(err);
            return;
        }
        this._previewSessionHeartbeat = this._previewSessionHeartbeatFactory({
            client: this._previewSessionClient,
            session: this._previewSession,
            accessToken,
            logger: this._logger,
        });
        this._previewSessionHeartbeat.start();
        const localUrl = `http://${PREVIEW_LISTEN_HOST}:${localPort}`;
        this._logger.log(
            `Makeswift preview is active. Open ${localUrl.cyan}\n` +
                'The Makeswift preview session ends when you stop stencil start.',
        );
    }

    warnPreviewUnavailable(err) {
        this._logger.error(
            `${'Warning'.yellow}: Makeswift preview is not available. ${err.message}\n` +
                'The local server continues without Makeswift preview.',
        );
    }

    registerShutdownHandlers() {
        let shuttingDown = false;
        const onSignal = async (signal) => {
            if (shuttingDown) {
                this._process.exit(1);
                return;
            }
            shuttingDown = true;
            try {
                await this.shutdownMakeswiftPreview();
            } finally {
                this._process.exit(signal === 'SIGINT' ? 130 : 143);
            }
        };
        this._process.on('SIGINT', onSignal);
        this._process.on('SIGTERM', onSignal);
        this._process.once('exit', () => this.stopMakeswiftPreview());
    }

    /**
     * Stops the heartbeat and the tunnel, and revokes the session. Safe to call more than once.
     * It does not fail and it takes at most the shutdown timeout. A failed revoke is not shown:
     * the session expires with its TTL.
     *
     * @returns {Promise<void>}
     */
    shutdownMakeswiftPreview() {
        this._shutdownPromise ??= this._shutdownMakeswiftPreview();
        return this._shutdownPromise;
    }

    async _shutdownMakeswiftPreview() {
        const session = this._previewSession;
        const accessToken = this._previewAccessToken;
        this._previewAccessToken = null;
        const stopped = this.stopMakeswiftPreview();
        const revoked = session
            ? this._previewSessionClient.revoke({
                  storeUrl: session.storeUrl,
                  accessToken,
                  sessionId: session.sessionId,
              })
            : undefined;
        let timer;
        const timedOut = new Promise((resolve) => {
            timer = setTimeout(resolve, this._shutdownTimeout);
            timer.unref();
        });
        await Promise.race([Promise.allSettled([stopped, revoked]), timedOut]);
        clearTimeout(timer);
    }

    stopMakeswiftPreview() {
        this._previewSessionHeartbeat?.stop();
        this._previewSessionHeartbeat = null;
        const tunnel = this._tunnel;
        this._tunnel = null;
        return tunnel ? tunnel.stop() : Promise.resolve();
    }

    async getStoreSettingsLocale(cliOptions, stencilConfig) {
        const { accessToken } = stencilConfig;
        const apiHost = cliOptions.apiHost || stencilConfig.apiHost;
        return this._storeSettingsApiClient.getStoreSettingsLocale({
            storeHash: this.storeHash,
            accessToken,
            apiHost,
        });
    }

    async getChannelUrl(stencilConfig, cliOptions) {
        const { accessToken } = stencilConfig;
        const apiHost = cliOptions.apiHost || stencilConfig.apiHost;
        this.storeHash = await this._themeApiClient.getStoreHash({
            storeUrl: stencilConfig.normalStoreUrl,
        });
        if (cliOptions.channelUrl) {
            return cliOptions.channelUrl;
        }
        const channels = await this._themeApiClient.getStoreChannels({
            storeHash: this.storeHash,
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

    updateStencilConfig(stencilConfig, storeInfoFromAPI, browserSyncPort) {
        return {
            ...stencilConfig,
            storeUrl: storeInfoFromAPI.sslUrl,
            normalStoreUrl: storeInfoFromAPI.baseUrl,
            port: browserSyncPort,
        };
    }

    /**
     * @param {Object} cliOptions
     * @param {Object} stencilConfig
     * @return {Promise<any>}
     */
    async startLocalServer(cliOptions, stencilConfig, previewSecret) {
        return Server.create({
            previewSecret,
            dotStencilFile: stencilConfig,
            variationIndex: this._themeConfigManager.variationIndex || 0,
            useCache: cliOptions.cache,
            themePath: this._themeConfigManager.themePath,
            stencilCliVersion: PACKAGE_INFO.version,
            storeSettingsLocale: this._storeSettingsLocale,
        });
    }

    async startBrowserSync(cliOptions, browserSyncPort) {
        const DEFAULT_WATCH_FILES = ['/assets', '/templates', '/lang', '/.config'];
        const DEFAULT_WATCH_IGNORED = ['/assets/scss', '/assets/css'];
        const { themePath, configPath } = this._themeConfigManager;
        const { watchOptions } = this._buildConfigManager;
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
        const langsPath = path.join(themePath, 'lang');
        this._browserSync.watch(langsPath, async (event) => {
            try {
                if (event === 'change') {
                    await this.checkLangFiles(
                        langsPath,
                        this._storeSettingsLocale.default_shopper_language,
                    );
                }
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
            ...(this._previewSession
                ? this.getPreviewBrowserSyncOptions()
                : { proxy: `localhost:${this.getRendererPort(browserSyncPort)}`, tunnel }),
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
        if (this._buildConfigManager.development) {
            this._buildConfigManager.initWorker().development(this._browserSync);
        }
        await this.checkLangFiles(langsPath, this._storeSettingsLocale.default_shopper_language);
    }

    /**
     * In preview mode the local front door proxies to the storefront (not the renderer) and
     * signs each request. The worker sends the request back to the renderer through the tunnel.
     * It listens on localhost (a loopback address) only, so other devices cannot send signed
     * requests.
     *
     * @returns {object} BrowserSync options
     */
    getPreviewBrowserSyncOptions() {
        return {
            listen: PREVIEW_LISTEN_HOST,
            // No static files. BrowserSync's own routes and HTML snippet injection still run
            // first; the proxy middleware handles all other requests.
            server: { baseDir: [] },
            middleware: [
                this._previewProxyFactory({
                    previewSession: this._previewSession,
                    logger: this._logger,
                }),
            ],
            tunnel: false,
        };
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

    async checkLangFiles(langsPath, defaultShopperLanguage) {
        const filesPaths = await this._fsUtils.recursiveReadDir(langsPath);
        const isDefaultLanguagePresent = filesPaths.some((file) =>
            file.includes(defaultShopperLanguage),
        );
        if (!isDefaultLanguagePresent) {
            this._logger.log(
                `${
                    'Warning'.yellow
                }: "missing language file for default shopper language: ${defaultShopperLanguage}"`,
            );
        } else {
            try {
                await this._langHelper.checkLangKeysPresence(filesPaths, defaultShopperLanguage);
                await this._langValidator.run(defaultShopperLanguage);
            } catch (e) {
                this._logger.error(e);
            }
        }
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
export default StencilStart;
