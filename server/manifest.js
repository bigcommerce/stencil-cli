import Confidence from 'confidence';
import * as config from './config.js';

const criteria = {
    env: process.env.NODE_ENV,
};
const manifest = {
    $meta: 'Stencil',
    server: {
        host: config.get('/server/host'),
        port: config.get('/server/port'),
    },
    register: {
        plugins: {
            // Third Party Plugins
            '@hapi/inert': {},
            '@hapi/h2o2': {},
            // First Party Plugins
            './plugins/renderer/renderer.module.js': {},
            './plugins/router/router.module.js': {},
            './plugins/theme-assets/theme-assets.module.js': {},
        },
    },
};
const store = new Confidence.Store(manifest);
export const get = (key) => store.get(key, criteria);
export const meta = (key) => store.meta(key, criteria);
