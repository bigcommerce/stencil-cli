import { jest } from '@jest/globals';
import http from 'http';
import { webcrypto } from 'crypto';
import { createPreviewProxy } from './preview-proxy.js';

const sessionId = 'session-1';
const accessKey = 'a'.repeat(64);
const timestamp = 1791400000000;

// Same steps as verifySignature() in makeswift-stencil-worker verify-preview-proof.ts.
async function workerVerifies(signature, signingString) {
    const encoder = new TextEncoder();
    const key = await webcrypto.subtle.importKey(
        'raw',
        encoder.encode(accessKey),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify'],
    );
    return webcrypto.subtle.verify(
        'HMAC',
        key,
        Buffer.from(signature, 'hex'),
        encoder.encode(signingString),
    );
}

function listen(handler) {
    const server = http.createServer(handler);
    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}

function close(server) {
    server.closeAllConnections();
    return new Promise((resolve) => {
        server.close(resolve);
    });
}

function startFrontDoor(storeUrl) {
    const middleware = createPreviewProxy({
        previewSession: { storeUrl, sessionId, accessKey },
        logger: { error: jest.fn() },
        now: () => timestamp,
    });
    return listen(middleware);
}

function send(server, { method = 'GET', path = '/', headers = {}, body } = {}) {
    return new Promise((resolve, reject) => {
        const request = http.request(
            { host: '127.0.0.1', port: server.address().port, method, path, headers },
            (response) => {
                response.resume();
                response.on('end', () => resolve(response));
            },
        );
        request.on('error', reject);
        request.end(body);
    });
}

describe('createPreviewProxy', () => {
    let store;
    let storeUrl;
    let frontDoor;
    let received;

    beforeAll(async () => {
        store = await listen((request, response) => {
            let body = '';
            request.on('data', (chunk) => {
                body += chunk;
            });
            request.on('end', () => {
                received = {
                    method: request.method,
                    url: request.url,
                    headers: request.headers,
                    body,
                };
                if (request.url === '/login.php') {
                    response.writeHead(302, { location: `${storeUrl}/account.php` });
                }
                response.end();
            });
        });
        storeUrl = `http://127.0.0.1:${store.address().port}`;
        frontDoor = await startFrontDoor(storeUrl);
    });

    beforeEach(() => {
        received = null;
    });

    afterAll(async () => {
        await close(frontDoor);
        await close(store);
    });

    it('should forward a signed request that the worker accepts', async () => {
        await send(frontDoor, {
            method: 'POST',
            path: '/cart.php?action=add',
            body: 'qty=2',
            headers: { cookie: 'SHOP_SESSION_TOKEN=abc', 'x-stencil-preview-secret': 'leaked' },
        });

        expect(received).toMatchObject({
            method: 'POST',
            url: '/cart.php?action=add',
            body: 'qty=2',
        });
        expect(received.headers.cookie).toBe('SHOP_SESSION_TOKEN=abc');
        expect(received.headers['x-stencil-preview-secret']).toBeUndefined();
        await expect(
            workerVerifies(
                received.headers['x-stencil-preview-signature'],
                `${sessionId}\n${timestamp}\nPOST\n/cart.php?action=add`,
            ),
        ).resolves.toBe(true);
    });

    it('should point a localhost Origin and Referer at the storefront', async () => {
        const local = `http://127.0.0.1:${frontDoor.address().port}`;
        await send(frontDoor, {
            method: 'POST',
            path: '/login.php',
            headers: { origin: local, referer: `${local}/login.php?from=cart` },
        });

        expect(received.headers.origin).toBe(storeUrl);
        expect(received.headers.referer).toBe(`${storeUrl}/login.php?from=cart`);
    });

    it('should keep storefront redirects on localhost', async () => {
        const response = await send(frontDoor, { path: '/login.php' });

        expect(response.headers.location).toBe(
            `http://127.0.0.1:${frontDoor.address().port}/account.php`,
        );
    });

    it('should reject a request whose Host is not localhost', async () => {
        const response = await send(frontDoor, { headers: { host: 'evil.example' } });

        expect(response.statusCode).toBe(403);
        expect(received).toBeNull();
    });

    it('should return 502 when the storefront is down', async () => {
        const down = await listen();
        const downUrl = `http://127.0.0.1:${down.address().port}`;
        await close(down);
        const brokenFrontDoor = await startFrontDoor(downUrl);

        const response = await send(brokenFrontDoor);

        expect(response.statusCode).toBe(502);
        await close(brokenFrontDoor);
    });
});
