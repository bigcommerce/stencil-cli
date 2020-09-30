const Confidence = require('confidence');
const config = require('./config');

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
            './plugins/renderer/renderer.module': {},
            './plugins/router/router.module': {},
            './plugins/theme-assets/theme-assets.module': {},
        },
    },
};

const store = new Confidence.Store(manifest);

exports.get = (key) => store.get(key, criteria);

exports.meta = (key) => store.meta(key, criteria);
