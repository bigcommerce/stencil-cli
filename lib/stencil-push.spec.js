const fetchMock = require('node-fetch');
const { promisify } = require('util');

const stencilPush = require('./stencil-push');
const utils = require('./stencil-push.utils.js');
const { MockDB } = require('../test/_mocks/MockDB');

const mockDb = new MockDB();

// eslint-disable-next-line global-require,node/no-unpublished-require
jest.mock('node-fetch', () => require('fetch-mock-jest').sandbox());

describe('stencil push', () => {
    beforeEach(() => {
        fetchMock.mock('*', mockDb.data);

        const utilStub = (data) => async (options) => ({ ...options, ...data });

        jest.spyOn(utils, 'generateBundle').mockImplementation(
            utilStub({
                bundleZipPath: 'bundleZipPath',
            }),
        );
        jest.spyOn(utils, 'promptUserWhetherToApplyTheme').mockImplementation(
            utilStub({
                applyTheme: true,
            }),
        );
        jest.spyOn(utils, 'promptUserForVariation').mockImplementation(
            utilStub({
                variationId: 'bold',
            }),
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
        fetchMock.mockReset();
        mockDb.data = {};
    });

    it('should throw an error if dotStencilFilePath is not provided', async () => {
        await expect(promisify(stencilPush)({})).rejects.toThrow('dotStencilFilePath is required!');
    });

    it('should return an error if dotStencilFilePath does not map to a file', async () => {
        await expect(promisify(stencilPush)({ dotStencilFilePath: 'DNE' })).rejects.toThrow(
            /ENOENT/,
        );
    });

    it('should return an error if it fails to retrieve the store hash', async () => {
        const dotStencilFilePath = `${__dirname}/../test/_mocks/bin/dotStencilFile.json`;

        await expect(promisify(stencilPush)({ dotStencilFilePath })).rejects.toThrow(
            'Received empty store_hash value in the server response',
        );
    });
});
