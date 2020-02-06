'use strict';

const Code = require('code');
const Lab = require('lab');
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const expect = Code.expect;
const mockConfig = require('../test/_mocks/bin/dotStencilFile.json');
const it = lab.it;
const sinon = require('sinon');
const Wreck = require('wreck');
const utils = require('./stencil-push.utils');
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
    lab.beforeEach(done => {
        this.wreckReqStub = sinon.stub(Wreck, 'request').callsFake((method, url, options, callback) => {
            callback(null, mockDb.data);
        });
        this.wreckReadStub = sinon.stub(Wreck, 'read').callsFake((response, options, callback) => {
            callback(null, response);
        });
        done();
    });

    lab.afterEach(done => {
        this.wreckReqStub.restore();
        this.wreckReadStub.restore();
        done();
    });

    describe('.getStoreHash()', () => {
        mockDb.data = {
            store_hash: 'abc123',
            statusCode: 200,
        };

        it('should get the store hash', done => {
            utils.getStoreHash({ config: mockConfig }, (err, result) => {
                expect(err).to.be.null();
                expect(result.storeHash).to.be.equal(mockDb.data.store_hash);
                expect(result.config.normalStoreUrl).to.be.equal(mockConfig.normalStoreUrl);
                done();
            });
        });
    });
});
