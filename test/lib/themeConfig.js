var Code = require('code'),
    Fs = require('fs'),
    Hoek = require('hoek'),
    Lab = require('lab'),
    Path = require('path'),
    Sinon = require('sinon'),
    ThemeConfig = require('../../lib/themeConfig'),
    lab = exports.lab = Lab.script(),
    configPath = Path.join(__dirname, '../_mocks/config.json'),
    configMissingVariationsPath = Path.join(__dirname, '../_mocks/config-missing-variations.json'),
    configBareBonesPath = Path.join(__dirname, '../_mocks/config-bare-bones.json'),
    describe = lab.describe,
    expect = Code.expect,
    it = lab.it,
    schemaPath = Path.join(__dirname, '../_mocks/schema.json'),
    themeConfig;

describe('ThemeConfig', function() {
    lab.beforeEach(function(done) {
        themeConfig = ThemeConfig.getInstance(configPath, schemaPath, 'First');

        done();
    });

    describe('getInstance()', function() {
        it ('should always return the same instance', function(done) {
            expect(themeConfig).to.equal(ThemeConfig.getInstance());

            done();
        });

        it ('should allow overwriting of configPath, schemaPath, and variationName', function(done) {
            var secondConfigPath = '/fake/config.json',
                secondSchemaPath = '/fake/schema.json',
                secondVariationName = 'Second',
                secondThemeConfig = ThemeConfig.getInstance(secondConfigPath, secondSchemaPath, secondVariationName);

            expect(secondThemeConfig.configPath).to.equal(secondConfigPath);
            expect(secondThemeConfig.schemaPath).to.equal(secondSchemaPath);
            expect(secondThemeConfig.variationName).to.equal(secondVariationName);
            expect(secondThemeConfig).to.equal(themeConfig);

            done();
        });
    });

    describe('getConfig()', function() {
        it('should return the correct config for the current variation', function(done) {
            var config = ThemeConfig.getInstance().setVariationName('Second').getConfig(),
                originalSettingsToCompare = {
                    color: '#ffffff',
                    font: 'Sans Something',
                    select: 'first',
                    checkbox: true,
                    radio: 'first'
                },
                settingsToCompare = {
                    color: '#000000',
                    font: 'Sans Something',
                    select: 'second',
                    checkbox: true,
                    radio: 'first'
                },
                imagesToCompare = {
                    logo: { width: 200, height: 200 },
                    thumb: { width: 10, height: 10 }
                };

            expect(config.settings).to.deep.equal(settingsToCompare);
            expect(config.images).to.deep.equal(imagesToCompare);
            expect(ThemeConfig.getInstance().globalSettings).to.deep.equal(originalSettingsToCompare);

            done();
        });

        it('should throw an Error if there are no variations in config.json file', function(done) {
            var themeConfig = ThemeConfig.getInstance(configMissingVariationsPath);

            expect(themeConfig.getConfig).to.throw(Error);

            done();
        });

        it('should grab the first variation if none is passed in', function(done) {
            var themeConfig = ThemeConfig.getInstance();

            themeConfig.setVariationName(null);
            expect(themeConfig.getConfig().variationName).to.equal('First');

            done();
        });

        it('should grab a specific variation if passed in', function(done) {
            var themeConfig = ThemeConfig.getInstance();

            themeConfig.setVariationName('Second');
            expect(themeConfig.getConfig().variationName).to.equal('Second');

            done();
        });

        it('should throw an Error if the passed in variation name does not match any in the config.json', function(done) {
            var themeConfig = ThemeConfig.getInstance(configMissingVariationsPath);

            themeConfig.setVariationName('Does Not Exist');

            expect(themeConfig.getConfig).to.throw(Error);

            done();
        });

        it('should set proper default values if they do not exist', function(done) {
            var themeConfig = ThemeConfig.getInstance(configBareBonesPath),
                config = themeConfig.getConfig();

            expect(config.settings).to.deep.equal({});
            expect(config.images).to.deep.equal({});
            expect(config.css_compiler).to.equal('scss');
            expect(config.autoprefixer_cascade).to.equal(true);
            expect(config.autoprefixer_browsers).to.deep.equal(['> 5% in US']);

            done();
        });
    });

    describe('updateConfig()', function() {
        var config,
            newSettings,
            originalSettings,
            themeConfig;

        lab.beforeEach(function(done) {
            themeConfig = ThemeConfig.getInstance();
            config = themeConfig.getConfig();
            originalSettings = Hoek.clone(config.settings);
            newSettings = {
                color: '#000000',
                font: 'Sans Something',
                select: 'second',
                checkbox: true,
                radio: 'first'
            };

            done();
        });

        it('should update the currentConfig with the new changes', function(done) {
            expect(originalSettings).not.to.deep.equal(newSettings);

            themeConfig.updateConfig(newSettings);

            expect(themeConfig.getConfig().settings).not.to.deep.equal(originalSettings);
            expect(themeConfig.getConfig().settings).to.deep.equal(newSettings);

            done();
        });

        it('should not write to config file if saveToFile is falsey', function(done) {
            Sinon.stub(Fs, 'writeFileSync');

            themeConfig.updateConfig(newSettings);
            expect(Fs.writeFileSync.called).to.be.false();
            Fs.writeFileSync.restore();

            done();
        });

        it('should write to config file if saveToFile is truthy', function(done) {
            Sinon.stub(Fs, 'writeFileSync');

            themeConfig.updateConfig(newSettings, true);
            expect(Fs.writeFileSync.called).to.be.true();
            Fs.writeFileSync.restore();

            done();
        });

        it('should return an object with forceReload property', function(done) {
            var response = themeConfig.updateConfig(newSettings);

            expect(response).to.include('forceReload');

            done();
        });

        it('should just modify the variations section of the file', function(done) {
            var initialConfig = JSON.parse(Fs.readFileSync(configPath, {encoding: 'utf-8'}));

            Sinon.stub(Fs, 'writeFileSync', testSave);

            function testSave(path, newConfig) {
                newConfig = JSON.parse(newConfig);

                expect(newConfig).not.to.deep.equal(initialConfig);

                delete newConfig.variations;
                delete initialConfig.variations;

                expect(newConfig).to.deep.equal(initialConfig);

                done();
            }

            themeConfig.updateConfig(newSettings, true);

            Fs.writeFileSync.restore();
        });
    });

    describe('checkForceReload()', function() {
        it('should return the correct boolean based on passed in setting names', function(done) {
            var themeConfig = ThemeConfig.getInstance();

            expect(themeConfig.checkForceReload(['color', 'font'])).to.equal(false);
            expect(themeConfig.checkForceReload(['color', 'select'])).to.equal(true);

            done();
        });
    });
});
