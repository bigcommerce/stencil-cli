const axios = require('axios');
const MockAdapter = require('axios-mock-adapter');
const path = require('path');

const Server = require('../../index');
const ThemeConfig = require('../../../lib/theme-config');
const { PACKAGE_INFO } = require('../../../constants');

const themeConfigManager = ThemeConfig.getInstance(
    path.join(process.cwd(), 'test/_mocks/themes/valid'),
);

const axiosMock = new MockAdapter(axios);

/**
 * We separated this suit from what we have in renderer.module.spec as it uses different server options.
 * Two servers in one file conflicted and tests failed.
 */
describe('Renderer Plugin', () => {
    const storeUrl = 'https://store-abc123.mybigcommerce.com';
    const normalStoreUrl = 'http://s123456789.mybigcommerce.com';
    const serverOptions = {
        dotStencilFile: {
            storeUrl,
            normalStoreUrl,
            port: 4000,
            username: 'testUser',
            token: '6832b1c755bb9de13aa8990216a69a7623043fd7',
        },
        useCache: false,
        themePath: themeConfigManager.themePath,
    };
    let server;

    beforeAll(async () => {
        // Prevent littering the console
        jest.spyOn(console, 'log').mockImplementation(jest.fn());
        jest.spyOn(console, 'error').mockImplementation(jest.fn());
        jest.spyOn(console, 'info').mockImplementation(jest.fn());

        server = await Server.create(serverOptions);

        // Don't log errors during the test
        server.ext('onPostHandler', (request, h) => {
            if (request.response.isBoom) {
                return h.response().code(500);
            }
            return h.continue;
        });
    });

    afterEach(() => {
        jest.resetAllMocks();
        axiosMock.reset();
    });

    afterAll(async () => {
        await server.stop();
    });

    it('should send a request to the storefront server with added custom layouts to headers when the storefront server response is Redirect', async () => {
        const browserRequest = {
            method: 'post',
            url: '/login.php?action=check_login',
            payload: 'login_email=user%40gmail.com&login_pass=12345678&authenticity_token=abcdefg',
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
            },
        };

        const redirectLocationPath = '/account.php?action=order_status#first';
        const storefrontResponseHeaders = {
            location: `${normalStoreUrl}${redirectLocationPath}`,
            'set-cookie': [
                'SHOP_SESSION_TOKEN=aaaaaaaaaaaaaa; expires=Mon, 12-Oct-2020 17:40:04 GMT; path=/; Secure; HttpOnly; SameSite=none',
                'fornax_anonymousId=bbbbbbbbbbbbbb; expires=Wed, 05-Oct-2022 17:40:04 GMT; path=/; Secure; SameSite=none',
                'RECENTLY_VIEWED_PRODUCTS=cccccccc; expires=Thu, 01-Jan-1970 00:00:01 GMT; path=/; Secure; SameSite=none',
                'SHOP_TOKEN=dddddddddddddddddddddd; expires=Mon, 12-Oct-2020 17:40:04 GMT; path=/; Secure; HttpOnly; SameSite=none',
            ],
        };
        axiosMock.onPost().reply(301, undefined, storefrontResponseHeaders);
        await server.inject(browserRequest);

        expect(axiosMock.history.post[0].headers).toMatchObject({
            'Content-Type': 'application/x-www-form-urlencoded',
            host: new URL(storeUrl).host,
            'stencil-cli': PACKAGE_INFO.version,
            'stencil-options': '{"get_template_file":true,"get_data_only":true}',
            'stencil-version': PACKAGE_INFO.config.stencil_version,
            'accept-encoding': 'identity',
            'stencil-custom-templates': '{"brand":{},"category":{},"page":{},"product":{}}',
        });
    });

    it('should send a request to the storefront server with added custom layouts to headers when the storefront server response is Success and content-type is "text/html"', async () => {
        const browserRequest = {
            method: 'get',
            url: '/checkout.php',
            headers: {
                cookie: 'bcactive=yes; lastVisitedCategory=23; STORE_VISITOR=1',
            },
        };
        axiosMock.onGet().reply(200, {});
        await server.inject(browserRequest);

        expect(axiosMock.history.get[0].headers).toMatchObject({
            cookie: browserRequest.headers.cookie,
            host: new URL(storeUrl).host,
            'stencil-cli': PACKAGE_INFO.version,
            'stencil-options': '{"get_template_file":true,"get_data_only":true}',
            'stencil-version': PACKAGE_INFO.config.stencil_version,
            'accept-encoding': 'identity',
            'stencil-custom-templates': '{"brand":{},"category":{},"page":{},"product":{}}',
        });
    });
});
