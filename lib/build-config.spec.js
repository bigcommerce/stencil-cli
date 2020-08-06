'use strict';

const Code = require('code');
const Lab = require('@hapi/lab');
const sinon = require('sinon');
const { promisify } = require('util');
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const expect = Code.expect;
const it = lab.it;
const cwd = process.cwd();

describe('stencilBuildConfig', () => {
    let sandbox;

    function loadModule(mockName) {
        const path = `${cwd}/test/_mocks/build-config/${mockName}`;
        delete require.cache[require.resolve('./build-config')];
        sandbox.stub(process, 'cwd').returns(path);

        return require('./build-config');
    }

    lab.beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    lab.afterEach(() => {
        sandbox.restore();
    });

    it('should return watchOptions', () => {
        const buildConfig = loadModule('valid-config');

        expect(buildConfig.watchOptions).to.be.an.object();
        expect(buildConfig.watchOptions.files).to.be.an.array();
        expect(buildConfig.watchOptions.ignored).to.be.an.array();
    });

    describe('production method', () => {
        it('should resolve successfully for "valid-config"', async () => {
            const buildConfig = loadModule('valid-config');
            const initedBuildConfig = buildConfig.initWorker();

            expect(buildConfig.production).to.be.a.function();

            await promisify(initedBuildConfig.production.bind(initedBuildConfig))();
        });

        it('should resolve successfully for "legacy-config"', async () => {
            const buildConfig = loadModule('legacy-config');
            const initedBuildConfig = buildConfig.initWorker();

            expect(buildConfig.production).to.be.a.function();

            await promisify(initedBuildConfig.production.bind(initedBuildConfig))();
        });

        it('should reject with "worker terminated" message for "noworker-config"', async () => {
            const buildConfig = loadModule('noworker-config');
            const initedBuildConfig = buildConfig.initWorker();

            expect(buildConfig.production).to.be.a.function();

            let message;
            try {
                await promisify(initedBuildConfig.production.bind(initedBuildConfig))();
            } catch (err) {
                message = err;
            }

            expect(message).to.equal('worker terminated');
        });
    });

    describe('development method', () => {
        it('should reload the browser when a message "reload" is received from stencil.conf.js (valid-config)', async () => {
            const buildConfig = loadModule('valid-config');

            expect(buildConfig.development).to.be.a.function();

            await new Promise(done =>
                buildConfig.initWorker().development({ reload: done }),
            );
        });

        it('should reload the browser when "reload" method is called from stencil.conf.js (legacy-config)', async () => {
            const buildConfig = loadModule('legacy-config');

            expect(buildConfig.development).to.be.a.function();

            await new Promise(done =>
                buildConfig.initWorker().development({ reload: done }),
            );
        });
    });
});
