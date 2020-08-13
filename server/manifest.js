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
            '@hapi/good': config.get('/good'),
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

exports.get = function (key) {
    return store.get(key, criteria);
};

exports.meta = function (key) {
    return store.meta(key, criteria);
};
