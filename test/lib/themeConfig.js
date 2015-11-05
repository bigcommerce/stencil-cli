var Code = require('code'),
    Fs = require('fs'),
    Hoek = require('hoek'),
    Lab = require('lab'),
    Path = require('path'),
    Sinon = require('sinon'),
    ThemeConfig = require('../../lib/themeConfig'),
    lab = exports.lab = Lab.script(),
    themePath = Path.join(__dirname, '../_mocks/themes/valid'),
    missingVariationsThemePath = Path.join(__dirname, '../_mocks/themes/missing-variation'),
    bareBonesThemePath = Path.join(__dirname, '../_mocks/themes/bare-bones'),
    describe = lab.describe,
    expect = Code.expect,
    it = lab.it,
    themeConfig;

describe('ThemeConfig', function() {
    lab.beforeEach(function(done) {
        themeConfig = ThemeConfig.getInstance(themePath).setVariationByName('First');

        done();
    });

    describe('getInstance()', function() {
        it ('should always return the same instance', function(done) {
            expect(themeConfig).to.equal(ThemeConfig.getInstance());

            done();
        });

        it ('should allow overwriting of configPath, schemaPath, and variationName by calling getInstance with params', function(done) {
            var secondConfigPath = '/fake/config.json';
            var secondSchemaPath = '/fake/schema.json';
            var secondVariationName = 'Second';
            var secondThemeConfig;

            secondThemeConfig = ThemeConfig.getInstance('/fake');

            expect(secondThemeConfig.configPath).to.equal(secondConfigPath);
            expect(secondThemeConfig.schemaPath).to.equal(secondSchemaPath);
            expect(secondThemeConfig).to.equal(themeConfig);

            done();
        });
    });

    describe('getConfig()', function() {
        it('should return the correct config for the current variation', function(done) {
            var config = ThemeConfig.getInstance().setVariationByName('Second').getConfig(),
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
            var themeConfig = ThemeConfig.getInstance(missingVariationsThemePath);

            expect(themeConfig.getConfig).to.throw(Error);

            done();
        });

        it('should grab the first variation if none is passed in', function(done) {
            var themeConfig = ThemeConfig.getInstance();

            themeConfig.setVariationByName(null);
            // console.log(themeConfig.getConfig());
            expect(themeConfig.getConfig().variationName).to.equal('First');

            done();
        });

        it('should grab a specific variation if passed in', function(done) {
            var themeConfig = ThemeConfig.getInstance();

            themeConfig.setVariationByName('Second');
            expect(themeConfig.getConfig().variationName).to.equal('Second');

            done();
        });

        it('should throw an Error if the passed in variation name does not match any in the config.json', function(done) {
            var themeConfig = ThemeConfig.getInstance(themePath);

            function setVariation() {
                themeConfig.setVariationByName('Does Not Exist');
            }

            expect(setVariation).to.throw(Error);

            done();
        });

        it('should set proper default values if they do not exist', function(done) {
            var themeConfig = ThemeConfig.getInstance(bareBonesThemePath),
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

        it('should just modify the variations section of the file', function(done) {
            var configPath = Path.join(themePath, 'config.json');
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

    describe('getSchema()', function() {

        it('should return the correct schema', function(done) {

            var themeConfig = ThemeConfig.getInstance();
            var originalSchema = require(Path.join(themePath, 'schema.json'));

            themeConfig.getSchema(function(err, schema) {

                expect(err).to.be.null();

                expect(schema).to.be.an.array();

                expect(schema[0]).to.deep.equal(originalSchema[0]);
                expect(schema).to.have.length(2);

                expect(schema[1].settings[0].force_reload).to.deep.true();
                expect(schema[1].settings[1].force_reload).to.deep.true();
                expect(schema[1].settings[2].force_reload).to.deep.true();

                done();
            });
        });

        it('should return an empty schema', function(done) {

            var themeConfig = ThemeConfig.getInstance(bareBonesThemePath);

            themeConfig.getSchema(function(err, schema) {
                expect(schema).to.be.an.array();
                expect(schema).to.have.length(0);

                done();
            });
        });
    });
});
