'use strict';

const Code = require('code');
const Fs = require('fs');
const Sinon = require('sinon');
const Path = require('path');
const async = require('async');
const when = require('when');
const Lab = require('lab');
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const themePath = Path.join(process.cwd(), 'test/_mocks/themes/valid');
const expect = Code.expect;
const it = lab.it;
const StencilBundle = require('../lib/stencil-bundle');
const LangAssembler = require('../lib/lang-assembler');
const jspm = require('jspm');
const themeSchema = Fs.readFileSync((Path.join(themePath, 'schema.json'))).toString();

describe('Stencil Bundle', () => {
    let sandbox;
    let Bundle;

    lab.beforeEach(done => {
        sandbox = Sinon.createSandbox();
        const themeConfigStub = getThemeConfigStub();
        const rawConfig = {
            "name": "Cornerstone",
            "version": "1.1.0",
        };

        sandbox.stub(console, 'log');
        sandbox.stub(console, 'error');
        sandbox.stub(Fs, 'writeFile').callsArgWith(2, null);

        Bundle = new StencilBundle(themePath, themeConfigStub, rawConfig, {
            marketplace: false,
        });

        done();
    });

    lab.afterEach(done => {
        sandbox.restore();
        done();
    });

    it('should initialize bundling', done => {
        sandbox.stub(async, 'series').callsArgWith(1, new Error('error'));
        const throws = () => {
            Bundle.initBundle();
        };

        expect(throws).to.throw(Error);
        expect(async.series.calledOnce).to.equal(true);
        done();
    });

    it('should assemble CSS files', done => {
        sandbox.stub(async, 'map').callsArgWith(2, null, ['this is dog']);

        const callback = (err, result) => {
            expect(result).to.equal({'theme.scss': 'this is dog'});

            done();
        };

        const task = Bundle.getCssAssembleTask('scss');

        task(callback);

    });

    it('should error on assemble CSS files', done => {
        sandbox.stub(async, 'map').callsArgWith(2, 'error');

        const callback = err => {
            expect(err).to.equal('error');
            done();
        };

        const task = Bundle.getCssAssembleTask('scss');

        task(callback);

    });

    it('should assembleTemplates', done => {
        Bundle.assembleTemplatesTask((err, result) => {
            expect(err).to.be.null();
            expect(result['pages/page']).to.include(['pages/page', 'components/a']);
            expect(result['pages/page2']).to.include(['pages/page2', 'components/b']);
            done();
        });
    });

    it('should error when running assembleTemplates', done => {
        sandbox.stub(async, 'map').callsArgWith(2, 'error');

        Bundle.assembleTemplatesTask(err => {
            expect(err).to.equal('error');
            done();
        });
    });

    it('should assemble the Schema', done => {
        Bundle.assembleSchema((err, result) => {
            expect(result).to.equal(themeSchema);
            done();
        });
    });

    it('should assemble the Lang Files', done => {
        sandbox.stub(LangAssembler, 'assemble').callsArgWith(0, null);

        const callback = () => {
            expect(LangAssembler.assemble.calledOnce).to.equal(true);
            done();
        };

        Bundle.assembleLangTask(callback);

    });

    it('should error on assembling the Lang Files', done => {
        sandbox.stub(LangAssembler, 'assemble').callsArgWith(0, 'error');

        const callback = err => {
            expect(LangAssembler.assemble.calledOnce).to.equal(true);
            expect(err).to.equal('error');
            done();
        };

        Bundle.assembleLangTask(callback);

    });

    it('should bundle JSPM assets', done => {
        sandbox.stub(jspm, 'bundleSFX').returns(when());

        const callback = (err, result) => {
            expect(result).to.equal(true);
            done();
        };

        Bundle.getJspmBundleTask(getThemeConfigStub().getRawConfig)(callback);

    });

    it('should fail to bundle JSPM assets', done => {
        sandbox.stub(jspm, 'bundleSFX').returns(when.reject(false));

        const callback = err => {
            expect(err).to.equal(false);
            done();
        };

        Bundle.getJspmBundleTask(getThemeConfigStub().getRawConfig)(callback);
    });

    it('should generate a manifest of files.', done => {
        Bundle.assembleTemplatesTask((err, templates) => {
            const results = { templates };
            Bundle.generateManifest(results, (err, manifest) => {
                expect(err).to.be.null();
                expect(manifest.templates).to.contain(['components/a', 'components/b']);
                done();
            });
        });
    });

    it('should error while reading files to generate a manifest of files.', done => {
        Bundle.templatesPath = 'invalid/path';
        Bundle.generateManifest({}, err => {
            expect(Fs.writeFile.calledOnce).to.equal(false);
            expect(err instanceof Error).to.be.true();
            expect(err.message).to.contain('no such file or directory');
            done();
        });
    });

    function getThemeConfigStub() {
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

        return {
            configExists: sandbox.stub().returns(true),
            getRawConfig: sandbox.stub().returns(rawConfig),
            getSchema: sandbox.stub().callsArgWith(0, null, themeSchema),
        };
    }
});
