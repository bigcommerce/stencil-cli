import { jest } from '@jest/globals';
import path from 'path';
import StencilStart from './stencil-start.js';
import stencilPushUtilsModule from './stencil-push.utils.js';

afterAll(() => jest.restoreAllMocks());
describe('StencilStart unit tests', () => {
    const getBrowserSyncStub = () => ({
        watch: jest.fn(),
        init: jest.fn(),
    });
    const getThemeApiClientStub = () => ({
        checkCliVersion: jest.fn().mockResolvedValue({
            baseUrl: 'example.com',
            sslUrl: 'https://example.com',
        }),
        getStoreHash: jest.fn().mockResolvedValue('storeHash_value'),
        getStoreChannels: jest
            .fn()
            .mockResolvedValue([{ channel_id: 5, url: 'https://www.example.com' }]),
    });
    const getFsUtilsStub = () => ({
        existsSync: jest.fn().mockReturnValue(true),
        parseJsonFile: jest.fn().mockResolvedValue({}),
        recursiveReadDir: jest.fn(),
    });
    const getCliCommonStub = () => ({
        checkNodeVersion: jest.fn(),
    });
    const getThemeConfigManagerStub = () => ({
        themePath: '/some/absolute/config/path',
        configPath: '/some/absolute/config/path',
    });
    const getStencilConfigManagerStub = (config = {}) => ({
        read: jest.fn().mockResolvedValue(config),
    });
    const getBuildConfigManagerStub = () => ({});
    const getTemplateAssemblerStub = () => ({});
    const getCyclesDetectorConstructorStub = () => jest.fn();
    const getStencilPushUtilsStub = () => ({
        promptUserToSelectChannel: jest.fn(),
    });
    const getLoggerStub = () => ({
        log: jest.fn(),
        error: jest.fn(),
    });
    const getMakeswiftProxyHealthStub = (active = false) => ({
        isMakeswiftProxyActive: jest.fn().mockResolvedValue(active),
    });
    const getTunnelManagerStub = () => ({
        start: jest.fn().mockResolvedValue({
            url: 'https://preview-123.trycloudflare.com',
            stop: jest.fn().mockResolvedValue(),
        }),
    });
    const previewSecret = 's'.repeat(64);
    const registeredSession = {
        sessionId: '0b6f9c3e-4d2a-4f7b-9a1c-2e3d4f5a6b7c',
        accessKey: 'k'.repeat(64),
        expiresIn: 300,
    };
    const getPreviewSessionClientStub = () => ({
        createSecret: jest.fn().mockReturnValue(previewSecret),
        register: jest.fn().mockResolvedValue(registeredSession),
        revoke: jest.fn().mockResolvedValue(),
    });
    const getHeartbeatFactoryStub = () =>
        jest.fn().mockReturnValue({ start: jest.fn(), stop: jest.fn() });
    const getProcessStub = () => ({
        on: jest.fn(),
        once: jest.fn(),
        exit: jest.fn(),
    });
    const getStoreSettingsApiClientStub = () => ({
        getStoreSettingsLocale: jest.fn().mockResolvedValue({ default_shopper_language: 'en_US' }),
    });
    const createStencilStartInstance = ({
        browserSync,
        fsUtils,
        themeApiClient,
        cliCommon,
        stencilConfigManager,
        themeConfigManager,
        buildConfigManager,
        templateAssembler,
        CyclesDetector,
        stencilPushUtils,
        logger,
        storeSettingsApiClient,
        makeswiftProxyHealth,
        tunnelManager,
        previewSessionClient,
        previewProxyFactory,
        previewSessionHeartbeatFactory,
        processObj,
        shutdownTimeout,
    } = {}) => {
        const passedArgs = {
            browserSync: browserSync || getBrowserSyncStub(),
            fsUtils: fsUtils || getFsUtilsStub(),
            themeApiClient: themeApiClient || getThemeApiClientStub(),
            cliCommon: cliCommon || getCliCommonStub(),
            stencilConfigManager: stencilConfigManager || getStencilConfigManagerStub(),
            themeConfigManager: themeConfigManager || getThemeConfigManagerStub(),
            buildConfigManager: buildConfigManager || getBuildConfigManagerStub(),
            templateAssembler: templateAssembler || getTemplateAssemblerStub(),
            CyclesDetector: CyclesDetector || getCyclesDetectorConstructorStub(),
            stencilPushUtils: stencilPushUtils || getStencilPushUtilsStub(),
            logger: logger || getLoggerStub(),
            storeSettingsApiClient: storeSettingsApiClient || getStoreSettingsApiClientStub(),
            makeswiftProxyHealth: makeswiftProxyHealth || getMakeswiftProxyHealthStub(),
            tunnelManager: tunnelManager || getTunnelManagerStub(),
            previewSessionClient: previewSessionClient || getPreviewSessionClientStub(),
            previewProxyFactory: previewProxyFactory || jest.fn().mockReturnValue(jest.fn()),
            previewSessionHeartbeatFactory:
                previewSessionHeartbeatFactory || getHeartbeatFactoryStub(),
            processObj: processObj || getProcessStub(),
            shutdownTimeout,
        };
        const instance = new StencilStart(passedArgs);
        return {
            passedArgs,
            instance,
        };
    };
    describe('constructor', () => {
        it('should create an instance of StencilStart without options parameters passed', async () => {
            const instance = new StencilStart();
            expect(instance).toBeInstanceOf(StencilStart);
        });
        it('should create an instance of StencilStart with all options parameters passed', async () => {
            const { instance } = createStencilStartInstance();
            expect(instance).toBeInstanceOf(StencilStart);
        });
    });
    describe('assembleTemplates method', () => {
        it('should obtain names of all templates in the passed templatesPath and return results of call templateAssembler.assemble for each template name', async () => {
            const templatesPath = '/some/absolute/templates/path';
            const templateNamesMock = ['layout/base', 'pages/page1'];
            const filesPathsMock = [
                templatesPath + path.sep + templateNamesMock[0] + '.html',
                templatesPath + path.sep + templateNamesMock[1] + '.html',
            ];
            const templateAssemblerResults = [
                {
                    [templateNamesMock[0]]: 'html file content 1',
                },
                {
                    [templateNamesMock[0]]: 'html file content 1',
                    [templateNamesMock[1]]: 'html file content 2',
                },
            ];
            const fsUtilsStub = {
                recursiveReadDir: jest.fn().mockResolvedValue(filesPathsMock),
            };
            const templateAssemblerStub = {
                assemble: jest
                    .fn()
                    .mockImplementationOnce((p, n, cb) => cb(null, templateAssemblerResults[0]))
                    .mockImplementationOnce((p, n, cb) => cb(null, templateAssemblerResults[1])),
            };
            const { instance } = createStencilStartInstance({
                fsUtils: fsUtilsStub,
                templateAssembler: templateAssemblerStub,
            });
            const result = await instance.assembleTemplates(templatesPath);
            expect(fsUtilsStub.recursiveReadDir).toHaveBeenCalledTimes(1);
            expect(fsUtilsStub.recursiveReadDir).toHaveBeenCalledWith(templatesPath, ['!*.html']);
            expect(templateAssemblerStub.assemble.mock.calls).toEqual([
                [templatesPath, templateNamesMock[0], expect.any(Function)],
                [templatesPath, templateNamesMock[1], expect.any(Function)],
            ]);
            expect(result).toStrictEqual(templateAssemblerResults);
        });
    });
    describe('getChannelUrl method', () => {
        const accessToken = 'accessToken_value';
        const apiHost = 'apiHost_value';
        const storeHash = 'storeHash_value';
        const channelId = 5;
        const storeUrl = 'https://www.example.com';
        it('should obtain channel id from the api', async () => {
            const channels = [{ channel_id: channelId, url: storeUrl }];
            const themeApiClientStub = {
                checkCliVersion: jest.fn(),
                getStoreHash: jest.fn().mockResolvedValue(storeHash),
                getStoreChannels: jest.fn().mockResolvedValue(channels),
            };
            const { instance } = createStencilStartInstance({
                themeApiClient: themeApiClientStub,
                stencilPushUtils: stencilPushUtilsModule,
            });
            const result = await instance.getChannelUrl({ accessToken }, { apiHost });
            expect(result).toEqual(storeUrl);
        });

        it('should obtain channel url from the CLI', async () => {
            const channelUrl = 'https://shop.bigcommerce.com';
            const channels = [{ channel_id: channelId, url: storeUrl }];
            const themeApiClientStub = {
                checkCliVersion: jest.fn(),
                getStoreHash: jest.fn().mockResolvedValue(storeHash),
                getStoreChannels: jest.fn().mockResolvedValue(channels),
            };
            const { instance } = createStencilStartInstance({
                themeApiClient: themeApiClientStub,
                stencilPushUtils: stencilPushUtilsModule,
            });
            const result = await instance.getChannelUrl({ accessToken }, { apiHost, channelUrl });
            expect(result).toEqual(channelUrl);
        });
    });

    describe('Makeswift preview', () => {
        const port = 3000;
        const previewProxyMiddleware = jest.fn();
        const runStart = async ({
            cliOptions = {},
            makeswiftActive = true,
            tunnelManager,
            previewSessionClient,
            accessToken = 'token-123',
            shutdownTimeout,
            startLocalServer = jest.fn(),
        } = {}) => {
            const deps = {
                browserSync: getBrowserSyncStub(),
                logger: getLoggerStub(),
                processObj: getProcessStub(),
                makeswiftProxyHealth: getMakeswiftProxyHealthStub(makeswiftActive),
                tunnelManager: tunnelManager || getTunnelManagerStub(),
                previewSessionClient: previewSessionClient || getPreviewSessionClientStub(),
                previewProxyFactory: jest.fn().mockReturnValue(previewProxyMiddleware),
                previewSessionHeartbeatFactory: getHeartbeatFactoryStub(),
                stencilConfigManager: getStencilConfigManagerStub({ port, accessToken }),
                shutdownTimeout,
            };
            const { instance } = createStencilStartInstance(deps);
            instance.startLocalServer = startLocalServer;
            instance.getStartUpInfo = jest.fn().mockReturnValue('Start up info');
            instance.checkLangFiles = jest.fn();
            await instance.run({ channelId: 5, ...cliOptions });
            const output = [...deps.logger.log.mock.calls, ...deps.logger.error.mock.calls]
                .flat()
                .join('\n');
            return { ...deps, instance, output };
        };
        const signalHandler = (processObj, signal) =>
            processObj.on.mock.calls.find(([name]) => name === signal)[1];

        it('should start a tunnel to the renderer port and print the local front door', async () => {
            const { makeswiftProxyHealth, tunnelManager, output } = await runStart();
            expect(makeswiftProxyHealth.isMakeswiftProxyActive).toHaveBeenCalledWith({
                storeUrl: 'https://www.example.com',
            });
            expect(tunnelManager.start).toHaveBeenCalledWith(port + 1);
            expect(output).toContain('Makeswift preview is active. Open');
            expect(output).toContain(`http://localhost:${port}`);
            expect(output).not.toContain('https://preview-123.trycloudflare.com');
            expect(output).not.toContain(previewSecret);
            expect(output).not.toContain(registeredSession.accessKey);
        });

        it('should serve a signing proxy to the storefront on loopback only', async () => {
            const { browserSync, previewProxyFactory, logger, instance } = await runStart({
                cliOptions: { open: true },
            });
            expect(previewProxyFactory).toHaveBeenCalledWith({
                previewSession: instance.previewSession,
                logger,
            });
            const options = browserSync.init.mock.calls[0][0];
            expect(options).toEqual(
                expect.objectContaining({
                    open: true,
                    port,
                    listen: 'localhost',
                    server: { baseDir: [] },
                    middleware: [previewProxyMiddleware],
                    tunnel: false,
                }),
            );
            expect(options).not.toHaveProperty('proxy');
        });

        it('should proxy BrowserSync to the renderer when preview is off', async () => {
            const { browserSync, previewProxyFactory } = await runStart({
                makeswiftActive: false,
            });
            expect(previewProxyFactory).not.toHaveBeenCalled();
            const options = browserSync.init.mock.calls[0][0];
            expect(options).toEqual(
                expect.objectContaining({ proxy: `localhost:${port + 1}`, tunnel: false }),
            );
            expect(options).not.toHaveProperty('listen');
            expect(options).not.toHaveProperty('middleware');
        });

        it('should not start a tunnel or print anything when Makeswift is not active', async () => {
            const { tunnelManager, processObj, output } = await runStart({
                makeswiftActive: false,
            });
            expect(tunnelManager.start).not.toHaveBeenCalled();
            expect(processObj.on).not.toHaveBeenCalled();
            expect(output).not.toContain('Makeswift');
        });

        it('should not start a Makeswift tunnel when --tunnel is set', async () => {
            const { tunnelManager, output } = await runStart({ cliOptions: { tunnel: true } });
            expect(tunnelManager.start).not.toHaveBeenCalled();
            expect(output).toContain('Makeswift preview is off because --tunnel is set');
        });

        it('should continue without Makeswift preview when the tunnel fails', async () => {
            const tunnelManager = {
                start: jest.fn().mockRejectedValue(new Error('cloudflared was not found.')),
            };
            const { browserSync, processObj, output } = await runStart({ tunnelManager });
            expect(output).toContain(
                'Makeswift preview is not available. cloudflared was not found.',
            );
            expect(processObj.on).not.toHaveBeenCalled();
            expect(browserSync.init).toHaveBeenCalled();
        });

        it('should register the session and require its secret on the renderer', async () => {
            const { previewSessionClient, instance } = await runStart();
            expect(previewSessionClient.register).toHaveBeenCalledWith({
                storeUrl: 'https://www.example.com',
                accessToken: 'token-123',
                tunnelUrl: 'https://preview-123.trycloudflare.com',
                secret: previewSecret,
            });
            expect(instance.previewSession).toEqual({
                storeUrl: 'https://www.example.com',
                tunnelUrl: 'https://preview-123.trycloudflare.com',
                secret: previewSecret,
                ...registeredSession,
            });
            expect(instance.startLocalServer).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                previewSecret,
            );
        });

        it('should keep the registered session alive with a heartbeat', async () => {
            const {
                previewSessionHeartbeatFactory,
                previewSessionClient,
                logger,
                instance,
            } = await runStart();
            expect(previewSessionHeartbeatFactory).toHaveBeenCalledWith({
                client: previewSessionClient,
                session: instance.previewSession,
                accessToken: 'token-123',
                logger,
            });
            expect(previewSessionHeartbeatFactory.mock.results[0].value.start).toHaveBeenCalled();
        });

        it('should stop the tunnel and continue without preview when registration fails', async () => {
            const previewSessionClient = getPreviewSessionClientStub();
            previewSessionClient.register.mockRejectedValue(
                new Error('Could not register the Makeswift preview session (HTTP 401).'),
            );
            const {
                tunnelManager,
                browserSync,
                instance,
                output,
                previewSessionHeartbeatFactory,
            } = await runStart({ previewSessionClient });
            const { stop } = await tunnelManager.start.mock.results[0].value;
            expect(stop).toHaveBeenCalled();
            expect(previewSessionHeartbeatFactory).not.toHaveBeenCalled();
            expect(instance.previewSession).toBeNull();
            expect(previewSessionClient.revoke).not.toHaveBeenCalled();
            expect(instance.startLocalServer.mock.calls[0][2]).toBeUndefined();
            expect(output).toContain('Makeswift preview is not available. Could not register');
            expect(browserSync.init).toHaveBeenCalled();
        });

        it('should fail to start when .stencil has no access token', async () => {
            const tunnelManager = getTunnelManagerStub();
            await expect(runStart({ tunnelManager, accessToken: null })).rejects.toThrow(
                'Makeswift preview requires an access token',
            );
            expect(tunnelManager.start).not.toHaveBeenCalled();
        });

        it('should stop the heartbeat and tunnel, revoke the session, and exit on SIGINT', async () => {
            const {
                tunnelManager,
                processObj,
                previewSessionClient,
                previewSessionHeartbeatFactory,
            } = await runStart();
            const { stop } = await tunnelManager.start.mock.results[0].value;

            await signalHandler(processObj, 'SIGINT')('SIGINT');

            expect(previewSessionHeartbeatFactory.mock.results[0].value.stop).toHaveBeenCalled();
            expect(stop).toHaveBeenCalledTimes(1);
            expect(previewSessionClient.revoke).toHaveBeenCalledWith({
                storeUrl: 'https://www.example.com',
                accessToken: 'token-123',
                sessionId: registeredSession.sessionId,
            });
            expect(processObj.exit).toHaveBeenCalledWith(130);
        });

        it('should exit with 143 on SIGTERM', async () => {
            const { processObj } = await runStart();

            await signalHandler(processObj, 'SIGTERM')('SIGTERM');

            expect(processObj.exit).toHaveBeenCalledWith(143);
        });

        it('should exit at once on a second signal while cleanup runs, and clean up only once', async () => {
            const previewSessionClient = getPreviewSessionClientStub();
            previewSessionClient.revoke.mockReturnValue(new Promise(() => {}));
            const { tunnelManager, processObj } = await runStart({
                previewSessionClient,
                shutdownTimeout: 10,
            });
            const { stop } = await tunnelManager.start.mock.results[0].value;

            signalHandler(processObj, 'SIGINT')('SIGINT');
            await signalHandler(processObj, 'SIGTERM')('SIGTERM');

            expect(processObj.exit).toHaveBeenCalledTimes(1);
            expect(processObj.exit).toHaveBeenCalledWith(1);
            expect(previewSessionClient.revoke).toHaveBeenCalledTimes(1);
            expect(stop).toHaveBeenCalledTimes(1);
        });

        it('should stop the tunnel and exit without output when the revoke fails', async () => {
            const previewSessionClient = getPreviewSessionClientStub();
            previewSessionClient.revoke.mockRejectedValue(
                new Error('Could not revoke the Makeswift preview session (HTTP 503).'),
            );
            const { tunnelManager, processObj, logger } = await runStart({ previewSessionClient });
            const { stop } = await tunnelManager.start.mock.results[0].value;
            logger.log.mockClear();
            logger.error.mockClear();

            await signalHandler(processObj, 'SIGINT')('SIGINT');

            expect(stop).toHaveBeenCalled();
            expect(processObj.exit).toHaveBeenCalledWith(130);
            expect(logger.log).not.toHaveBeenCalled();
            expect(logger.error).not.toHaveBeenCalled();
        });

        it('should exit after the shutdown timeout when the revoke does not complete', async () => {
            const previewSessionClient = getPreviewSessionClientStub();
            previewSessionClient.revoke.mockReturnValue(new Promise(() => {}));
            const { processObj } = await runStart({ previewSessionClient, shutdownTimeout: 10 });

            await signalHandler(processObj, 'SIGINT')('SIGINT');

            expect(processObj.exit).toHaveBeenCalledWith(130);
        });

        it('should only stop the tunnel on a process exit that is not a signal', async () => {
            const { tunnelManager, processObj, previewSessionClient } = await runStart();
            const { stop } = await tunnelManager.start.mock.results[0].value;
            const onExit = processObj.once.mock.calls.find(([name]) => name === 'exit')[1];

            onExit();

            expect(stop).toHaveBeenCalled();
            expect(previewSessionClient.revoke).not.toHaveBeenCalled();
        });

        it('should revoke the session and stop the tunnel when start fails after registration', async () => {
            const tunnelManager = getTunnelManagerStub();
            const previewSessionClient = getPreviewSessionClientStub();
            await expect(
                runStart({
                    tunnelManager,
                    previewSessionClient,
                    startLocalServer: jest.fn().mockRejectedValue(new Error('port in use')),
                }),
            ).rejects.toThrow('port in use');
            const { stop } = await tunnelManager.start.mock.results[0].value;

            expect(stop).toHaveBeenCalled();
            expect(previewSessionClient.revoke).toHaveBeenCalledTimes(1);
        });
    });

    describe('port option', () => {
        it('should read port from the config file', async () => {
            const port = 1234;
            const browserSyncStub = getBrowserSyncStub();
            const { instance } = createStencilStartInstance({
                browserSync: browserSyncStub,
                stencilConfigManager: getStencilConfigManagerStub({ port }),
            });
            instance.startLocalServer = jest.fn();
            instance.getStartUpInfo = jest.fn().mockReturnValue('Start up info');
            instance.checkLangFiles = jest.fn();
            await instance.run({});
            expect(browserSyncStub.init).toHaveBeenCalledWith(
                expect.objectContaining({
                    port,
                }),
            );
        });

        it('should read port from the cli', async () => {
            const port = 1234;
            const browserSyncStub = getBrowserSyncStub();
            const { instance } = createStencilStartInstance({
                browserSync: browserSyncStub,
                stencilConfigManager: getStencilConfigManagerStub({ port: 5678 }),
            });
            instance.startLocalServer = jest.fn();
            instance.getStartUpInfo = jest.fn().mockReturnValue('Start up info');
            instance.checkLangFiles = jest.fn();
            await instance.run({ port });
            expect(browserSyncStub.init).toHaveBeenCalledWith(
                expect.objectContaining({
                    port,
                }),
            );
        });
    });
});
