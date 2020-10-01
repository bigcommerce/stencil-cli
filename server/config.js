const Confidence = require('confidence');

const config = {
    $meta: 'Config file',
    server: {
        host: 'localhost',
        port: 3000,
    },
};

const criteria = {
    env: process.env.NODE_ENV || 'development',
};

const store = new Confidence.Store(config);

exports.get = (key) => store.get(key, criteria);

exports.meta = (key) => store.meta(key, criteria);
