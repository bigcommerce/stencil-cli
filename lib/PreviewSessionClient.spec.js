import { jest } from '@jest/globals';
import { PreviewSessionClient } from './PreviewSessionClient.js';

describe('PreviewSessionClient.register', () => {
    const session = {
        sessionId: '0b6f9c3e-4d2a-4f7b-9a1c-2e3d4f5a6b7c',
        accessKey: 'a'.repeat(64),
        expiresIn: 300,
    };
    const options = {
        storeUrl: 'https://store.example.com',
        accessToken: 'token-123',
        tunnelUrl: 'https://preview-123.trycloudflare.com',
        secret: 'b'.repeat(64),
    };
    const respond = (status, body) =>
        jest
            .fn()
            .mockResolvedValue(
                new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
            );

    it('registers the tunnel on the store host and returns the session', async () => {
        const fetch = respond(201, session);
        const client = new PreviewSessionClient({ fetch });

        await expect(client.register(options)).resolves.toEqual(session);

        const [url, init] = fetch.mock.calls[0];
        expect(String(url)).toBe('https://store.example.com/api/makeswift/preview-sessions');
        expect(init).toMatchObject({
            method: 'POST',
            headers: { 'x-stencil-access-token': 'token-123' },
            redirect: 'manual',
        });
        expect(JSON.parse(init.body)).toEqual({
            tunnelUrl: options.tunnelUrl,
            secret: options.secret,
        });
    });

    it('does not send the access token to an HTTP store URL', async () => {
        const fetch = jest.fn();
        const client = new PreviewSessionClient({ fetch });

        await expect(
            client.register({ ...options, storeUrl: 'http://store.example.com' }),
        ).rejects.toThrow('requires an HTTPS store URL');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects a storefront page that is not a registration response', async () => {
        const client = new PreviewSessionClient({ fetch: respond(200, '<html></html>') });

        await expect(client.register(options)).rejects.toMatchObject({
            message: expect.stringContaining('response (HTTP 200) is not valid'),
            retryable: false,
        });
    });

    it.each([
        ['an invalid token or a missing scope', 401, false],
        ['a redirect to another host', 301, false],
        ['rate limiting', 429, true],
        ['a worker outage', 503, true],
    ])('reports %s with the HTTP status', async (_, status, retryable) => {
        const client = new PreviewSessionClient({ fetch: respond(status, { error: 'x' }) });

        await expect(client.register(options)).rejects.toMatchObject({
            message: expect.stringContaining(`(HTTP ${status})`),
            status,
            retryable,
        });
    });

    it('marks a network error as retryable', async () => {
        const fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
        const client = new PreviewSessionClient({ fetch });

        await expect(client.register(options)).rejects.toMatchObject({ retryable: true });
    });
});
