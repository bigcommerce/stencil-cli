const StencilDebug = require('./StencilDebug');
const { PACKAGE_INFO } = require('../constants');

describe('StencilDebug', () => {
    const name = 'Cornerstone';
    const version = '6.3.0';
    /* eslint-disable-next-line camelcase */
    const template_engine = 'handlebars_v4';
    /* eslint-disable-next-line camelcase */
    const css_compiler = 'scss';
    /* eslint-disable-next-line camelcase */
    const author_name = 'Bigcommerce';
    const port = 3000;
    const apiHost = 'https://api.bigcommerce.com';
    const normalStoreUrl = 'https://shop.bigcommerce.com';
    const osType = 'Darwin';
    const osVersion =
        'Darwin Kernel Version 21.3.0: Wed Jan  5 21:37:58 PST 2022; root:xnu-8019.80.24~20/RELEASE_X86_64';

    let logger;
    let themeConfig;
    let stencilConfigManager;
    let os;
    beforeEach(() => {
        logger = {
            log: jest.fn(),
        };
        themeConfig = {
            configExists: () => true,
            getRawConfig: () => ({
                name,
                version,
                template_engine,
                css_compiler,
                meta: {
                    author_name,
                },
            }),
        };
        stencilConfigManager = {
            read: () => ({
                port,
                apiHost,
                normalStoreUrl,
            }),
        };
        os = {
            type: () => osType,
            version: () => osVersion,
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should return stencil debug information', async () => {
        await new StencilDebug({ logger, themeConfig, stencilConfigManager, os }).run({
            output: false,
        });
        const result = {
            platform: {
                type: osType,
                version: osVersion,
            },
            version: PACKAGE_INFO.version,
            nodeVersion: process.version,
            stencil: {
                apiHost,
                normalStoreUrl,
                port,
            },
            theme: {
                name,
                version,
                template_engine,
                css_compiler,
                author_name,
            },
        };
        expect(logger.log).toHaveBeenCalledWith(JSON.stringify(result));
    });

    it('should throw an error, when command is run outside theme location', async () => {
        await expect(new StencilDebug().run()).rejects.toThrow();
    });
});
