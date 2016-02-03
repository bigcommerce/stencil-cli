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
});
