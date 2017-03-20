'use strict';

const _ = require('lodash');
const fork = require('child_process').fork;
const Path = require('path');
const Fs = require('fs');
const buildConfigPath = Path.join(process.cwd(), 'stencil.conf.js');
const worker = getWorker();
const config = getConfig();

const onReadyCallbacks = [];
let workerIsReady = false;

function getConfig() {
    let config = {};

    if (Fs.existsSync(buildConfigPath)) {
        config = require(buildConfigPath);
    }

    return config;
}

function getWorker() {
    let worker = null;

    if (Fs.existsSync(buildConfigPath)) {
        worker = fork(buildConfigPath, [], { cwd: process.cwd() });

        worker.on('message', message => {
            if (message === 'ready') {
                workerIsReady = true;
                onReadyCallbacks.forEach(callback => callback());
            }
        });
    }

    return worker;
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
        return process.nextTick(() => callback('noworker'));
    }

    const timeout = setTimeout(() => callback('timeout'), 1000);

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

    worker.on('close', () => callback('noworker'));
}


module.exports = {
    watchOptions: config.watchOptions,
    development: config.development || devWorker,
    production: config.production || prodWorker,
};
