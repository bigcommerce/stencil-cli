'use strict';

const Wreck = require('wreck');
const { promisify } = require('util');

const mockConfig = require('../test/_mocks/bin/dotStencilFile.json');
const { MockDB } = require('../test/_mocks/MockDB');
const { getStoreHash } = require('./stencil-push.utils');

const mockDb = new MockDB();

describe('stencil push utils', () => {
    beforeEach(() => {
        jest.spyOn(Wreck, 'request').mockImplementation(
            (method, url, options, cb) => cb(null, mockDb.data),
        );
        jest.spyOn(Wreck, 'read').mockImplementation(
            (response, options, cb) => cb(null, response),
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('.getStoreHash()', () => {
        mockDb.data = {
            store_hash: 'abc123',
            statusCode: 200,
        };

        it('should get the store hash', async () => {
            const result = await promisify(getStoreHash)({ config: mockConfig });

            expect(result.storeHash).toEqual(mockDb.data.store_hash);
            expect(result.config.normalStoreUrl).toEqual(mockConfig.normalStoreUrl);
        });
    });
});
