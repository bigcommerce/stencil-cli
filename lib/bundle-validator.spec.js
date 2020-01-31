const Code = require('code');
const Lab = require('lab');
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const sinon = require('sinon');
const Path = require('path');
const themePath = Path.join(process.cwd(), 'test/_mocks/themes/valid');
const ThemeConfig = require('./theme-config');
const BundleValidator = require('./bundle-validator');
const expect = Code.expect;
const it = lab.it;

describe('BundleValidator', function () {
    var themeConfig;

    lab.beforeEach(function(done) {
        themeConfig = ThemeConfig.getInstance(themePath);
        themeConfig.getConfig();

        done();
    });

    it('should not run image validations for private themes', function (done) {

        var validator = new BundleValidator(themePath, themeConfig, true);
        var sizeOfSpy = sinon.spy(validator, 'sizeOf');

        validator.validateTheme(error => {

            expect(error).to.be.null();
            expect(sizeOfSpy.called).to.equal(false);

            sizeOfSpy.restore();
            done();
        });
    });


    it('should run image validations for marketplace themes', function (done) {
        var validator = new BundleValidator(themePath, themeConfig, false);
        var sizeOfSpy = sinon.spy(validator, 'sizeOf');

        validator.validateTheme(error => {
            expect(error).to.be.null();
            expect(sizeOfSpy.called).to.equal(true);

            sizeOfSpy.restore();
            done();
        });
    });

    it ('should validate returned objects exist in templates', function (done) {
        var validResults = [
            {"page":"---\nfront_matter_options:\n    setting_x:\n        value: {{theme_settings.front_matter_value}}\n---\n<!DOCTYPE html>\n<html>\n<body>\n{{{footer.scripts}}}\n{{#if theme_settings.display_that}}\n    <div>{{> components/index}}</div>\n{{/if}}\n</body>\n</html>\n",
                "components/index":"<h1>This is the index</h1>\n",
            },
            {
                "page2":"<!DOCTYPE html>\n<html>\n<body>\n    <h1>{{theme_settings.customizable_title}}</h1>\n{{{head.scripts}}}\n</body>\n</html>\n",
            },
        ];

        var validator = new BundleValidator(themePath, themeConfig, false);
        validator.validateObjects(validResults, function (err, result) {
            expect(result).to.equal(true);
            done();
        });
    });

    it ('should validate returned objects when they have whitespace in the object name', function (done) {
        var validResults = [
            {"page":"---\nfront_matter_options:\n    setting_x:\n        value: {{theme_settings.front_matter_value}}\n---\n<!DOCTYPE html>\n<html>\n<body>\n{{{footer.scripts}}}\n{{#if theme_settings.display_that}}\n    <div>{{> components/index}}</div>\n{{/if}}\n</body>\n</html>\n",
                "components/index":"<h1>This is the index</h1>\n",
            },
            {
                "page2":"<!DOCTYPE html>\n<html>\n<body>\n    <h1>{{theme_settings.customizable_title}}</h1>\n{{{ head.scripts }}}\n</body>\n</html>\n",
            },
        ];

        var validator = new BundleValidator(themePath, themeConfig, false);
        validator.validateObjects(validResults, function (err, result) {
            expect(result).to.equal(true);
            done();
        });
    });

    it ('should not validate returned objects exist in templates', function (done) {
        var validResults = [
            {"page":"---\nfront_matter_options:\n    setting_x:\n        value: {{theme_settings.front_matter_value}}\n---\n<!DOCTYPE html>\n<html>\n<body>\n{{#if theme_settings.display_that}}\n    <div>{{> components/index}}</div>\n{{/if}}\n</body>\n</html>\n",
                "components/index":"<h1>This is the index</h1>\n",
            },
            {
                "page2":"<!DOCTYPE html>\n<html>\n<body>\n    <h1>{{theme_settings.customizable_title}}</h1>\n{{{head.scripts}}}\n</body>\n</html>\n",
            },
        ];

        var validator = new BundleValidator(themePath, themeConfig, false);
        validator.validateObjects(validResults, function (err, result) {
            expect(result).to.be.undefined();
            expect(err.message).to.equal('Missing required objects/properties: footer.scripts');
            done();
        });
    });

    it ('should validate theme schema successfully', function (done) {
        const validator = new BundleValidator(themePath, themeConfig, false);
        validator.validateTheme(error => {
            expect(error).to.be.null();
            done();
        });
    });

    it ('should validate theme schema and throw errors', function (done) {
        const themePath = Path.join(process.cwd(), 'test/_mocks/themes/invalid-schema');
        themeConfig = ThemeConfig.getInstance(themePath);
        themeConfig.getConfig();

        const validator = new BundleValidator(themePath, themeConfig, false);

        validator.validateTheme(error => {
            expect(error instanceof Error).to.be.true();
            expect(error.message).to.contain('schema[0].settings[0] should have required property \'content\'');
            done();
        });
    });
});
