const fetchMock = require('node-fetch');
const path = require('path');

const Server = require('../../index');
const ThemeConfig = require('../../../lib/theme-config');
const { PACKAGE_INFO } = require('../../../constants');

const themeConfigManager = ThemeConfig.getInstance(
    path.join(process.cwd(), 'test/_mocks/themes/valid'),
);

// eslint-disable-next-line node/no-unpublished-require,global-require
jest.mock('node-fetch', () => require('fetch-mock-jest').sandbox());

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
        fetchMock.mockReset();
    });

    afterAll(async () => {
        await server.stop();
    });

    it('should handle fatal errors in the storefront server response', async () => {
        const browserRequest = {
            method: 'GET',
            url: '/test',
        };
        fetchMock.mock('*', { throws: new Error('failure') });

        const localServerResponse = await server.inject(browserRequest);

        expect(localServerResponse.statusCode).toEqual(500);
    });

    it('should handle status 500 in the storefront server response', async () => {
        const browserRequest = {
            method: 'GET',
            url: '/',
        };
        fetchMock.mock('*', 500);

        const localServerResponse = await server.inject(browserRequest);

        expect(localServerResponse.statusCode).toEqual(500);
    });

    describe('when the storefront server response is Redirect', () => {
        const browserRequest = {
            method: 'post',
            url: '/login.php?action=check_login',
            payload: 'login_email=user%40gmail.com&login_pass=12345678&authenticity_token=abcdefg',
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
            },
        };

        const redirectLocationPath = '/account.php?action=order_status#first';
        const storefrontResponseHeaders = new fetchMock.Headers({
            location: `${normalStoreUrl}${redirectLocationPath}`,
        });
        // Fetch.Headers have implementation problem that it joins headers with that same name,
        //  so we have to set an array directly to the raw value
        storefrontResponseHeaders.raw()['set-cookie'] = [
            'SHOP_SESSION_TOKEN=aaaaaaaaaaaaaa; expires=Mon, 12-Oct-2020 17:40:04 GMT; path=/; Secure; HttpOnly; SameSite=none',
            'fornax_anonymousId=bbbbbbbbbbbbbb; expires=Wed, 05-Oct-2022 17:40:04 GMT; path=/; Secure; SameSite=none',
            'RECENTLY_VIEWED_PRODUCTS=cccccccc; expires=Thu, 01-Jan-1970 00:00:01 GMT; path=/; Secure; SameSite=none',
            'SHOP_TOKEN=dddddddddddddddddddddd; expires=Mon, 12-Oct-2020 17:40:04 GMT; path=/; Secure; HttpOnly; SameSite=none',
        ];
        let localServerResponse;

        beforeEach(async () => {
            fetchMock.mock('*', {
                status: 301,
                headers: storefrontResponseHeaders,
            });

            localServerResponse = await server.inject(browserRequest);
        });

        it('should send a request to the storefront server with correct url', async () => {
            expect(fetchMock.lastUrl()).toEqual(`${storeUrl}${browserRequest.url}`);
        });

        it('should pass request method from the browser request to the storefront server request', async () => {
            expect(fetchMock.lastOptions().method).toEqual(browserRequest.method);
        });

        it('should pass body from the browser request to the storefront server request', async () => {
            expect(fetchMock.lastOptions().body).toEqual(browserRequest.payload);
        });

        it('should send a request to the storefront server with correct headers', async () => {
            expect(fetchMock.lastOptions().headers).toMatchObject({
                'content-type': 'application/x-www-form-urlencoded',
                host: new URL(storeUrl).host,
                'stencil-cli': PACKAGE_INFO.version,
                'stencil-options': '{"get_template_file":true,"get_data_only":true}',
                'stencil-version': PACKAGE_INFO.config.stencil_version,
                'accept-encoding': 'identity',
            });
        });

        it('should avoid automatic handling of redirects by fetch library', async () => {
            expect(fetchMock.lastOptions().redirect).toEqual('manual');
        });

        it('should return a correct status code', async () => {
            expect(localServerResponse.statusCode).toEqual(301);
        });

        it("should return a location header value equal to the URL's path if the URL's host equal to the storeURL", async () => {
            expect(localServerResponse.headers.location).toEqual(redirectLocationPath);
        });

        it('should return an array of set-cookie headers with removed "Secure" and "SameSite" settings', async () => {
            expect(localServerResponse.headers['set-cookie']).toEqual([
                'SHOP_SESSION_TOKEN=aaaaaaaaaaaaaa; expires=Mon, 12-Oct-2020 17:40:04 GMT; path=/; HttpOnly',
                'fornax_anonymousId=bbbbbbbbbbbbbb; expires=Wed, 05-Oct-2022 17:40:04 GMT; path=/',
                'RECENTLY_VIEWED_PRODUCTS=cccccccc; expires=Thu, 01-Jan-1970 00:00:01 GMT; path=/',
                'SHOP_TOKEN=dddddddddddddddddddddd; expires=Mon, 12-Oct-2020 17:40:04 GMT; path=/; HttpOnly',
            ]);
        });
    });

    it('should handle Unauthorized in the storefront server response', async () => {
        const browserRequest = {
            method: 'GET',
            url: '/',
        };
        const storefrontServerResponse = {
            status: 401,
            headers: {
                'content-type': 'text/html',
            },
        };
        fetchMock.mock('*', storefrontServerResponse);

        const localServerResponse = await server.inject(browserRequest);

        expect(localServerResponse.statusCode).toEqual(401);
    });

    describe('when the storefront server response is Success and content-type is not JSON', () => {
        const browserRequest = {
            method: 'get',
            url: '/checkout.php',
            headers: {
                cookie: 'bcactive=yes; lastVisitedCategory=23; STORE_VISITOR=1',
            },
        };

        const storefrontResponseHeaders = new fetchMock.Headers({
            'content-type': 'text/html; charset=utf-8',
        });
        // Fetch.Headers have implementation problem that it joins headers with that same name,
        //  so we have to set an array directly to the raw value
        storefrontResponseHeaders.raw()['set-cookie'] = [
            'SHOP_SESSION_TOKEN=aaaaaaaaaaaaaa; expires=Mon, 12-Oct-2020 17:40:04 GMT; path=/; Secure; HttpOnly; SameSite=none',
            'fornax_anonymousId=bbbbbbbbbbbbbb; expires=Wed, 05-Oct-2022 17:40:04 GMT; path=/; Secure; SameSite=none',
            'RECENTLY_VIEWED_PRODUCTS=cccccccc; expires=Thu, 01-Jan-1970 00:00:01 GMT; path=/; Secure; SameSite=none',
            'SHOP_TOKEN=dddddddddddddddddddddd; expires=Mon, 12-Oct-2020 17:40:04 GMT; path=/; Secure; HttpOnly; SameSite=none',
        ];
        const storefrontServerResponse = {
            status: 200,
            headers: storefrontResponseHeaders,
            body:
                '<!DOCTYPE html>' +
                '<html>' +
                '<head>' +
                '<title>Checkout</title>' +
                '<body>' +
                'Checkout page body' +
                '</body>' +
                '</html>',
        };
        let localServerResponse;

        beforeEach(async () => {
            fetchMock.mock('*', storefrontServerResponse);

            localServerResponse = await server.inject(browserRequest);
        });

        it('should send a request to the storefront server with correct url', async () => {
            expect(fetchMock.lastUrl()).toEqual(`${storeUrl}${browserRequest.url}`);
        });

        it('should pass request method from browser request to the storefront server request', async () => {
            expect(fetchMock.lastOptions().method).toEqual(browserRequest.method);
        });

        it('should send a request to the storefront server with correct headers', async () => {
            expect(fetchMock.lastOptions().headers).toMatchObject({
                cookie: browserRequest.headers.cookie,
                host: new URL(storeUrl).host,
                'stencil-cli': PACKAGE_INFO.version,
                'stencil-options': '{"get_template_file":true,"get_data_only":true}',
                'stencil-version': PACKAGE_INFO.config.stencil_version,
                'accept-encoding': 'identity',
            });
        });

        it('should return a correct status code', async () => {
            expect(localServerResponse.statusCode).toEqual(200);
        });

        it('should return correct headers', async () => {
            expect(localServerResponse.headers).toMatchObject({
                'content-type': storefrontServerResponse.headers.get('content-type'),
                'set-cookie': [
                    'SHOP_SESSION_TOKEN=aaaaaaaaaaaaaa; expires=Mon, 12-Oct-2020 17:40:04 GMT; path=/; Secure; HttpOnly',
                    'fornax_anonymousId=bbbbbbbbbbbbbb; expires=Wed, 05-Oct-2022 17:40:04 GMT; path=/; Secure',
                    'RECENTLY_VIEWED_PRODUCTS=cccccccc; expires=Thu, 01-Jan-1970 00:00:01 GMT; path=/; Secure',
                    'SHOP_TOKEN=dddddddddddddddddddddd; expires=Mon, 12-Oct-2020 17:40:04 GMT; path=/; Secure; HttpOnly',
                ],
            });
        });

        it('should return a correct response body', async () => {
            expect(localServerResponse.payload).toEqual(
                '<!DOCTYPE html>' +
                    '<html>' +
                    '<head>' +
                    '<title>Checkout</title>' +
                    '<link href="/stencil/00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000001/css/checkout.css" type="text/css" rel="stylesheet"></head>' +
                    '<body>' +
                    'Checkout page body' +
                    '</body>' +
                    '</html>',
            );
        });
    });
});
