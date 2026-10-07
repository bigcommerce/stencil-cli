import { jest } from '@jest/globals';
import http from 'http';
import { webcrypto } from 'crypto';
import {
    buildSigningString,
    createPreviewProxy,
    getSignedPath,
    isLoopbackHost,
    rewriteLocation,
    signPreviewRequest,
} from './preview-proxy.js';

const sessionId = '0b6f9c3e-4d2a-4f7b-9a1c-2e3d4f5a6b7c';
const accessKey = '0123456789abcdef'.repeat(4);
const timestamp = 1791400000000;
const storeOrigin = 'https://store.example.com';

// Same steps as verifySignature() in makeswift-stencil-worker verify-preview-proof.ts.
async function workerVerifies({ signature, signingString, key = accessKey }) {
    const cryptoKey = await webcrypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(key),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify'],
    );
    return webcrypto.subtle.verify(
        'HMAC',
        cryptoKey,
        Buffer.from(signature, 'hex'),
        new TextEncoder().encode(signingString),
    );
}

describe('preview-proxy', () => {
    describe('buildSigningString', () => {
        it('should join session, timestamp, method, and path with newlines', () => {
            expect(
                buildSigningString({
                    sessionId,
                    timestamp,
                    method: 'post',
                    pathWithQuery: '/cart.php?action=add&product_id=1',
                }),
            ).toBe(
                '0b6f9c3e-4d2a-4f7b-9a1c-2e3d4f5a6b7c\n1791400000000\nPOST\n/cart.php?action=add&product_id=1',
            );
        });
    });

    describe('signPreviewRequest', () => {
        const pathWithQuery = '/cart.php?action=add&product_id=1';

        it('should return the proof headers with a pinned signature', () => {
            expect(
                signPreviewRequest({
                    sessionId,
                    accessKey,
                    timestamp,
                    method: 'POST',
                    pathWithQuery,
                }),
            ).toEqual({
                'x-stencil-preview-session': sessionId,
                'x-stencil-preview-timestamp': '1791400000000',
                'x-stencil-preview-signature':
                    '1faf01f8cb54eebd4a3613f82e788c1adb608dee6db5b5bb97039c32682533bf',
            });
        });

        it('should make a signature that the worker accepts', async () => {
            const headers = signPreviewRequest({
                sessionId,
                accessKey,
                timestamp,
                method: 'GET',
                pathWithQuery: '/products/a%20b/?sort=new',
            });
            const signature = headers['x-stencil-preview-signature'];
            const signingString = `${sessionId}\n${timestamp}\nGET\n/products/a%20b/?sort=new`;

            expect(signature).toMatch(/^[a-f0-9]{64}$/);
            await expect(workerVerifies({ signature, signingString })).resolves.toBe(true);
            await expect(
                workerVerifies({ signature, signingString: signingString.replace('GET', 'POST') }),
            ).resolves.toBe(false);
            await expect(
                workerVerifies({ signature, signingString, key: 'f'.repeat(64) }),
            ).resolves.toBe(false);
        });
    });

    describe('getSignedPath', () => {
        it.each([
            ['/', '/'],
            ['/cart.php?action=add', '/cart.php?action=add'],
            ['/a/../b/./c?x=1#frag', '/b/c?x=1'],
            ['//evil.example/x', '//evil.example/x'],
            ['/a//b?q=a//b', '/a//b?q=a//b'],
            ['/é?q=é', '/%C3%A9?q=%C3%A9'],
            ['/%7Efoo?q=%20', '/%7Efoo?q=%20'],
            ['/search?', '/search'],
        ])('should normalize %s to %s', (rawUrl, expected) => {
            expect(getSignedPath(rawUrl, storeOrigin)).toBe(expected);
        });

        it.each(['https://other.example/x', '*', '', undefined])('should reject %s', (rawUrl) => {
            expect(getSignedPath(rawUrl, storeOrigin)).toBeNull();
        });
    });

    describe('isLoopbackHost', () => {
        it.each([
            ['localhost:3000', true],
            ['127.0.0.1:3000', true],
            ['[::1]:3000', true],
            ['localhost', true],
            ['evil.example:3000', false],
            ['localhost.evil.example', false],
            ['', false],
            [undefined, false],
        ])('%s -> %s', (host, expected) => {
            expect(isLoopbackHost(host)).toBe(expected);
        });
    });

    describe('rewriteLocation', () => {
        const storefrontUrl = new URL(storeOrigin);
        const localOrigin = 'http://127.0.0.1:3000';

        it.each([
            [
                'https://store.example.com/login.php?from=x#top',
                `${localOrigin}/login.php?from=x#top`,
            ],
            ['http://store.example.com/cart.php', `${localOrigin}/cart.php`],
            ['//store.example.com/account.php', `${localOrigin}/account.php`],
            ['https://other.example.com/x', 'https://other.example.com/x'],
            ['https://store.example.com:8443/x', 'https://store.example.com:8443/x'],
            ['/relative/path', '/relative/path'],
        ])('%s -> %s', (location, expected) => {
            expect(rewriteLocation(location, storefrontUrl, localOrigin)).toBe(expected);
        });
    });

    describe('createPreviewProxy', () => {
        const getProxyStub = () => {
            const handlers = {};
            return {
                handlers,
                on: jest.fn((event, handler) => {
                    handlers[event] = handler;
                }),
                web: jest.fn(),
            };
        };
        const getResponseStub = () => ({
            writeHead: jest.fn(),
            end: jest.fn(),
            destroy: jest.fn(),
            headersSent: false,
        });
        const setup = () => {
            const proxy = getProxyStub();
            const proxyFactory = jest.fn().mockReturnValue(proxy);
            const logger = { error: jest.fn() };
            const previewSession = { storeUrl: `${storeOrigin}/`, sessionId, accessKey };
            const middleware = createPreviewProxy({
                previewSession,
                proxyFactory,
                logger,
                now: () => timestamp,
            });
            return { proxy, proxyFactory, logger, previewSession, middleware };
        };
        const getRequest = (overrides = {}) => ({
            method: 'GET',
            url: '/',
            ...overrides,
            headers: { host: 'localhost:3000', ...overrides.headers },
        });

        it('should proxy to the storefront origin with TLS verification', () => {
            const { proxyFactory } = setup();
            expect(proxyFactory).toHaveBeenCalledWith({
                target: storeOrigin,
                changeOrigin: true,
                secure: true,
                xfwd: false,
            });
        });

        it('should sign the normalized path and forward that path', () => {
            const { proxy, middleware } = setup();
            const request = getRequest({ method: 'POST', url: '/a/../cart.php?x=1' });
            const response = getResponseStub();

            middleware(request, response);

            expect(request.url).toBe('/cart.php?x=1');
            expect(request.headers).toEqual({
                host: 'localhost:3000',
                ...signPreviewRequest({
                    sessionId,
                    accessKey,
                    timestamp,
                    method: 'POST',
                    pathWithQuery: '/cart.php?x=1',
                }),
            });
            expect(proxy.web).toHaveBeenCalledWith(request, response);

            const proxyRequest = { path: '/collapsed' };
            proxy.handlers.proxyReq(proxyRequest, request);
            expect(proxyRequest.path).toBe('/cart.php?x=1');
        });

        it('should remove inbound preview headers and never send the secret', () => {
            const { middleware } = setup();
            const request = getRequest({
                headers: {
                    'x-stencil-preview-secret': 'leaked',
                    'x-stencil-preview-session': 'forged',
                    'x-stencil-preview-signature': 'forged',
                    'x-stencil-preview-other': 'x',
                },
            });

            middleware(request, getResponseStub());

            expect(request.headers['x-stencil-preview-secret']).toBeUndefined();
            expect(request.headers['x-stencil-preview-other']).toBeUndefined();
            expect(request.headers['x-stencil-preview-session']).toBe(sessionId);
            expect(request.headers['x-stencil-preview-signature']).not.toBe('forged');
        });

        it('should rewrite loopback Origin and Referer and keep cookies', () => {
            const { middleware } = setup();
            const request = getRequest({
                headers: {
                    origin: 'http://localhost:3000',
                    referer: 'http://127.0.0.1:3000/cart.php?a=1',
                    cookie: 'SHOP_SESSION_TOKEN=abc; other=1',
                },
            });

            middleware(request, getResponseStub());

            expect(request.headers.origin).toBe(storeOrigin);
            expect(request.headers.referer).toBe(`${storeOrigin}/cart.php?a=1`);
            expect(request.headers.cookie).toBe('SHOP_SESSION_TOKEN=abc; other=1');
        });

        it('should keep a non-loopback Origin and Referer', () => {
            const { middleware } = setup();
            const request = getRequest({
                headers: { origin: 'https://other.example', referer: 'https://other.example/p' },
            });

            middleware(request, getResponseStub());

            expect(request.headers.origin).toBe('https://other.example');
            expect(request.headers.referer).toBe('https://other.example/p');
        });

        it('should use the current session values on each request', () => {
            const { middleware, previewSession } = setup();
            previewSession.sessionId = 'new-session';
            previewSession.accessKey = 'f'.repeat(64);
            const request = getRequest();

            middleware(request, getResponseStub());

            expect(request.headers).toEqual(
                expect.objectContaining(
                    signPreviewRequest({
                        sessionId: 'new-session',
                        accessKey: 'f'.repeat(64),
                        timestamp,
                        method: 'GET',
                        pathWithQuery: '/',
                    }),
                ),
            );
        });

        it('should reject a request whose Host is not loopback', () => {
            const { proxy, middleware } = setup();
            const response = getResponseStub();

            middleware(getRequest({ headers: { host: 'evil.example:3000' } }), response);

            expect(response.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
            expect(proxy.web).not.toHaveBeenCalled();
        });

        it('should reject a request target that is not a path', () => {
            const { proxy, middleware } = setup();
            const response = getResponseStub();

            middleware(getRequest({ url: 'https://other.example/x' }), response);

            expect(response.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
            expect(proxy.web).not.toHaveBeenCalled();
        });

        it('should rewrite a same-store redirect to the local origin', () => {
            const { proxy } = setup();
            const proxyResponse = { headers: { location: `${storeOrigin}/login.php` } };

            proxy.handlers.proxyRes(proxyResponse, getRequest());

            expect(proxyResponse.headers.location).toBe('http://localhost:3000/login.php');
        });

        it('should return 502 when the storefront request fails', () => {
            const { proxy, logger } = setup();
            const response = getResponseStub();

            proxy.handlers.error(new Error('ECONNRESET'), getRequest(), response);

            expect(response.writeHead).toHaveBeenCalledWith(502, expect.any(Object));
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('ECONNRESET'));
        });

        it('should close the response when the error happens after the headers are sent', () => {
            const { proxy } = setup();
            const response = { ...getResponseStub(), headersSent: true };

            proxy.handlers.error(new Error('ECONNRESET'), getRequest(), response);

            expect(response.destroy).toHaveBeenCalled();
            expect(response.writeHead).not.toHaveBeenCalled();
        });
    });

    describe('createPreviewProxy with a real upstream', () => {
        let upstream;
        let front;
        let frontPort;
        const received = [];

        beforeAll(async () => {
            upstream = http.createServer((request, response) => {
                let body = '';
                request.on('data', (chunk) => {
                    body += chunk;
                });
                request.on('end', () => {
                    received.push({
                        method: request.method,
                        url: request.url,
                        headers: request.headers,
                        body,
                    });
                    response.end('ok');
                });
            });
            await new Promise((resolve) => {
                upstream.listen(0, '127.0.0.1', resolve);
            });
            const previewSession = {
                storeUrl: `http://127.0.0.1:${upstream.address().port}`,
                sessionId,
                accessKey,
            };
            const middleware = createPreviewProxy({
                previewSession,
                logger: { error: jest.fn() },
                now: () => timestamp,
            });
            front = http.createServer(middleware);
            await new Promise((resolve) => {
                front.listen(0, '127.0.0.1', resolve);
            });
            frontPort = front.address().port;
        });

        afterAll(async () => {
            front.closeAllConnections();
            await new Promise((resolve) => {
                front.close(resolve);
            });
            await new Promise((resolve) => {
                upstream.close(resolve);
            });
        });

        it('should send the signed path, method, body, and proof headers upstream', async () => {
            const response = await fetch(`http://127.0.0.1:${frontPort}//a//b?q=1`, {
                method: 'POST',
                body: 'qty=2',
                headers: { cookie: 'c=1', 'x-stencil-preview-secret': 'leaked' },
            });

            expect(await response.text()).toBe('ok');
            const [request] = received;
            expect(request.method).toBe('POST');
            expect(request.url).toBe('//a//b?q=1');
            expect(request.body).toBe('qty=2');
            expect(request.headers.cookie).toBe('c=1');
            expect(request.headers['x-stencil-preview-secret']).toBeUndefined();
            expect(request.headers.host).toBe(`127.0.0.1:${upstream.address().port}`);
            await expect(
                workerVerifies({
                    signature: request.headers['x-stencil-preview-signature'],
                    signingString: `${sessionId}\n${timestamp}\nPOST\n//a//b?q=1`,
                }),
            ).resolves.toBe(true);
        });

        it('should send the signed path when the client sends Expect: 100-continue', async () => {
            received.length = 0;
            const status = await new Promise((resolve, reject) => {
                const request = http.request({
                    host: '127.0.0.1',
                    port: frontPort,
                    method: 'PUT',
                    path: '//c//d',
                    headers: { expect: '100-continue', 'content-length': '4' },
                });
                request.on('continue', () => request.end('body'));
                request.on('response', (response) => {
                    response.resume();
                    response.on('end', () => resolve(response.statusCode));
                });
                request.on('error', reject);
            });

            expect(status).toBe(200);
            const [request] = received;
            expect(request.url).toBe('//c//d');
            expect(request.body).toBe('body');
            expect(request.headers.expect).toBeUndefined();
            await expect(
                workerVerifies({
                    signature: request.headers['x-stencil-preview-signature'],
                    signingString: `${sessionId}\n${timestamp}\nPUT\n//c//d`,
                }),
            ).resolves.toBe(true);
        });
    });
});
