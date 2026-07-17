import { once } from 'lodash-es';
import { fork } from 'child_process';
import path from 'path';
import fsModule from 'fs';
import { pathToFileURL } from 'node:url';
import { THEME_PATH } from '../constants.js';

const isJest = typeof process !== 'undefined' && 'JEST_WORKER_ID' in process.env;

const cornerstoneConfigLink = isJest
    ? 'https://raw.githubusercontent.com/bigcommerce/stencil-cli/master/test/_mocks/build-config/valid-config/stencil.conf.cjs'
    : 'https://raw.githubusercontent.com/bigcommerce/cornerstone/master/stencil.conf.cjs';

class BuildConfigManager {
    constructor({ workDir = THEME_PATH, fs = fsModule, timeout = 20000 } = {}) {
        this.oldConfigFileName = 'stencil.conf.js';
        this.configFileName = 'stencil.conf.cjs';
        this.esmConfigFileName = 'stencil.conf.mjs';
        this._workDir = workDir;
        this._buildConfigPath = path.join(workDir, this.configFileName);
        this._esmBuildConfigPath = path.join(workDir, this.esmConfigFileName);
        this._oldBuildConfigPath = path.join(workDir, this.oldConfigFileName);
        this._fs = fs;
        this._onReadyCallbacks = [];
        this._worker = null;
        this._workerIsReady = false;
        this.timeout = timeout;
    }

    async initConfig() {
        const config = await this._getConfig(
            this._resolveBuildConfigPath(),
            this._oldBuildConfigPath,
        );
        this.development = config.development || this._devWorker;
        this.production = config.production || this._prodWorker;
        this.watchOptions = config.watchOptions;
    }

    initWorker() {
        const buildConfigPath = this._resolveBuildConfigPath();
        if (this._fs.existsSync(buildConfigPath)) {
            this._worker = fork(buildConfigPath, [], { cwd: this._workDir });
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

    // Prefer an ESM stencil.conf.mjs when the theme provides one; otherwise
    // use the CommonJS stencil.conf.cjs (which legacy stencil.conf.js files
    // get renamed to)
    _resolveBuildConfigPath() {
        if (this._fs.existsSync(this._esmBuildConfigPath)) {
            return this._esmBuildConfigPath;
        }
        return this._buildConfigPath;
    }

    async _getConfig(configPath, oldConfigPath) {
        if (this._fs.existsSync(configPath)) {
            return this._importConfig(configPath);
        }
        if (this._fs.existsSync(oldConfigPath)) {
            this._moveOldConfig(configPath, oldConfigPath);
            return this._importConfig(configPath);
        }

        // Fallback to cornerstone default stencil.conf.cjs
        const content = await this.downloadFileFromGitHub(cornerstoneConfigLink);
        this._fs.writeFileSync(configPath, content);

        return this._importConfig(configPath);
    }

    // Dynamic import() loads both ESM and CommonJS configs. CommonJS exposes
    // module.exports as the default export; ESM configs use named exports
    async _importConfig(configPath) {
        // eslint-disable-next-line node/no-unsupported-features/es-syntax
        const configModule = await import(pathToFileURL(configPath).href);
        return configModule.default ?? configModule;
    }

    async downloadFileFromGitHub(rawUrl) {
        try {
            const response = await fetch(rawUrl);

            if (!response.ok) {
                console.log(`Failed to fetch file from ${rawUrl}: ${response.statusText}`);
            }

            return response.text();
        } catch (error) {
            console.error('Failed to fetch stencil.conf.cjs:', error);
            return null;
        }
    }

    _moveOldConfig(newPath, oldPath) {
        this._fs.copyFileSync(oldPath, newPath);
        this._fs.rmSync(oldPath);
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
        const callback = once(done);
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
export default BuildConfigManager;
