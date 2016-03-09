var Code = require('code'),
    Lab = require('lab'),
    lab = exports.lab = Lab.script(),
    describe = lab.describe,
    Wreck = require('wreck'),
    sinon = require('sinon'),
    sizeOf = require('image-size'),
    Path = require('path'),
    themePath = Path.join(__dirname, '../_mocks/themes/valid'),
    ThemeConfig = require('../../lib/themeConfig'),
    BundleValidator = require('../../lib/bundleValidator'),
    expect = Code.expect,
    it = lab.it;

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

        validator.validateTheme(function(error, result) {

            expect(error).to.be.null();
            expect(sizeOfSpy.called).to.equal(false);

            sizeOfSpy.restore();
            done();
        })
    });


    it('should run image validations for marketplace themes', function (done) {
        var validator = new BundleValidator(themePath, themeConfig, false);
        var sizeOfSpy = sinon.spy(validator, 'sizeOf');

        validator.validateTheme(function(error, result) {
            expect(error).to.be.null();
            expect(sizeOfSpy.called).to.equal(true);

            sizeOfSpy.restore();
            done();
        })
    });

    it ('should validate returned objects exist in templates', function (done) {
        var validResults = [
            {"page":"---\nfront_matter_options:\n    setting_x:\n        value: {{theme_settings.front_matter_value}}\n---\n<!DOCTYPE html>\n<html>\n<body>\n{{{footer.scripts}}}\n{{#if theme_settings.display_that}}\n    <div>{{> components/index}}</div>\n{{/if}}\n</body>\n</html>\n",
                "components/index":"<h1>This is the index</h1>\n"
            },
            {
                "page2":"<!DOCTYPE html>\n<html>\n<body>\n    <h1>{{theme_settings.customizable_title}}</h1>\n{{{head.scripts}}}\n</body>\n</html>\n"
            }
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
                "components/index":"<h1>This is the index</h1>\n"
            },
            {
                "page2":"<!DOCTYPE html>\n<html>\n<body>\n    <h1>{{theme_settings.customizable_title}}</h1>\n{{{ head.scripts }}}\n</body>\n</html>\n"
            }
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
                "components/index":"<h1>This is the index</h1>\n"
            },
            {
                "page2":"<!DOCTYPE html>\n<html>\n<body>\n    <h1>{{theme_settings.customizable_title}}</h1>\n{{{head.scripts}}}\n</body>\n</html>\n"
            }
        ];

        var validator = new BundleValidator(themePath, themeConfig, false);
        validator.validateObjects(validResults, function (err, result) {
            expect(result).to.be.undefined();
            expect(err.message).to.equal('Missing required objects/properties: footer.scripts');
            done();
        });
    })
});
