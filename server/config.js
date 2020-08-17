'use strict';

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

exports.get = function(key) {
    return store.get(key, criteria);
};

exports.meta = function(key) {
    return store.meta(key, criteria);
};
