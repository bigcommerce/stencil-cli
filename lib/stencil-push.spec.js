'use strict';

const Code = require('code');
const Lab = require('@hapi/lab');
const sinon = require('sinon');
const Wreck = require('wreck');
const { promisify } = require('util');

const StencilPush = require('./stencil-push');
const utils = require('./stencil-push.utils.js');

const expect = Code.expect;
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
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

    lab.beforeEach(() => {
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
    });

    lab.afterEach(() => {
        sandbox.restore();
    });

    it('should throw an error if dotStencilFilePath is not provided', () => {
        const throws = () => {
            StencilPush();
        };

        expect(throws).to.throw('dotStencilFilePath is required!');
    });

    it('should return an error if dotStencilFilePath does not map to a file', async () => {
        let error;
        try {
            await promisify(StencilPush)({ dotStencilFilePath: 'DNE' });
        } catch (err) {
            error = err;
        }

        expect(error).to.be.an.error(/ENOENT/);
    });

    it('should return an error if it fails to retrieve the store hash', async () => {
        const dotStencilFilePath = `${__dirname}/../test/_mocks/bin/dotStencilFile.json`;
        let error;
        try {
            await promisify(StencilPush)({ dotStencilFilePath });
        } catch (err) {
            error = err;
        }

        expect(error).to.be.an.error('Failed to retrieve store hash');
    });
});
