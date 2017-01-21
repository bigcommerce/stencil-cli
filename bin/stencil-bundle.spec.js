var Code = require('code');
var Fs = require('fs');
var Sinon = require('sinon');
var rewire = require('rewire');
var Path = require('path');
var async = require('async');
var when = require('when');
var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var themePath = Path.join(process.cwd(), 'test/_mocks/themes/valid');
var expect = Code.expect;
var it = lab.it;
var StencilBundle = rewire('../lib/stencil-bundle');
var bundleValidator = require('../lib/bundle-validator');
var AsyncStub;
var jspm = require('jspm');
var themeConfigStub;
var rawConfig;
var themeSchema = Fs.readFileSync((Path.join(themePath, 'schema.json'))).toString();
var Bundle;

describe('Stencil Bundle', function () {

    lab.beforeEach(function (done) {

        themeConfigStub = getThemeConfigStub();
        rawConfig = {
            "name": "Cornerstone",
            "version": "1.1.0",
        };

        Bundle = new StencilBundle(themePath, themeConfigStub, rawConfig, null, {
            marketplace: false,
        });
        done();
    });

    lab.afterEach(function (done) {
        AsyncStub.restore();
        done();
    });

    it('should initialize bundling', function (done) {
        AsyncStub = Sinon.stub(async, 'series');
        AsyncStub.callsArgWith(1, new Error('error'));
        var throws = function () {
            Bundle.initBundle();
        };

        expect(throws).to.throw(Error);
        expect(AsyncStub.calledOnce).to.equal(true);
        AsyncStub.restore();
        done();
    });

    it('should assemble CSS files', function (done) {
        AsyncStub = Sinon.stub(async, 'map');
        AsyncStub.callsArgWith(2, null, ['this is dog']);

        var callback = function (err, result) {
            expect(result).to.deep.equal({'theme.scss': 'this is dog'});
            AsyncStub.restore();
            done();
        };

        var task = Bundle.getCssAssembleTask('scss');

        task(callback);

    });

    it('should error on assemble CSS files', function (done) {
        AsyncStub = Sinon.stub(async, 'map');
        AsyncStub.callsArgWith(2, 'error');

        var callback = function (err, result) {
            expect(err).to.equal('error');
            AsyncStub.restore();
            done();
        };

        var task = Bundle.getCssAssembleTask('scss');

        task(callback);

    });

    it('should assembleTemplates', function (done) {
        AsyncStub = Sinon.stub(async, 'map');
        AsyncStub.callsArgWith(2, null, ['test', 'test2']);
        var BundleVal = Sinon.stub(bundleValidator.prototype, 'validateObjects').callsArgWith(1, null);

        var callback = function (err, result) {
            expect(result).to.deep.equal({page: 'test', page2: 'test2'});
            AsyncStub.restore();
            BundleVal.restore();
            done();
        };

        Bundle.assembleTemplatesTask(callback);

    });

    it('should error when running  assembleTemplates', function (done) {
        AsyncStub = Sinon.stub(async, 'map');
        AsyncStub.callsArgWith(2, 'error');
        var BundleVal = Sinon.stub(bundleValidator.prototype, 'validateObjects').callsArgWith(1, null);

        var callback = function (err, result) {
            expect(err).to.equal('error');
            AsyncStub.restore();
            BundleVal.restore();
            done();
        };

        Bundle.assembleTemplatesTask(callback);

    });

    it('should assemble the Schema', function (done) {
        var callback = function (err, result) {
            expect(result).to.deep.equal(themeSchema);
            done();
        };

        Bundle.assembleSchema(callback);

    });

    it('should assemble the Lang Files', function (done) {
        var langStub = Sinon.stub();
        langStub.assemble = Sinon.stub().callsArgWith(0, null);

        StencilBundle.__set__({
            'LangAssembler': langStub
        });

        var callback = function () {
            expect(langStub.assemble.calledOnce).to.equal(true);
            done();
        };

        Bundle.assembleLangTask(callback);

    });

    it('should error on assembling the Lang Files', function (done) {
        var langStub = Sinon.stub();
        langStub.assemble = Sinon.stub().callsArgWith(0, 'error');

        StencilBundle.__set__({
            'LangAssembler': langStub
        });

        var callback = function (err) {
            expect(langStub.assemble.calledOnce).to.equal(true);
            expect(err).to.equal('error');
            done();
        };

        Bundle.assembleLangTask(callback);

    });

    it('should bundle JSPM assets', function (done) {
        var jspmStub = Sinon.stub(jspm, 'bundleSFX').returns(when());

        var callback = function (err, result) {
            expect(result).to.equal(true);
            jspmStub.restore();
            done();
        };

        Bundle.getJspmBundleTask(getThemeConfigStub().getRawConfig)(callback);

    });

    it('should fail to bundle JSPM assets', function (done) {
        var jspmStub = Sinon.stub(jspm, 'bundleSFX').returns(when.reject(false));

        var callback = function (err) {
            expect(err).to.equal(false);
            jspmStub.restore();
            done();
        };

        Bundle.getJspmBundleTask(getThemeConfigStub().getRawConfig)(callback);
    });

    it('should generate a manifest of files.', function (done) {
        var rrStub = Sinon.stub().callsArgWith(2, null, ['test', 'test2']);
        var FsStub = Sinon.stub().callsArgWith(2, null);

        StencilBundle.__set__({
            'rr': rrStub,
            'Fs.writeFile': FsStub
        });

        var callback = function () {
            expect(rrStub.calledOnce).to.equal(true);
            expect(Bundle.manifest.templates[0]).to.equal('test');
            expect(Bundle.manifest.templates[1]).to.equal('test2');

            done();
        };

        Bundle.generateManifest(callback);
    });

    it('should error while reading files to generate a manifest of files.', function (done) {
        var rrStub = Sinon.stub().callsArgWith(2, 'There was an error', null);
        var FsStub = Sinon.stub().callsArgWith(2, null);

        StencilBundle.__set__({
            'rr': rrStub,
            'Fs.writeFile': FsStub
        });

        var callback = function (err, result) {
            expect(rrStub.calledOnce).to.equal(true);
            expect(FsStub.calledOnce).to.equal(false);
            expect(err).to.equal('There was an error');
            done();
        };

        Bundle.generateManifest(callback);
    })
});

function getThemeConfigStub() {
    var themeConfig = Sinon.stub();
    var rawConfig = {
        jspm: {
            dev: {
                dep_location: 'assets/js/dependency-bundle.js',
                bootstrap: 'js/**/* - [js/**/*]'
            },
            bootstrap: 'js/app',
            bundle_location: 'assets/js/bundle.js',
            jspm_packages_path: 'assets/jspm_packages'
        },
        meta: {
            "author_name": "Emilio Esteves",
            "author_email": "Emilio@work.net",
            "author_support_url": "http://emilio.net"
        }
    };

    themeConfig.configExists = Sinon.stub().returns(true);
    themeConfig.getRawConfig = Sinon.stub().returns(rawConfig);
    themeConfig.getSchema = Sinon.stub().callsArgWith(0, null, themeSchema);

    return themeConfig;
}
