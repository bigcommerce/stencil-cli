import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import cache from 'memory-cache';
import path from 'path';
import fs from 'fs';
import { jest } from '@jest/globals';
import { PassThrough } from 'stream';
import Server from '../../index.js';
import langAssembler from '../../../lib/lang-assembler.js';
import ThemeConfig from '../../../lib/theme-config.js';
import { readFromStream } from '../../../lib/utils/asyncUtils.js';
import { PACKAGE_INFO } from '../../../constants.js';

const themeConfigManager = ThemeConfig.getInstance(
    path.join(process.cwd(), 'test/_mocks/themes/valid'),
);
const axiosMock = new MockAdapter(axios);
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
        storeSettingsLocale: {
            shopper_language_selection_method: 'default_shopper_language',
            default_shopper_language: 'en',
        },
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
    it('should handle fatal errors in the storefront server response', async () => {
        const browserRequest = {
            method: 'GET',
            url: '/test',
        };
        axiosMock.onGet().reply(() => {
            throw new Error('failure');
        });
        const localServerResponse = await server.inject(browserRequest);
        expect(localServerResponse.statusCode).toEqual(500);
    });
    it('should handle status 500 in the storefront server response', async () => {
        const browserRequest = {
            method: 'GET',
            url: '/',
        };
        axiosMock.onGet().reply(500);
        const localServerResponse = await server.inject(browserRequest);
        expect(localServerResponse.statusCode).toEqual(500);
    });
    describe('when the channel url is set it should be used to proxy calls to API', () => {
        it('should proxy browser requests with host = secondStoreUrl', async () => {
            const browserRequest = {
                method: 'GET',
                url: '/',
            };
            axiosMock.onGet().reply(200, {});
            await server.inject(browserRequest);
            expect(axiosMock.history.get[0].url).toEqual(`${storeUrl}${browserRequest.url}`);
        });
        it('should proxy storefront requests with host = secondStoreUrl', async () => {
            const browserRequest = {
                method: 'GET',
                url: '/account.php',
            };
            axiosMock.onGet().reply(200, {});
            await server.inject(browserRequest);
            expect(axiosMock.history.get[0].url).toEqual(`${storeUrl}${browserRequest.url}`);
        });
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
        const storefrontResponseHeaders = {
            location: `${normalStoreUrl}${redirectLocationPath}`,
            'set-cookie': [
                'SHOP_SESSION_TOKEN=aaaaaaaaaaaaaa; expires=Mon, 12-Oct-2020 17:40:04 GMT; path=/; Secure; HttpOnly; SameSite=none',
                'fornax_anonymousId=bbbbbbbbbbbbbb; expires=Wed, 05-Oct-2022 17:40:04 GMT; path=/; Secure; SameSite=none',
                'RECENTLY_VIEWED_PRODUCTS=cccccccc; expires=Thu, 01-Jan-1970 00:00:01 GMT; path=/; Secure; SameSite=none',
                'SHOP_TOKEN=dddddddddddddddddddddd; expires=Mon, 12-Oct-2020 17:40:04 GMT; path=/; Secure; HttpOnly; SameSite=none',
            ],
        };
        let localServerResponse;
        beforeEach(async () => {
            axiosMock.onPost().reply(301, undefined, storefrontResponseHeaders);
            localServerResponse = await server.inject(browserRequest);
        });
        it('should send a request to the storefront server with correct url', async () => {
            expect(axiosMock.history.post[0].url).toEqual(`${storeUrl}${browserRequest.url}`);
        });
        it('should pass request method from the browser request to the storefront server request', async () => {
            expect(axiosMock.history.post[0].method).toEqual(browserRequest.method);
        });
        it('should pass body from the browser request to the storefront server request', async () => {
            const sentData = await readFromStream(axiosMock.history.post[0].data);
            expect(sentData).toEqual(browserRequest.payload);
        });
        it('should send a request to the storefront server with correct headers', async () => {
            expect(axiosMock.history.post[0].headers).toMatchObject({
                'Content-Type': 'application/x-www-form-urlencoded',
                host: new URL(storeUrl).host,
                'stencil-cli': PACKAGE_INFO.version,
                'stencil-options': '{"get_template_file":true,"get_data_only":true}',
                'stencil-version': PACKAGE_INFO.config.stencil_version,
                'accept-encoding': 'identity',
            });
        });
        it('should avoid automatic handling of redirects by fetch library', async () => {
            expect(axiosMock.history.post[0].maxRedirects).toEqual(0);
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
        const storefrontServerResponseData = 'Response test body';
        const storefrontServerResponseHeaders = {
            'content-type': 'text/html',
        };
        axiosMock.onGet().reply(401, storefrontServerResponseData, storefrontServerResponseHeaders);
        const localServerResponse = await server.inject(browserRequest);
        expect(localServerResponse.statusCode).toEqual(401);
        expect(localServerResponse.payload).toEqual(storefrontServerResponseData);
    });
    describe('when the storefront server response is Success and content-type is "text/html"', () => {
        const browserRequest = {
            method: 'get',
            url: '/checkout.php',
            headers: {
                cookie: 'bcactive=yes; lastVisitedCategory=23; STORE_VISITOR=1',
            },
        };
        const storefrontResponseHeaders = {
            'content-type': 'text/html; charset=utf-8',
            'set-cookie': [
                'SHOP_SESSION_TOKEN=aaaaaaaaaaaaaa; expires=Mon, 12-Oct-2020 17:40:04 GMT; path=/; Secure; HttpOnly; SameSite=none',
                'fornax_anonymousId=bbbbbbbbbbbbbb; expires=Wed, 05-Oct-2022 17:40:04 GMT; path=/; Secure; SameSite=none',
                'RECENTLY_VIEWED_PRODUCTS=cccccccc; expires=Thu, 01-Jan-1970 00:00:01 GMT; path=/; Secure; SameSite=none',
                'SHOP_TOKEN=dddddddddddddddddddddd; expires=Mon, 12-Oct-2020 17:40:04 GMT; path=/; Secure; HttpOnly; SameSite=none',
            ],
        };
        const storefrontResponseBody =
            '<!DOCTYPE html>' +
            '<html>' +
            '<head>' +
            '<title>Checkout</title>' +
            '<body>' +
            'Checkout page body' +
            '</body>' +
            '</html>';
        let localServerResponse;
        beforeEach(async () => {
            axiosMock.onGet().reply(200, storefrontResponseBody, storefrontResponseHeaders);
            localServerResponse = await server.inject(browserRequest);
        });
        it('should send a request to the storefront server with correct url', async () => {
            expect(axiosMock.history.get[0].url).toEqual(`${storeUrl}${browserRequest.url}`);
        });
        it('should pass request method from browser request to the storefront server request', async () => {
            expect(axiosMock.history.get[0].method).toEqual(browserRequest.method);
        });
        it('should send a request to the storefront server with correct headers', async () => {
            expect(axiosMock.history.get[0].headers).toMatchObject({
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
                'content-type': storefrontResponseHeaders['content-type'],
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
    describe('when the storefront server response is Success and content-type is "image"', () => {
        const browserRequest = {
            method: 'get',
            url: '/images/cat_and_dog.jpeg',
        };
        const testImage = fs.readFileSync('./test/assets/cat_and_dog.jpeg');
        const storefrontResponseHeaders = {
            'content-type': 'image/jpeg',
        };
        let localServerResponse;
        beforeEach(async () => {
            axiosMock.onGet().reply(200, testImage, storefrontResponseHeaders);
            localServerResponse = await server.inject(browserRequest);
        });
        it('should send a request to the storefront server with correct url', async () => {
            expect(axiosMock.history.get[0].url).toEqual(`${storeUrl}${browserRequest.url}`);
        });
        it('should pass request method from browser request to the storefront server request', async () => {
            expect(axiosMock.history.get[0].method).toEqual(browserRequest.method);
        });
        it('should return a correct status code', async () => {
            expect(localServerResponse.statusCode).toEqual(200);
        });
        it('should return correct headers', async () => {
            expect(localServerResponse.headers).toMatchObject({
                'content-type': storefrontResponseHeaders['content-type'],
                // Beware, if our local server parsed the storefront server response wrongly -
                // content-length will be different
                'content-length': 6858,
            });
        });
        it('should return a correct response body', async () => {
            expect(localServerResponse.rawPayload).toBeInstanceOf(Buffer);
            expect(localServerResponse.rawPayload).toEqual(testImage);
        });
    });

    describe('theme language with a fixed English store locale', () => {
        const url = '/localized';
        const storefrontUrl = `${storeUrl}${url}`;
        const jsonHeaders = { 'content-type': 'application/json' };
        const localeHeader = 'x-bc-stencil-accept-language';
        const page = { pencil_response: true, template_file: 'pages/localized' };
        const settings = { base_url: normalStoreUrl, secure_base_url: storeUrl };
        const jsonStream = (data) => {
            const stream = new PassThrough();
            stream.end(JSON.stringify(data));
            return stream;
        };

        let assembleTranslations;
        beforeEach(() => {
            assembleTranslations = jest
                .spyOn(langAssembler, 'assemble')
                .mockImplementation((callback) => {
                    callback(null, {
                        en: JSON.stringify({ home: { heading: 'Home' } }),
                        da: JSON.stringify({ home: { heading: 'Hjem' } }),
                        'da-dk': JSON.stringify({ home: { heading: 'Hjem' } }),
                    });
                });
        });
        afterEach(() => {
            assembleTranslations.mockRestore();
            cache.clear();
        });

        it.each([
            {
                description:
                    'uses the final Storefront header even when it matches the first browser tag',
                browserLanguage: 'da,en;q=0.9',
                legacyLocale: 'da',
                storefrontLanguage: 'da',
                language: 'da',
                greeting: 'Hjem',
            },
            {
                description:
                    'ignores the legacy JSON locale and the first response header when the final header is missing',
                browserLanguage: 'da,en;q=0.9',
                legacyLocale: 'da-DK',
                language: 'en',
                greeting: 'Home',
            },
            {
                description: 'uses the next supported language in the final Storefront header',
                browserLanguage: 'en',
                storefrontLanguage: 'fr,da;q=0.9,en;q=0.8',
                language: 'da',
                greeting: 'Hjem',
            },
        ])(
            '$description',
            async ({ browserLanguage, legacyLocale, storefrontLanguage, language, greeting }) => {
                axiosMock
                    .onGet(storefrontUrl)
                    .replyOnce(200, jsonStream(page), { ...jsonHeaders, [localeHeader]: 'da-dk' });
                axiosMock.onGet(storefrontUrl).replyOnce(
                    200,
                    {
                        ...page,
                        context: {
                            settings: {
                                ...settings,
                                request: legacyLocale === undefined ? {} : { locale: legacyLocale },
                            },
                        },
                    },
                    storefrontLanguage === undefined
                        ? jsonHeaders
                        : { ...jsonHeaders, [localeHeader]: storefrontLanguage },
                );

                const response = await server.inject({
                    method: 'GET',
                    url,
                    headers: { 'accept-language': browserLanguage },
                });
                expect(axiosMock.history.get).toHaveLength(2);
                expect(response.statusCode).toEqual(200);
                expect(response.payload).toContain(`<html lang="${language}">`);
                expect(response.payload).toContain(`<h1>${greeting}</h1>`);
            },
        );

        it('uses the Storefront header from the single remote response', async () => {
            const remotePage = { ...page, remote: true, remote_data: {}, context: { settings } };
            axiosMock
                .onGet(storefrontUrl)
                .replyOnce(200, jsonStream(remotePage), { ...jsonHeaders, [localeHeader]: 'da' });

            const response = await server.inject({
                method: 'GET',
                url,
                headers: { 'accept-language': 'en' },
            });
            expect(axiosMock.history.get).toHaveLength(1);
            expect(response.statusCode).toEqual(200);
            const { content } = response.result;
            expect(content).toContain('<html lang="da">');
            expect(content).toContain('<h1>Hjem</h1>');
        });
    });

    describe('WebDav /content requests', () => {
        it('should return plain text response for /content path', async () => {
            const browserRequest = {
                method: 'GET',
                url: '/content/test.txt',
            };
            const testString = 'webdav test content';
            // Simulate a stream response for /content path
            const stream = new PassThrough();
            stream.end(testString);
            axiosMock.onGet().reply(200, stream, { 'content-type': 'text/plain' });
            const localServerResponse = await server.inject(browserRequest);
            expect(localServerResponse.statusCode).toEqual(200);
            expect(localServerResponse.payload).toEqual(testString);
        });
    });
});
