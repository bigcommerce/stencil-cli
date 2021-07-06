const fs = require('fs');
const { promisify } = require('util');

const Regions = require('./regions');
const StencilBundle = require('./stencil-bundle');

const themePath = `${process.cwd()}/test/_mocks/themes/regions`;

describe('Stencil Bundle', () => {
    let bundle;

    beforeEach(() => {
        const themeConfigStub = {
            configExists: jest.fn().mockReturnValue(true),
            getRawConfig: jest.fn().mockResolvedValue({}),
            getSchema: jest.fn().mockResolvedValue(null),
        };

        const rawConfig = {
            name: 'Cornerstone',
            version: '1.1.0',
        };

        jest.spyOn(console, 'log').mockImplementation(jest.fn()); // Prevent littering the console with info messages
        jest.spyOn(fs, 'writeFile').mockImplementation((path, data, cb) => cb(null));

        bundle = new StencilBundle(themePath, themeConfigStub, rawConfig, { marketplace: false });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should return all regions with the right order.', async () => {
        const assembleTemplatesTask = promisify(bundle.assembleTemplatesTask.bind(bundle));
        const generateManifest = promisify(bundle.generateManifest.bind(bundle));

        const templates = await assembleTemplatesTask();
        const manifest = await generateManifest({ templates });

        expect(manifest.regions['pages/page']).toEqual([
            { name: 'top_region' },
            { name: 'dynamic_a' },
            { name: 'dynamic_b' },
            { name: 'dynamic_c' },
            { name: 'middle_region' },
            { name: 'other' },
            { name: 'bottom_region' },
        ]);
    });
});

describe('Regions', () => {
    describe('parseRegions', () => {
        const map = {
            '{{{region translation="i18n.RegionName.TestingTranslation" name="_foobar"}}}': [
                { name: '_foobar', translation: 'i18n.RegionName.TestingTranslation' },
            ],
            '{{{ region name="foo-bar" translation="i18n.RegionName.Testing-translations" }}}': [
                { name: 'foo-bar', translation: 'i18n.RegionName.Testing-translations' },
            ],
            '{{{  region name="foobar__" translation="testing-without-i18n-prefix"}}}': [
                { name: 'foobar__' },
            ],
            '{{{  region name="foo_bar" }}}': [{ name: 'foo_bar' }],
            '{{{  region name="foo-_bar"  }}}': [{ name: 'foo-_bar' }],
            '{{{  region name="foobar1"  }}}': [{ name: 'foobar1' }],
            '{{{  region  name=" "  }}}': [],
            '{{{  region  name="invalid name"  translation="i18n.RegionName.ValidTranslation"}}}': [],
            '{{  region  name="two_brackets"  }}': [],
            "{{{  region   name='foobar'  }}}": [{ name: 'foobar' }],
            '{{{region name="foobar" type="widget"}}}': [{ name: 'foobar' }],
            '{{{ region type="widget"  name="foobar"  }}}': [{ name: 'foobar' }],
            '{{{ region name="foobar"  type="widget" }}}': [{ name: 'foobar' }],
            '{{{ region name=\'foo\' }}} \n {{{ region name="bar" }}}': [
                { name: 'foo' },
                { name: 'bar' },
            ],
            '{{{region name=\'foo\'}}}{{{region name="bar"}}}{{{region name="foo"}}}': [
                { name: 'foo' },
                { name: 'bar' },
            ],
        };

        for (const template of Object.keys(map)) {
            it(`should parse region for template ${template}`, () => {
                expect(Regions.parseRegions(template)).toEqual(map[template]);
            });
        }
    });
});
