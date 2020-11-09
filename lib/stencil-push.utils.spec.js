const fetchMock = require('node-fetch');

const { getStoreHash } = require('./stencil-push.utils');

// eslint-disable-next-line node/no-unpublished-require,global-require
jest.mock('node-fetch', () => require('fetch-mock-jest').sandbox());

describe('stencil push utils', () => {
    const mockConfig = {
        normalStoreUrl: 'https://www.example.com',
        port: 4000,
        accessToken: 'accessTokenValue',
    };

    afterEach(() => {
        jest.restoreAllMocks();
        fetchMock.mockReset();
    });

    describe('.getStoreHash()', () => {
        it('should get the store hash', async () => {
            const mockResponseData = {
                store_hash: 'abc123',
            };
            fetchMock.mock('*', mockResponseData);

            const result = await getStoreHash({ config: mockConfig });

            expect(result.storeHash).toEqual(mockResponseData.store_hash);
            expect(result.config.normalStoreUrl).toEqual(mockConfig.normalStoreUrl);
        });

        it('should return an error if it fails to retrieve the store hash', async () => {
            const mockResponseData = {};
            fetchMock.mock('*', mockResponseData);

            await expect(getStoreHash({ config: mockConfig })).rejects.toThrow(
                'Received empty store_hash value in the server response',
            );
        });
    });
});
