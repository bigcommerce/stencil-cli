'use strict';

var Confidence = require('confidence'),
    Path = require('path'),
    criteria,
    store,
    config;

config = {
    $meta: 'Config file',
    server: {
        host: process.env.HOST || 'localhost',
        port: process.env.PORT || 3000
    },
    good: {
        opsInterval: 1000,
        reporters: [{
            reporter: require('good-console'),
            args: [{log: '*', request: '*'}]
        }]
    }
};


criteria = {
    env: process.env.NODE_ENV || 'development'
};

store = new Confidence.Store(config);

exports.get = function(key) {

    return store.get(key, criteria);
};

exports.meta = function(key) {

    return store.meta(key, criteria);
};
