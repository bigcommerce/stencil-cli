'use strict';

const Code = require('code');
const Lab = require('@hapi/lab');
const sinon = require('sinon');
const Wreck = require('wreck');
const { promisify } = require('util');

const mockConfig = require('../test/_mocks/bin/dotStencilFile.json');
const { getStoreHash } = require('./stencil-push.utils');

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;
const mockDb = {
    _data: {},
    get data() {
        return this._data;
    },
    set data(data) {
        this._data = data;
    },
};

describe('stencil push utils', () => {
    lab.beforeEach(() => {
        this.wreckReqStub = sinon.stub(Wreck, 'request').callsFake((method, url, options, callback) => {
            callback(null, mockDb.data);
        });
        this.wreckReadStub = sinon.stub(Wreck, 'read').callsFake((response, options, callback) => {
            callback(null, response);
        });
    });

    lab.afterEach(() => {
        this.wreckReqStub.restore();
        this.wreckReadStub.restore();
    });

    describe('.getStoreHash()', () => {
        mockDb.data = {
            store_hash: 'abc123',
            statusCode: 200,
        };

        it('should get the store hash', async () => {
            const result = await promisify(getStoreHash)({ config: mockConfig });

            expect(result.storeHash).to.be.equal(mockDb.data.store_hash);
            expect(result.config.normalStoreUrl).to.be.equal(mockConfig.normalStoreUrl);
        });
    });
});
