'use strict';

const Wreck = require('wreck');
const { promisify } = require('util');

const StencilPush = require('./stencil-push');
const utils = require('./stencil-push.utils.js');
const { MockDB } = require('../test/_mocks/MockDB');

const mockDb = new MockDB();

describe('stencil push', () => {
    beforeEach(() => {
        jest.spyOn(Wreck, 'get').mockImplementation(requestStub);
        jest.spyOn(Wreck, 'post').mockImplementation(requestStub);
        jest.spyOn(Wreck, 'put').mockImplementation(requestStub);
        jest.spyOn(utils, 'generateBundle').mockImplementation(utilStub({
            bundleZipPath: 'bundleZipPath',
        }));
        jest.spyOn(utils, 'promptUserWhetherToApplyTheme').mockImplementation(utilStub({
            applyTheme: true,
        }));
        jest.spyOn(utils, 'promptUserForVariation').mockImplementation(utilStub({
            variationId: 'bold',
        }));

        function requestStub(url, options, callback) {
            process.nextTick(() => {
                callback(null, { statusCode: 200 }, mockDb.data);
            });
        }

        function utilStub(data) {
            return async options => ({...options, ...data});
        }
    });

    afterEach(() => {
        jest.restoreAllMocks();
        mockDb.data = {};
    });

    it('should throw an error if dotStencilFilePath is not provided', () => {
        const throws = () => {
            StencilPush();
        };

        expect(throws).toThrow('dotStencilFilePath is required!');
    });

    it('should return an error if dotStencilFilePath does not map to a file', async () => {
        await expect(
            promisify(StencilPush)({ dotStencilFilePath: 'DNE' }),
        ).rejects.toThrow(/ENOENT/);
    });

    it('should return an error if it fails to retrieve the store hash', async () => {
        const dotStencilFilePath = `${__dirname}/../test/_mocks/bin/dotStencilFile.json`;

        await expect(
            promisify(StencilPush)({ dotStencilFilePath }),
        ).rejects.toThrow('Failed to retrieve store hash');
    });
});
