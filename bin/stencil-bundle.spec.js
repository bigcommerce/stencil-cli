'use strict';

const Code = require('code');
const Fs = require('fs');
const Sinon = require('sinon');
const rewire = require('rewire');
const Path = require('path');
const async = require('async');
const when = require('when');
const Lab = require('lab');
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const themePath = Path.join(process.cwd(), 'test/_mocks/themes/valid');
const expect = Code.expect;
const it = lab.it;
const StencilBundle = rewire('../lib/stencil-bundle');
const bundleValidator = require('../lib/bundle-validator');
const jspm = require('jspm');
const themeSchema = Fs.readFileSync((Path.join(themePath, 'schema.json'))).toString();

describe('Stencil Bundle', () => {
    let sandbox;
    let rawConfig;
    let Bundle;
    let AsyncStub;
    let themeConfigStub;

    lab.beforeEach(done => {
        sandbox = Sinon.sandbox.create();
        themeConfigStub = getThemeConfigStub();
        rawConfig = {
            "name": "Cornerstone",
            "version": "1.1.0",
        };

        sandbox.stub(console, 'log');
        sandbox.stub(console, 'error');

        Bundle = new StencilBundle(themePath, themeConfigStub, rawConfig, {
            marketplace: false,
        });
        done();
    });

    lab.afterEach(done => {
        AsyncStub.restore();
        sandbox.restore();
        done();
    });

    it('should initialize bundling', done => {
        AsyncStub = Sinon.stub(async, 'series');
        AsyncStub.callsArgWith(1, new Error('error'));
        const throws = () => {
            Bundle.initBundle();
        };

        expect(throws).to.throw(Error);
        expect(AsyncStub.calledOnce).to.equal(true);
        AsyncStub.restore();
        done();
    });

    it('should assemble CSS files', done => {
        AsyncStub = Sinon.stub(async, 'map');
        AsyncStub.callsArgWith(2, null, ['this is dog']);

        const callback = (err, result) => {
            expect(result).to.deep.equal({'theme.scss': 'this is dog'});
            AsyncStub.restore();
            done();
        };

        const task = Bundle.getCssAssembleTask('scss');

        task(callback);

    });

    it('should error on assemble CSS files', done => {
        AsyncStub = Sinon.stub(async, 'map');
        AsyncStub.callsArgWith(2, 'error');

        const callback = (err) => {
            expect(err).to.equal('error');
            AsyncStub.restore();
            done();
        };

        const task = Bundle.getCssAssembleTask('scss');

        task(callback);

    });

    it('should assembleTemplates', done => {
        Sinon.stub(async, 'map').callsArgWith(2, null, ['test', 'test2']);
        Sinon.stub(bundleValidator.prototype, 'validateObjects').callsArgWith(1, null);

        Bundle.assembleTemplatesTask((err, result) => {
            expect(err).to.be.null();
            expect(result.page).to.equal('test');
            expect(result.page2).to.equal('test2');

            async.map.restore();
            bundleValidator.prototype.validateObjects.restore();
            done();
        });

    });

    it('should error when running assembleTemplates', done => {
        AsyncStub = Sinon.stub(async, 'map');
        AsyncStub.callsArgWith(2, 'error');
        const BundleVal = Sinon.stub(bundleValidator.prototype, 'validateObjects').callsArgWith(1, null);

        Bundle.assembleTemplatesTask((err) => {
            expect(err).to.equal('error');
            AsyncStub.restore();
            BundleVal.restore();
            done();
        });
    });

    it('should assemble the Schema', done => {
        Bundle.assembleSchema((err, result) => {
            expect(result).to.deep.equal(themeSchema);
            done();
        });
    });

    it('should assemble the Lang Files', done => {
        const langStub = Sinon.stub();
        langStub.assemble = Sinon.stub().callsArgWith(0, null);

        StencilBundle.__set__({
            'LangAssembler': langStub,
        });

        const callback = () => {
            expect(langStub.assemble.calledOnce).to.equal(true);
            done();
        };

        Bundle.assembleLangTask(callback);

    });

    it('should error on assembling the Lang Files', done => {
        const langStub = Sinon.stub();
        langStub.assemble = Sinon.stub().callsArgWith(0, 'error');

        StencilBundle.__set__({
            'LangAssembler': langStub,
        });

        const callback = (err) => {
            expect(langStub.assemble.calledOnce).to.equal(true);
            expect(err).to.equal('error');
            done();
        };

        Bundle.assembleLangTask(callback);

    });

    it('should bundle JSPM assets', done => {
        const jspmStub = Sinon.stub(jspm, 'bundleSFX').returns(when());

        const callback = (err, result) => {
            expect(result).to.equal(true);
            jspmStub.restore();
            done();
        };

        Bundle.getJspmBundleTask(getThemeConfigStub().getRawConfig)(callback);

    });

    it('should fail to bundle JSPM assets', done => {
        const jspmStub = Sinon.stub(jspm, 'bundleSFX').returns(when.reject(false));

        const callback = (err) => {
            expect(err).to.equal(false);
            jspmStub.restore();
            done();
        };

        Bundle.getJspmBundleTask(getThemeConfigStub().getRawConfig)(callback);
    });

    it('should generate a manifest of files.', done => {
        const rrStub = Sinon.stub().callsArgWith(2, null, ['test', 'test2']);
        const FsStub = Sinon.stub().callsArgWith(2, null);

        StencilBundle.__set__({
            'rr': rrStub,
            'Fs.writeFile': FsStub,
        });

        const callback = () => {
            expect(rrStub.calledOnce).to.equal(true);
            expect(Bundle.manifest.templates[0]).to.equal('test');
            expect(Bundle.manifest.templates[1]).to.equal('test2');

            done();
        };

        Bundle.generateManifest(callback);
    });

    it('should error while reading files to generate a manifest of files.', done => {
        const rrStub = Sinon.stub().callsArgWith(2, 'There was an error', null);
        const FsStub = Sinon.stub().callsArgWith(2, null);

        StencilBundle.__set__({
            'rr': rrStub,
            'Fs.writeFile': FsStub,
        });

        const callback = (err) => {
            expect(rrStub.calledOnce).to.equal(true);
            expect(FsStub.calledOnce).to.equal(false);
            expect(err).to.equal('There was an error');
            done();
        };

        Bundle.generateManifest(callback);
    })
});

function getThemeConfigStub() {
    const themeConfig = Sinon.stub();
    const rawConfig = {
        jspm: {
            dev: {
                dep_location: 'assets/js/dependency-bundle.js',
                bootstrap: 'js/**/* - [js/**/*]',
            },
            bootstrap: 'js/app',
            bundle_location: 'assets/js/bundle.js',
            jspm_packages_path: 'assets/jspm_packages',
        },
        meta: {
            "author_name": "Emilio Esteves",
            "author_email": "Emilio@work.net",
            "author_support_url": "http://emilio.net",
        },
    };

    themeConfig.configExists = Sinon.stub().returns(true);
    themeConfig.getRawConfig = Sinon.stub().returns(rawConfig);
    themeConfig.getSchema = Sinon.stub().callsArgWith(0, null, themeSchema);

    return themeConfig;
}
