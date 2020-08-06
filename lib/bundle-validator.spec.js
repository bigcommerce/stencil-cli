const Code = require('code');
const Lab = require('@hapi/lab');
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const sinon = require('sinon');
const Path = require('path');
const { promisify } = require('util');
const themePath = Path.join(process.cwd(), 'test/_mocks/themes/valid');
const ThemeConfig = require('./theme-config');
const BundleValidator = require('./bundle-validator');
const expect = Code.expect;
const it = lab.it;

describe('BundleValidator', function () {
    let themeConfig;

    lab.beforeEach(function() {
        themeConfig = ThemeConfig.getInstance(themePath);
        themeConfig.getConfig();
    });

    it('should not run image validations for private themes', async () => {
        const validator = new BundleValidator(themePath, themeConfig, true);
        const sizeOfSpy = sinon.spy(validator, 'sizeOf');

        await promisify(validator.validateTheme.bind(validator))();

        expect(sizeOfSpy.called).to.equal(false);

        sizeOfSpy.restore();
    });


    it('should run image validations for marketplace themes', async () => {
        const validator = new BundleValidator(themePath, themeConfig, false);
        const sizeOfSpy = sinon.spy(validator, 'sizeOf');

        await promisify(validator.validateTheme.bind(validator))();

        expect(sizeOfSpy.called).to.equal(true);

        sizeOfSpy.restore();
    });

    it ('should validate returned objects exist in templates', async () => {
        const validResults = [
            {"page":"---\nfront_matter_options:\n    setting_x:\n        value: {{theme_settings.front_matter_value}}\n---\n<!DOCTYPE html>\n<html>\n<body>\n{{{footer.scripts}}}\n{{#if theme_settings.display_that}}\n    <div>{{> components/index}}</div>\n{{/if}}\n</body>\n</html>\n",
                "components/index":"<h1>This is the index</h1>\n",
            },
            {
                "page2":"<!DOCTYPE html>\n<html>\n<body>\n    <h1>{{theme_settings.customizable_title}}</h1>\n{{{head.scripts}}}\n</body>\n</html>\n",
            },
        ];
        const validator = new BundleValidator(themePath, themeConfig, false);

        const result = await promisify(validator.validateObjects.bind(validator))(validResults);

        expect(result).to.equal(true);
    });

    it ('should validate returned objects when they have whitespace in the object name', async () => {
        const validResults = [
            {"page":"---\nfront_matter_options:\n    setting_x:\n        value: {{theme_settings.front_matter_value}}\n---\n<!DOCTYPE html>\n<html>\n<body>\n{{{footer.scripts}}}\n{{#if theme_settings.display_that}}\n    <div>{{> components/index}}</div>\n{{/if}}\n</body>\n</html>\n",
                "components/index":"<h1>This is the index</h1>\n",
            },
            {
                "page2":"<!DOCTYPE html>\n<html>\n<body>\n    <h1>{{theme_settings.customizable_title}}</h1>\n{{{ head.scripts }}}\n</body>\n</html>\n",
            },
        ];
        const validator = new BundleValidator(themePath, themeConfig, false);

        const result = await promisify(validator.validateObjects.bind(validator))(validResults);

        expect(result).to.equal(true);
    });

    it ('should not validate returned objects exist in templates', async () => {
        const validResults = [
            {"page":"---\nfront_matter_options:\n    setting_x:\n        value: {{theme_settings.front_matter_value}}\n---\n<!DOCTYPE html>\n<html>\n<body>\n{{#if theme_settings.display_that}}\n    <div>{{> components/index}}</div>\n{{/if}}\n</body>\n</html>\n",
                "components/index":"<h1>This is the index</h1>\n",
            },
            {
                "page2":"<!DOCTYPE html>\n<html>\n<body>\n    <h1>{{theme_settings.customizable_title}}</h1>\n{{{head.scripts}}}\n</body>\n</html>\n",
            },
        ];
        const validator = new BundleValidator(themePath, themeConfig, false);

        let error;
        let result;
        try {
            result = await promisify(validator.validateObjects.bind(validator))(validResults);
        } catch (err) {
            error = err;
        }

        expect(result).to.be.undefined();
        expect(error.message).to.equal('Missing required objects/properties: footer.scripts');
    });

    it ('should validate theme schema successfully', async () => {
        const validator = new BundleValidator(themePath, themeConfig, false);

        await promisify(validator.validateTheme.bind(validator))();
    });

    it ('should validate theme schema and throw errors', async () => {
        const themePath = Path.join(process.cwd(), 'test/_mocks/themes/invalid-schema');
        themeConfig = ThemeConfig.getInstance(themePath);
        themeConfig.getConfig();

        const validator = new BundleValidator(themePath, themeConfig, false);

        let error;
        try {
            await promisify(validator.validateTheme.bind(validator))();
        } catch (err) {
            error = err;
        }

        expect(error instanceof Error).to.be.true();
        expect(error.message).to.contain('schema[0].settings[0] should have required property \'content\'');
    });
});
