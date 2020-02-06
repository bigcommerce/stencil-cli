'use strict';

const Code = require('code');
const Lab = require('lab');
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const expect = Code.expect;
const it = lab.it;
const sinon = require('sinon');
const StencilPush = require('./stencil-push');
const utils = require('./stencil-push.utils.js');
const Wreck = require('wreck');
const mockDb = {
    _data: {},
    get data() {
        return this._data;
    },
    set data(data) {
        this._data = data;
    },
};

describe('stencil push', () => {
    let sandbox;

    lab.beforeEach(done => {
        mockDb.data = {};
        sandbox = sinon.createSandbox();

        sandbox.stub(Wreck, 'get').callsFake(requestStub);
        sandbox.stub(Wreck, 'post').callsFake(requestStub);
        sandbox.stub(Wreck, 'put').callsFake(requestStub);
        sandbox.stub(utils, 'generateBundle').callsFake(utilStub({
            bundleZipPath: 'bundleZipPath',
        }));
        sandbox.stub(utils, 'promptUserWhetherToApplyTheme').callsFake(utilStub({
            applyTheme: true,
        }));
        sandbox.stub(utils, 'promptUserForVariation').callsFake(utilStub({
            variationId: 'bold',
        }));

        function requestStub(url, options, callback) {
            process.nextTick(() => {
                callback(null, { statusCode: 200 }, mockDb.data);
            });
        }

        function utilStub(data) {
            return (options, callback) => {
                process.nextTick(() => {
                    callback(null, Object.assign({}, options, data));
                });
            };
        }

        done();
    });

    lab.afterEach(done => {
        sandbox.restore();
        done();
    });

    it('should throw an error if dotStencilFilePath is not provided', done => {
        const throws = () => {
            StencilPush();
        };

        expect(throws).to.throw('dotStencilFilePath is required!');
        done();
    });

    it('should return an error if dotStencilFilePath does not map to a file', done => {
        StencilPush({
            dotStencilFilePath: 'DNE',
        }, err => {
            expect(err).to.be.an.error(/ENOENT/);
            done();
        });
    });

    it('should return an error if it fails to retrieve the store hash', done => {
        const dotStencilFilePath = `${__dirname}/../test/_mocks/bin/dotStencilFile.json`;

        StencilPush({ dotStencilFilePath }, err => {
            expect(err).to.be.an.error('Failed to retrieve store hash');
            done();
        });
    });
});
