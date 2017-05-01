'use strict';

const Confidence = require('confidence');
const Path = require('path');
var criteria;
var store;
var config;

config = {
    $meta: 'Config file',
    server: {
        host: 'localhost',
        port: 3000,
    },
    good: {
        opsInterval: 1000,
        reporters: [{
            reporter: require('good-console'),
            args: [{log: '*', request: '*'}],
        }],
    },
    themeAssets: {
        assetsBasePath: Path.join(process.cwd(), 'assets'),
    },
};

criteria = {
    env: process.env.NODE_ENV || 'development',
};

store = new Confidence.Store(config);

exports.get = function(key) {

    return store.get(key, criteria);
};

exports.meta = function(key) {

    return store.meta(key, criteria);
};
