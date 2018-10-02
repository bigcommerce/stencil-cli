'use strict';

const _ = require('lodash');
const fork = require('child_process').fork;
const Path = require('path');
const Fs = require('fs');
const buildConfigPath = Path.join(process.cwd(), 'stencil.conf.js');
const config = getConfig();
const onReadyCallbacks = [];
let worker = null;
let workerIsReady = false;

const api = {
    development: config.development || devWorker,
    initWorker: initWorker,
    production: config.production || prodWorker,
    watchOptions: config.watchOptions,
};

module.exports = api;

function getConfig() {
    let config = {};

    if (Fs.existsSync(buildConfigPath)) {
        config = require(buildConfigPath);
    }

    return config;
}

function initWorker() {
    if (Fs.existsSync(buildConfigPath)) {
        worker = fork(buildConfigPath, [], { cwd: process.cwd() });

        worker.on('message', message => {
            if (message === 'ready') {
                workerIsReady = true;
                onReadyCallbacks.forEach(callback => callback());
            }
        });
    }

    return api;
}

function onWorkerReady(onReady) {
    if (workerIsReady) {
        process.nextTick(onReady);
    }

    onReadyCallbacks.push(onReady);
}

function devWorker(browserSync) {
    if (!worker) {
        return;
    }
    // send a message to the worker to start watching
    // and wait for message to reload the browser
    worker.send('development');
    worker.on('message', message => {
        if (message === 'reload') {
            browserSync.reload();
        }
    });
}

function prodWorker(done) {
    const callback = _.once(done);

    if (!worker) {
        return process.nextTick(() => callback('worker initialization failed'));
    }

    const timeout = setTimeout(() => {
        worker.kill();
        callback('worker timed out');
    }, 20000);

    onWorkerReady(() => {
        clearTimeout(timeout);
        // send a message to the worker to start bundling js
        worker.send('production');
        worker.on('message', message => {
            if (message === 'done') {
                worker.kill();
                callback();
            }
        });
    });

    worker.on('close', () => callback('worker terminated'));
}
