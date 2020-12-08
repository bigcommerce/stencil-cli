const axios = require('axios');
const MockAdapter = require('axios-mock-adapter');

const { getStoreHash } = require('./stencil-push.utils');

const axiosMock = new MockAdapter(axios);

describe('stencil push utils', () => {
    const mockConfig = {
        normalStoreUrl: 'https://www.example.com',
        port: 4000,
        accessToken: 'accessTokenValue',
    };

    afterEach(() => {
        jest.restoreAllMocks();
        axiosMock.reset();
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
});
