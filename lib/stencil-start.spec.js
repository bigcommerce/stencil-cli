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
    const previewSecret = 's'.repeat(64);
    const getMakeswiftPreviewStub = ({ enabled = false, session = null } = {}) => {
        const stub = {
            session: null,
            isEnabled: jest.fn().mockResolvedValue(enabled),
            start: jest.fn().mockImplementation(async () => {
                stub.session = session;
            }),
            getBrowserSyncOptions: jest.fn().mockReturnValue({ listen: 'localhost' }),
            shutdown: jest.fn().mockResolvedValue(),
        };
        return stub;
    };
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
        makeswiftPreview,
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
            makeswiftPreview: makeswiftPreview || getMakeswiftPreviewStub(),
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
        const session = { storeUrl: 'https://www.example.com', secret: previewSecret };
        const runStart = async ({
            cliOptions = {},
            makeswiftPreview = getMakeswiftPreviewStub({ enabled: true, session }),
            accessToken = 'token-123',
            startLocalServer = jest.fn(),
        } = {}) => {
            const deps = {
                browserSync: getBrowserSyncStub(),
                makeswiftPreview,
                stencilConfigManager: getStencilConfigManagerStub({ port, accessToken }),
            };
            const { instance } = createStencilStartInstance(deps);
            instance.startLocalServer = startLocalServer;
            instance.getStartUpInfo = jest.fn().mockReturnValue('Start up info');
            instance.checkLangFiles = jest.fn();
            await instance.run({ channelId: 5, ...cliOptions });
            return { ...deps, instance };
        };

        it('should check the storefront URL and the --tunnel option', async () => {
            const { makeswiftPreview } = await runStart({ cliOptions: { tunnel: 'name' } });
            expect(makeswiftPreview.isEnabled).toHaveBeenCalledWith({
                storeUrl: 'https://www.example.com',
                tunnel: 'name',
            });
        });

        it('should start preview before the renderer and require the session secret', async () => {
            const { makeswiftPreview, instance } = await runStart();
            expect(makeswiftPreview.start).toHaveBeenCalledWith({
                localPort: port,
                rendererPort: port + 1,
                storeUrl: 'https://www.example.com',
                accessToken: 'token-123',
            });
            expect(makeswiftPreview.start.mock.invocationCallOrder[0]).toBeLessThan(
                instance.startLocalServer.mock.invocationCallOrder[0],
            );
            expect(instance.startLocalServer).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                previewSecret,
            );
        });

        it('should use the preview BrowserSync options when a session exists', async () => {
            const { browserSync } = await runStart({ cliOptions: { open: true } });
            const options = browserSync.init.mock.calls[0][0];
            expect(options).toEqual(
                expect.objectContaining({ open: true, port, listen: 'localhost' }),
            );
            expect(options).not.toHaveProperty('proxy');
        });

        it('should proxy BrowserSync to the renderer when preview is off', async () => {
            const makeswiftPreview = getMakeswiftPreviewStub();
            const { browserSync, instance } = await runStart({ makeswiftPreview });
            expect(makeswiftPreview.start).not.toHaveBeenCalled();
            expect(makeswiftPreview.getBrowserSyncOptions).not.toHaveBeenCalled();
            expect(instance.startLocalServer.mock.calls[0][2]).toBeUndefined();
            const options = browserSync.init.mock.calls[0][0];
            expect(options).toEqual(
                expect.objectContaining({ proxy: `localhost:${port + 1}`, tunnel: false }),
            );
            expect(options).not.toHaveProperty('listen');
        });

        it('should proxy BrowserSync to the renderer when preview start gives no session', async () => {
            const makeswiftPreview = getMakeswiftPreviewStub({ enabled: true, session: null });
            const { browserSync, instance } = await runStart({ makeswiftPreview });
            expect(makeswiftPreview.start).toHaveBeenCalled();
            expect(instance.startLocalServer.mock.calls[0][2]).toBeUndefined();
            expect(browserSync.init.mock.calls[0][0]).toHaveProperty('proxy');
        });

        it('should fail to start when preview start fails', async () => {
            const makeswiftPreview = getMakeswiftPreviewStub({ enabled: true });
            makeswiftPreview.start.mockRejectedValue(new Error('requires an access token'));
            await expect(runStart({ makeswiftPreview })).rejects.toThrow(
                'requires an access token',
            );
        });

        it('should shut down preview when start fails after registration', async () => {
            const makeswiftPreview = getMakeswiftPreviewStub({ enabled: true, session });
            await expect(
                runStart({
                    makeswiftPreview,
                    startLocalServer: jest.fn().mockRejectedValue(new Error('port in use')),
                }),
            ).rejects.toThrow('port in use');
            expect(makeswiftPreview.shutdown).toHaveBeenCalledTimes(1);
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
