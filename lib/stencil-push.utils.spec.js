const fetchMock = require('node-fetch');

const mockConfig = require('../test/_mocks/bin/dotStencilFile.json');
const { MockDB } = require('../test/_mocks/MockDB');
const { getStoreHash } = require('./stencil-push.utils');

const mockDb = new MockDB();

// eslint-disable-next-line node/no-unpublished-require,global-require
jest.mock('node-fetch', () => require('fetch-mock-jest').sandbox());

describe('stencil push utils', () => {
    beforeEach(() => {
        fetchMock.mock('*', mockDb.data);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        fetchMock.mockReset();
    });

    describe('.getStoreHash()', () => {
        mockDb.data = {
            store_hash: 'abc123',
            statusCode: 200,
        };

        it('should get the store hash', async () => {
            const result = await getStoreHash({ config: mockConfig });

            expect(result.storeHash).toEqual(mockDb.data.store_hash);
            expect(result.config.normalStoreUrl).toEqual(mockConfig.normalStoreUrl);
        });
    });
});
