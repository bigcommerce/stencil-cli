
'use strict';

const Code = require('code');
const Fs = require('fs');
const Sinon = require('sinon');
const Lab = require('lab');
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const expect = Code.expect;
const it = lab.it;

const StencilBundle = require('./stencil-bundle');
const themePath = `${process.cwd()}/test/_mocks/themes/regions`;
const themeSchema = Fs.readFileSync(`${themePath}/schema.json`).toString();

describe('Stencil Bundle', () => {
    let sandbox;
    let Bundle;

    lab.beforeEach(done => {
        sandbox = Sinon.sandbox.create();
        const themeConfigStub = {
            configExists: sandbox.stub().returns(true),
            getRawConfig: sandbox.stub().returns({}),
            getSchema: sandbox.stub().callsArgWith(0, null, themeSchema),
        };

        const rawConfig = {
            "name": "Cornerstone",
            "version": "1.1.0",
        };

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

    it('should return all regions with the right order.', done => {
        Bundle.assembleTemplatesTask((err, templates) => {
            expect(err).to.be.null();
            const results = { templates };
            Bundle.generateManifest(results, () => {
                expect(results.manifest.regions['pages/page']).to.equal([
                    { name: 'top_region' },
                    { name: 'dynamic_a' },
                    { name: 'dynamic_b' },
                    { name: 'dynamic_c' },
                    { name: 'middle_region' },
                    { name: 'other' },
                    { name: 'bottom_region' },
                ]);
                done();
            });
        });
    });
});
