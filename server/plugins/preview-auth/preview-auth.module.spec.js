import { jest } from '@jest/globals';
import * as Hapi from '@hapi/hapi';
import previewAuth from './preview-auth.module.js';

describe('PreviewAuth', () => {
    const secret = 'a'.repeat(64);
    const server = new Hapi.Server();
    const handler = jest.fn(() => 'OK');

    beforeAll(async () => {
        await server.register({ plugin: previewAuth, options: { secret } });
        server.route({ method: '*', path: '/{path*}', handler });
    });
    afterEach(() => handler.mockClear());

    it('should return 401 and not run the route when the secret is missing', async () => {
        const response = await server.inject({ url: '/internalapi/carts' });
        expect(response.statusCode).toEqual(401);
        expect(handler).not.toHaveBeenCalled();
    });

    it('should return 403 and not run the route when the secret is wrong', async () => {
        const response = await server.inject({
            url: '/test',
            headers: { 'x-stencil-preview-secret': 'wrong' },
        });
        expect(response.statusCode).toEqual(403);
        expect(handler).not.toHaveBeenCalled();
    });

    it('should run the route without the header when the secret is correct', async () => {
        const response = await server.inject({
            url: '/test',
            headers: { 'x-stencil-preview-secret': secret },
        });
        expect(response.statusCode).toEqual(200);
        const [request] = handler.mock.calls[0];
        expect(request.headers).not.toHaveProperty('x-stencil-preview-secret');
    });

    it('should fail to register without a secret', async () => {
        await expect(
            new Hapi.Server().register({ plugin: previewAuth, options: { secret: '' } }),
        ).rejects.toThrow('PreviewAuth requires a non-empty secret');
    });
});
