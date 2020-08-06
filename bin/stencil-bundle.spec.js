'use strict';

const Code = require('code');
const Fs = require('fs');
const Sinon = require('sinon');
const Path = require('path');
const { promisify } = require('util');
const async = require('async');
const when = require('when');
const Lab = require('@hapi/lab');
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

    lab.beforeEach(() => {
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
    });

    lab.afterEach(() => {
        sandbox.restore();
    });

    it('should initialize bundling', () => {
        sandbox.stub(async, 'series').callsArgWith(1, new Error('error'));
        const throws = () => {
            Bundle.initBundle();
        };

        expect(throws).to.throw(Error);
        expect(async.series.calledOnce).to.equal(true);
    });

    it('should assemble CSS files', async () => {
        sandbox.stub(async, 'map').callsArgWith(2, null, ['this is dog']);

        const task = Bundle.getCssAssembleTask('scss');
        const result = await promisify(task.bind(Bundle))();

        expect(result).to.equal({'theme.scss': 'this is dog'});
    });

    it('should error on assemble CSS files', async () => {
        sandbox.stub(async, 'map').callsArgWith(2, 'our_error');

       let error;
        try {
            const task = Bundle.getCssAssembleTask('scss');
            await promisify(task.bind(Bundle))();
        } catch (err) {
            error = err;
        }
        expect(error).to.equal('our_error');
    });

    it('should assembleTemplates', async () => {
        const result = await promisify(Bundle.assembleTemplatesTask.bind(Bundle))();

        expect(result['pages/page']).to.include(['pages/page', 'components/a']);
        expect(result['pages/page2']).to.include(['pages/page2', 'components/b']);
    });

    it('should error when running assembleTemplates', async () => {
        sandbox.stub(async, 'map').callsArgWith(2, 'our_error');

        let error;
        try {
            await promisify(Bundle.assembleTemplatesTask.bind(Bundle))();
        } catch (err) {
            error = err;
        }

        expect(error).to.equal('our_error');
    });

    it('should assemble the Schema', async () => {
        const result = await promisify(Bundle.assembleSchema.bind(Bundle))();

        expect(result).to.equal(themeSchema);
    });

    it('should assemble the Lang Files', async () => {
        sandbox.stub(LangAssembler, 'assemble').callsArgWith(0, null);

        await promisify(Bundle.assembleLangTask.bind(Bundle))();

        expect(LangAssembler.assemble.calledOnce).to.equal(true);
    });

    it('should error on assembling the Lang Files', async () => {
        sandbox.stub(LangAssembler, 'assemble').callsArgWith(0, 'our_error');

        let error;
        try {
            await promisify(Bundle.assembleLangTask.bind(Bundle))();
        } catch (err) {
            error = err;
        }

        expect(LangAssembler.assemble.calledOnce).to.equal(true);
        expect(error).to.equal('our_error');
    });

    it('should bundle JSPM assets', async () => {
        sandbox.stub(jspm, 'bundleSFX').returns(when());

        const jspmBundleTask = Bundle.getJspmBundleTask(getThemeConfigStub().getRawConfig);
        const result = await promisify(jspmBundleTask.bind(Bundle))();

        expect(result).to.equal(true);
    });

    it('should fail to bundle JSPM assets', async () => {
        sandbox.stub(jspm, 'bundleSFX').returns(when.reject('SFX Bundle input error'));

        let error;
        try {
            const jspmBundleTask = Bundle.getJspmBundleTask(getThemeConfigStub().getRawConfig);
            await promisify(jspmBundleTask.bind(Bundle))();
        } catch (err) {
            error = err;
        }

        expect(error).to.equal('SFX Bundle input error');
    });

    it('should generate a manifest of files.', async () => {
        const templates = await promisify(Bundle.assembleTemplatesTask.bind(Bundle))();
        const manifest = await promisify(Bundle.generateManifest.bind(Bundle))({ templates });

        expect(manifest.templates).to.contain(['components/a', 'components/b']);
    });

    it('should error while reading files to generate a manifest of files.', async () => {
        Bundle.templatesPath = 'invalid/path';

        let error;
        try {
           await promisify(Bundle.generateManifest.bind(Bundle))({});
        } catch (err) {
            error = err;
        }

        expect(Fs.writeFile.calledOnce).to.equal(false);
        expect(error instanceof Error).to.be.true();
        expect(error.message).to.contain('no such file or directory');
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
