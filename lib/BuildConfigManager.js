const _ = require('lodash');
const { fork } = require('child_process');
const path = require('path');
const fsModule = require('fs');

const { THEME_PATH } = require('../constants');

class BuildConfigManager {
    constructor({ workDir = THEME_PATH, fs = fsModule, timeout = 20000 } = {}) {
        this.configFileName = 'stencil.conf.js';

        this._workDir = workDir;
        this._buildConfigPath = path.join(workDir, this.configFileName);
        this._fs = fs;
        this._onReadyCallbacks = [];
        this._worker = null;
        this._workerIsReady = false;
        this.timeout = timeout;

        const config = this._getConfig(this._buildConfigPath);

        this.development = config.development || this._devWorker;
        this.production = config.production || this._prodWorker;
        this.watchOptions = config.watchOptions;
    }

    initWorker() {
        if (this._fs.existsSync(this._buildConfigPath)) {
            this._worker = fork(this._buildConfigPath, [], { cwd: this._workDir });

            this._worker.on('message', (message) => {
                if (message === 'ready') {
                    this._workerIsReady = true;
                    this._onReadyCallbacks.forEach((callback) => callback());
                }
            });
        }

        return this;
    }

    stopWorker(signal = 'SIGTERM') {
        this._worker.kill(signal);
    }

    _getConfig(configPath) {
        if (this._fs.existsSync(configPath)) {
            // eslint-disable-next-line
            return require(configPath);
        }

        return {};
    }

    _onWorkerReady(onReady) {
        if (this._workerIsReady) {
            process.nextTick(onReady);
        }

        this._onReadyCallbacks.push(onReady);
    }

    _devWorker(browserSync) {
        if (!this._worker) {
            return;
        }
        // send a message to the worker to start watching
        // and wait for message to reload the browser
        this._worker.send('development');
        this._worker.on('message', (message) => {
            if (message === 'reload') {
                browserSync.reload();
            }
        });
    }

    _prodWorker(done) {
        const callback = _.once(done);

        if (!this._worker) {
            process.nextTick(() => callback('worker initialization failed'));
            return;
        }

        const timeoutId = setTimeout(() => {
            this.stopWorker();
            console.log(
                'The process was timed out. Try to increase it by providing --timeout [number] option'
                    .yellow,
            );
            callback('worker timed out');
        }, this.timeout);

        this._onWorkerReady(() => {
            clearTimeout(timeoutId);
            // send a message to the worker to start bundling js
            this._worker.send('production');
            this._worker.on('message', (message) => {
                if (message === 'done') {
                    this._worker.kill();
                    callback();
                }
            });
        });

        this._worker.on('close', () => {
            callback('worker terminated');
            clearTimeout(timeoutId);
        });
    }
}

module.exports = BuildConfigManager;
