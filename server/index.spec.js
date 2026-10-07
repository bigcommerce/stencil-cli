import { buildManifest } from './index.js';
import * as manifest from './manifest.js';

describe('buildManifest', () => {
    const dotStencilFile = {
        storeUrl: 'https://store-abc123.mybigcommerce.com',
        normalStoreUrl: 'https://www.example.com',
        port: 3000,
    };
    const PREVIEW_AUTH = './plugins/preview-auth/preview-auth.module.js';
    const plugins = (options) =>
        buildManifest(manifest.get('/'), { dotStencilFile, ...options }).register.plugins;

    it('should register PreviewAuth first, with the preview secret', () => {
        expect(plugins({ previewSecret: 'secret' })[0]).toEqual({
            plugin: PREVIEW_AUTH,
            options: { secret: 'secret' },
        });
    });

    it('should not load PreviewAuth when there is no preview session', () => {
        expect(plugins({}).map(({ plugin }) => plugin)).not.toContain(PREVIEW_AUTH);
    });
});
