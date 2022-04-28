const axios = require('axios');
const MockAdapter = require('axios-mock-adapter');

const {
    getStoreHash,
    promptUserForChannel,
    promptUserForChannels,
    promptUserToSelectChannels,
    getChannels,
} = require('./stencil-push.utils');
const utils = require('./stencil-push.utils');
const themeApiClient = require('./theme-api-client');

const axiosMock = new MockAdapter(axios);

describe('stencil push utils', () => {
    const mockConfig = {
        normalStoreUrl: 'https://www.example.com',
        port: 4000,
        accessToken: 'accessTokenValue',
    };
    const optionsApplyThemeIsFalse = {
        config: { accessToken: 'asdasd33' },
        applyTheme: false,
        apiHost: 'abc2342',
    };
    const optionsApplyThemeIsTrueAndChannels = {
        config: { accessToken: 'asdasd33' },
        applyTheme: true,
        channelIds: [1, 2],
    };
    const optionsResult = {
        applyTheme: true,
        apiHost: 'abc2342',
        allChannels: true,
        channels: [
            {
                url: 'https://abc.com',
                channel_id: 1,
            },
            {
                url: 'https://fff.com',
                channel_id: 2,
            },
        ],
        channelIds: [1, 2],
    };

    beforeEach(() => {
        jest.spyOn(console, 'info').mockImplementation(jest.fn());
    });

    afterEach(() => {
        jest.restoreAllMocks();
        axiosMock.reset();
        jest.clearAllMocks();
    });

    describe('.getStoreHash()', () => {
        it('should get the store hash', async () => {
            const mockResponseData = {
                store_hash: 'abc123',
            };
            axiosMock.onGet().reply(200, mockResponseData);

            const result = await getStoreHash({ config: mockConfig });

            expect(result.storeHash).toEqual(mockResponseData.store_hash);
            expect(result.config.normalStoreUrl).toEqual(mockConfig.normalStoreUrl);
        });

        it('should return an error if it fails to retrieve the store hash', async () => {
            const mockResponseData = {};
            axiosMock.onGet().reply(200, mockResponseData);

            await expect(getStoreHash({ config: mockConfig })).rejects.toThrow(
                'Received empty store_hash value in the server response',
            );
        });
    });

    describe('.getChannels', () => {
        it('should return options when applyTheme is false', async () => {
            const result = await getChannels(optionsApplyThemeIsFalse);
            expect(result).toEqual(optionsApplyThemeIsFalse);
        });

        it('should return options when applyTheme is true and channelIds available', async () => {
            const result = await getChannels(optionsApplyThemeIsTrueAndChannels);
            expect(result).toEqual(optionsApplyThemeIsTrueAndChannels);
        });

        it('should call getStoreChannels', async () => {
            const options = {
                applyTheme: true,
                config: {
                    accessToken: 'asdasdqweq',
                },
            };
            const spy = jest.spyOn(themeApiClient, 'getStoreChannels').mockReturnValue([]);

            await getChannels(options);

            expect(spy).toHaveBeenCalled();
        });
    });

    describe('.promptUserForChannel', () => {
        const mockPromptUserToSelectChannel = jest
            .spyOn(utils, 'promptUserToSelectChannel')
            .mockReturnValue({});

        it('should return options when applyTheme is false and no channelIds available', async () => {
            const result = await promptUserForChannel(optionsApplyThemeIsFalse);

            expect(mockPromptUserToSelectChannel).toHaveBeenCalledTimes(0);
            expect(result).toEqual(optionsApplyThemeIsFalse);
        });

        it('should call promptUserToSelectChannel when applyTheme is true and no channelIds available', async () => {
            const options = {
                applyTheme: true,
                apiHost: 'abc2342',
                channels: [
                    {
                        url: 'https://abc.com',
                        channel_id: 1,
                    },
                ],
            };

            const utilsPromptUserForChannelStub = jest
                .spyOn(utils, 'promptUserToSelectChannel')
                .mockReturnValue([]);

            promptUserForChannel(options);

            expect(utilsPromptUserForChannelStub).toHaveBeenCalled();
        });
    });

    describe('.promptUserForChannels', () => {
        let mockPromptUserToSelectChannel;
        beforeEach(() => {
            mockPromptUserToSelectChannel = jest
                .spyOn(utils, 'promptUserToSelectChannels')
                .mockReturnValue({});
        });

        it('should return options when applyTheme is true and channelIds available', async () => {
            const result = await promptUserForChannels(optionsApplyThemeIsTrueAndChannels);

            expect(mockPromptUserToSelectChannel).toHaveBeenCalledTimes(0);
            expect(result).toEqual(optionsApplyThemeIsTrueAndChannels);
        });

        it('should return options with all channelIds available when -allc option used', async () => {
            const options = {
                applyTheme: true,
                apiHost: 'abc2342',
                allChannels: true,
                channels: [
                    {
                        url: 'https://abc.com',
                        channel_id: 1,
                    },
                    {
                        url: 'https://fff.com',
                        channel_id: 2,
                    },
                ],
            };

            const result = await promptUserForChannels(options);

            expect(mockPromptUserToSelectChannel).toHaveBeenCalledTimes(0);
            expect(result).toEqual(optionsResult);
        });
    });
    describe('promptUserToSelectChannels', () => {
        it('should return an array with a single channel ID if a store only has a single channel', async () => {
            const channels = [
                {
                    id: 1000,
                    url: 'https://abc.com',
                    channel_id: 1,
                    created_at: '2021-06-17T00:20:30Z',
                    updated_at: '2021-06-17T00:20:36Z',
                },
            ];

            const expected = [1];

            const result = await promptUserToSelectChannels(channels);

            expect(result).toEqual(expect.arrayContaining(expected));
        });
    });
});
