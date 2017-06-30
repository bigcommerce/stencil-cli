'use strict';

const Code = require('code');
const Os = require('os');
const Fs = require('fs');
const Hoek = require('hoek');
const Lab = require('lab');
const Path = require('path');
const Sinon = require('sinon');
const ThemeConfig = require('./theme-config');
const lab = exports.lab = Lab.script();
const themePath = Path.join(process.cwd(), 'test/_mocks/themes/valid');
const missingVariationsThemePath = Path.join(process.cwd(), 'test/_mocks/themes/missing-variation');
const bareBonesThemePath = Path.join(process.cwd(), 'test/_mocks/themes/bare-bones');
const describe = lab.describe;
const expect = Code.expect;
const it = lab.it;

describe('ThemeConfig', () => {
    let themeConfig;

    lab.beforeEach(done => {
        themeConfig = ThemeConfig.getInstance(themePath).setVariationByName('First');

        done();
    });

    describe('getInstance()', () => {
        it ('should always return the same instance', done => {
            expect(themeConfig).to.equal(ThemeConfig.getInstance());

            done();
        });

        it ('should allow overwriting of configPath, schemaPath, and variationName by calling getInstance with params', done => {
            const isWindows = Os.platform() === 'win32';
            const secondConfigPath = isWindows ? '\\fake\\config.json' : '/fake/config.json';
            const secondSchemaPath = isWindows ? '\\fake\\schema.json' : '/fake/schema.json';
            const secondThemeConfig = ThemeConfig.getInstance('/fake');

            expect(secondThemeConfig.configPath).to.equal(secondConfigPath);
            expect(secondThemeConfig.schemaPath).to.equal(secondSchemaPath);
            expect(secondThemeConfig).to.equal(themeConfig);

            done();
        });
    });

    describe('getConfig()', () => {
        it('should return the correct config for the current variation', done => {
            var config = ThemeConfig.getInstance().setVariationByName('Second').getConfig(),
                originalSettingsToCompare = {
                    color: '#ffffff',
                    font: 'Sans Something',
                    select: 'first',
                    checkbox: true,
                    radio: 'first',
                },
                settingsToCompare = {
                    color: '#000000',
                    font: 'Sans Something',
                    select: 'second',
                    checkbox: true,
                    radio: 'first',
                },
                imagesToCompare = {
                    logo: { width: 200, height: 200 },
                    thumb: { width: 10, height: 10 },
                };

            expect(config.settings).to.equal(settingsToCompare);
            expect(config.images).to.equal(imagesToCompare);
            expect(ThemeConfig.getInstance().globalSettings).to.equal(originalSettingsToCompare);

            done();
        });

        it('should throw an Error if there are no variations in config.json file', done => {
            var themeConfig = ThemeConfig.getInstance(missingVariationsThemePath);

            expect(themeConfig.getConfig).to.throw(Error);

            done();
        });

        it('should grab the first variation if none is passed in', done => {
            var themeConfig = ThemeConfig.getInstance();

            themeConfig.setVariationByName(null);
            // console.log(themeConfig.getConfig());
            expect(themeConfig.getConfig().variationName).to.equal('First');

            done();
        });

        it('should grab a specific variation if passed in', done => {
            var themeConfig = ThemeConfig.getInstance();

            themeConfig.setVariationByName('Second');
            expect(themeConfig.getConfig().variationName).to.equal('Second');

            done();
        });

        it('should throw an Error if the passed in variation name does not match any in the config.json', done => {
            var themeConfig = ThemeConfig.getInstance(themePath);

            function setVariation() {
                themeConfig.setVariationByName('Does Not Exist');
            }

            expect(setVariation).to.throw(Error);

            done();
        });

        it('should set proper default values if they do not exist', done => {
            var themeConfig = ThemeConfig.getInstance(bareBonesThemePath),
                config = themeConfig.getConfig();

            expect(config.settings).to.equal({});
            expect(config.images).to.equal({});
            expect(config.css_compiler).to.equal('scss');
            expect(config.autoprefixer_cascade).to.equal(true);
            expect(config.autoprefixer_browsers).to.equal(['> 1%', 'last 2 versions', 'Firefox ESR']);

            done();
        });
    });

    describe('updateConfig()', () => {
        var config,
            newSettings,
            originalSettings,
            themeConfig;

        lab.beforeEach(done => {
            themeConfig = ThemeConfig.getInstance();
            config = themeConfig.getConfig();
            originalSettings = Hoek.clone(config.settings);
            newSettings = {
                color: '#000000',
                font: 'Sans Something',
                select: 'second',
                checkbox: true,
                radio: 'first',
            };

            done();
        });

        it('should update the currentConfig with the new changes', done => {
            expect(originalSettings).not.to.equal(newSettings);

            themeConfig.updateConfig(newSettings);

            expect(themeConfig.getConfig().settings).not.to.equal(originalSettings);
            expect(themeConfig.getConfig().settings).to.equal(newSettings);

            done();
        });

        it('should not write to config file if saveToFile is falsey', done => {
            Sinon.stub(Fs, 'writeFileSync');

            themeConfig.updateConfig(newSettings);
            expect(Fs.writeFileSync.called).to.be.false();
            Fs.writeFileSync.restore();

            done();
        });

        it('should write to config file if saveToFile is truthy', done => {
            Sinon.stub(Fs, 'writeFileSync');

            themeConfig.updateConfig(newSettings, true);
            expect(Fs.writeFileSync.called).to.be.true();
            Fs.writeFileSync.restore();

            done();
        });

        it('should just modify the variations section of the file', done => {
            var configPath = Path.join(themePath, 'config.json');
            var initialConfig = JSON.parse(Fs.readFileSync(configPath, {encoding: 'utf-8'}));

            Sinon.stub(Fs, 'writeFileSync').callsFake(testSave);

            function testSave(path, newConfig) {
                newConfig = JSON.parse(newConfig);

                expect(newConfig).not.to.equal(initialConfig);

                delete newConfig.variations;
                delete initialConfig.variations;

                expect(newConfig).to.equal(initialConfig);

                done();
            }

            themeConfig.updateConfig(newSettings, true);

            Fs.writeFileSync.restore();
        });
    });

    describe('getSchema()', () => {

        it('should return the correct schema', done => {

            var themeConfig = ThemeConfig.getInstance();
            var originalSchema = require(Path.join(themePath, 'schema.json'));

            themeConfig.getSchema((err, schema) => {

                expect(err).to.be.null();

                expect(schema).to.be.an.array();

                expect(schema[0]).to.equal(originalSchema[0]);
                expect(schema).to.have.length(2);

                expect(schema[1].settings[0].force_reload).to.true();
                expect(schema[1].settings[1].force_reload).to.true();
                expect(schema[1].settings[2].force_reload).to.true();

                done();
            });
        });

        it('should return an empty schema', done => {

            var themeConfig = ThemeConfig.getInstance(bareBonesThemePath);

            themeConfig.getSchema((err, schema) => {
                expect(schema).to.be.an.array();
                expect(schema).to.have.length(0);

                done();
            });
        });
    });
});
