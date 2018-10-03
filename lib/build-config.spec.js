'use strict';

const Code = require('code');
const Lab = require('lab');
const sinon = require('sinon');
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

    lab.beforeEach(done => {
        sandbox = sinon.sandbox.create();
        done();
    });

    lab.afterEach(done => {
        sandbox.restore();
        done();
    });

    it('should return watchOptions', done => {
        const buildConfig = loadModule('valid-config');

        expect(buildConfig.watchOptions).to.be.an.object();
        expect(buildConfig.watchOptions.files).to.be.an.array();
        expect(buildConfig.watchOptions.ignored).to.be.an.array();

        done();
    });

    describe('production method', () => {
        it('should call "done()" function when production bundle finishes', done => {
            const buildConfig = loadModule('valid-config');

            expect(buildConfig.production).to.be.a.function();
            buildConfig.initWorker().production(message => {
                expect(message).to.be.undefined();
                done();
            });
        });

        it('should call "done()" function when production bundle finishes (legacy-config)', done => {
            const buildConfig = loadModule('legacy-config');

            expect(buildConfig.production).to.be.a.function();
            buildConfig.initWorker().production(message => {
                expect(message).to.be.undefined();
                done();
            });
        });

        it('should call done with "noworker" meesage', done => {
            const buildConfig = loadModule('noworker-config');

            expect(buildConfig.production).to.be.a.function();
            buildConfig.initWorker().production(message => {
                expect(message).to.equal('worker terminated');
                done();
            });
        });
    });

    describe('development method', () => {
        it('should reload the browser when a message "reload" is received from stencil.conf.js', done => {
            const buildConfig = loadModule('valid-config');

            expect(buildConfig.development).to.be.a.function();
            buildConfig.initWorker().development({ reload: done });
        });

        it('should reload the browser when "reload" method is called from stencil.conf.js (legacy-config)', done => {
            const buildConfig = loadModule('legacy-config');

            expect(buildConfig.development).to.be.a.function();
            buildConfig.initWorker().development({ reload: done });
        });
    });
});
