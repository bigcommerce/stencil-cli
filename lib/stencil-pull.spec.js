const stencilPushUtilsModule = require('./stencil-push.utils');
const StencilPull = require('./stencil-pull');

afterAll(() => jest.restoreAllMocks());

describe('StencilStart unit tests', () => {
    const accessToken = 'accessToken_value';
    const normalStoreUrl = 'https://www.example.com';
    const channelId = 1;
    const storeHash = 'storeHash_value';
    const channels = [
        {
            channel_id: channelId,
            url: normalStoreUrl,
        },
    ];
    const activeThemeUuid = 'activeThemeUuid_value';
    const variations = [
        { uuid: 1, name: 'Light' },
        { uuid: 2, name: 'Bold' },
    ];

    const localThemeConfiguration = {
        settings: {},
        variations: [
            {
                name: 'Light',
                settings: {},
            },
        ],
    };
    const remoteThemeConfiguration = {
        settings: {
            'body-font': 'Google_Source+Sans+Pro_400',
            'headings-font': 'Google_Roboto_400',
            'color-textBase': '#ffffff',
            'color-textBase--hover': '#bbbbbb',
        },
    };

    const saveConfigName = 'config.json';
    const cliOptions = {
        channelId,
        saveConfigName,
        saved: false,
        applyTheme: true,
    };
    const stencilConfig = {
        accessToken,
        normalStoreUrl,
    };

    const getThemeApiClientStub = () => ({
        getStoreHash: jest.fn().mockResolvedValue(storeHash),
        getStoreChannels: jest.fn().mockResolvedValue(channels),
        getChannelActiveTheme: jest.fn().mockResolvedValue({
            active_theme_uuid: activeThemeUuid,
        }),
        getVariationsByThemeId: jest.fn().mockResolvedValue(variations),
        getThemeConfiguration: jest.fn().mockResolvedValue(remoteThemeConfiguration),
    });
    const getFsUtilsStub = () => ({
        parseJsonFile: jest.fn().mockResolvedValue(localThemeConfiguration),
    });
    const getFsModuleStub = () => ({
        promises: {
            writeFile: jest.fn(),
        },
    });
    const getStencilConfigManagerStub = () => ({
        read: jest.fn().mockResolvedValue(stencilConfig),
    });
    const getStencilPushUtilsStub = () => ({
        promptUserToSelectChannel: jest.fn(),
        getActivatedVariation: stencilPushUtilsModule.getActivatedVariation,
    });

    const createStencilPullInstance = ({
        stencilConfigManager,
        themeApiClient,
        stencilPushUtils,
        fsUtils,
        fsModule,
    } = {}) => {
        const passedArgs = {
            stencilConfigManager: stencilConfigManager || getStencilConfigManagerStub(),
            themeApiClient: themeApiClient || getThemeApiClientStub(),
            stencilPushUtils: stencilPushUtils || getStencilPushUtilsStub(),
            fsUtils: fsUtils || getFsUtilsStub(),
            fs: fsModule || getFsModuleStub(),
        };
        const instance = new StencilPull(passedArgs);

        return {
            passedArgs,
            instance,
        };
    };

    describe('constructor', () => {
        it('should create an instance of StencilPull without options parameters passed', () => {
            const instance = new StencilPull();

            expect(instance).toBeInstanceOf(StencilPull);
        });

        it('should create an instance of StencilStart with all options parameters passed', () => {
            const { instance } = createStencilPullInstance();

            expect(instance).toBeInstanceOf(StencilPull);
        });
    });

    describe('run', () => {
        it('should run stencil pull with channel id', async () => {
            const { instance } = createStencilPullInstance();

            const result = await instance.run(cliOptions);

            expect(result).toBe(true);
        });

        it('should run stencil pull without channel id', async () => {
            const themeApiClient = getThemeApiClientStub();
            const { instance } = createStencilPullInstance({ themeApiClient });

            instance.run({ saveConfigName });

            const result = await instance.run(cliOptions);

            expect(themeApiClient.getStoreChannels).toHaveBeenCalled();
            expect(result).toBe(true);
        });
    });
});
