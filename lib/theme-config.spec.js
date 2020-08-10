'use strict';

const Code = require('code');
const _ = require('lodash');
const Lab = require('@hapi/lab');
const Sinon = require('sinon');
const Path = require('path');
const Os = require('os');
const Fs = require('fs');
const { promisify } = require('util');

const ThemeConfig = require('./theme-config');
const themePath = Path.join(process.cwd(), 'test/_mocks/themes/valid');
const missingVariationsThemePath = Path.join(process.cwd(), 'test/_mocks/themes/missing-variation');
const bareBonesThemePath = Path.join(process.cwd(), 'test/_mocks/themes/bare-bones');

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const expect = Code.expect;
const it = lab.it;

describe('ThemeConfig', () => {
    let themeConfig;

    lab.beforeEach(async () => {
        themeConfig = ThemeConfig.getInstance(themePath).setVariationByName('First');
    });

    describe('getInstance()', () => {
        it ('should always return the same instance', async () => {
            expect(themeConfig).to.equal(ThemeConfig.getInstance());
        });

        it ('should allow overwriting of configPath, schemaPath, and variationName by calling getInstance with params', async () => {
            const isWindows = Os.platform() === 'win32';
            const secondConfigPath = isWindows ? '\\fake\\config.json' : '/fake/config.json';
            const secondSchemaPath = isWindows ? '\\fake\\schema.json' : '/fake/schema.json';
            const secondThemeConfig = ThemeConfig.getInstance('/fake');

            expect(secondThemeConfig.configPath).to.equal(secondConfigPath);
            expect(secondThemeConfig.schemaPath).to.equal(secondSchemaPath);
            expect(secondThemeConfig).to.equal(themeConfig);
        });
    });

    describe('getConfig()', () => {
        it('should return the correct config for the current variation', async () => {
            const config = ThemeConfig.getInstance().setVariationByName('Second').getConfig(),
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
        });

        it('should throw an Error if there are no variations in config.json file', async () => {
            const themeConfig = ThemeConfig.getInstance(missingVariationsThemePath);

            expect(themeConfig.getConfig).to.throw(Error);
        });

        it('should grab the first variation if none is passed in', async () => {
            const themeConfig = ThemeConfig.getInstance();

            themeConfig.setVariationByName(null);
            // console.log(themeConfig.getConfig());
            expect(themeConfig.getConfig().variationName).to.equal('First');
        });

        it('should grab a specific variation if passed in', async () => {
            const themeConfig = ThemeConfig.getInstance();

            themeConfig.setVariationByName('Second');
            expect(themeConfig.getConfig().variationName).to.equal('Second');
        });

        it('should throw an Error if the passed in variation name does not match any in the config.json', async () => {
            const themeConfig = ThemeConfig.getInstance(themePath);

            function setVariation() {
                themeConfig.setVariationByName('Does Not Exist');
            }

            expect(setVariation).to.throw(Error);
        });

        it('should set proper default values if they do not exist', async () => {
            const themeConfig = ThemeConfig.getInstance(bareBonesThemePath),
                config = themeConfig.getConfig();

            expect(config.settings).to.equal({});
            expect(config.images).to.equal({});
            expect(config.css_compiler).to.equal('scss');
            expect(config.autoprefixer_cascade).to.equal(true);
            expect(config.autoprefixer_browsers).to.equal(['> 1%', 'last 2 versions', 'Firefox ESR']);
        });
    });

    describe('updateConfig()', () => {
        let config,
            newSettings,
            originalSettings,
            themeConfig;

        lab.beforeEach(async () => {
            themeConfig = ThemeConfig.getInstance();
            config = themeConfig.getConfig();
            originalSettings = _.cloneDeep(config.settings);
            newSettings = {
                color: '#000000',
                font: 'Sans Something',
                select: 'second',
                checkbox: true,
                radio: 'first',
            };
        });

        it('should update the currentConfig with the new changes', async () => {
            expect(originalSettings).not.to.equal(newSettings);

            themeConfig.updateConfig(newSettings);

            expect(themeConfig.getConfig().settings).not.to.equal(originalSettings);
            expect(themeConfig.getConfig().settings).to.equal(newSettings);
        });

        it('should not write to config file if saveToFile is falsey', async () => {
            Sinon.stub(Fs, 'writeFileSync');

            themeConfig.updateConfig(newSettings);
            expect(Fs.writeFileSync.called).to.be.false();
            Fs.writeFileSync.restore();
        });

        it('should write to config file if saveToFile is truthy', async () => {
            Sinon.stub(Fs, 'writeFileSync');

            themeConfig.updateConfig(newSettings, true);
            expect(Fs.writeFileSync.called).to.be.true();
            Fs.writeFileSync.restore();
        });

        it('should just modify the variations section of the file', async () => {
            const configPath = Path.join(themePath, 'config.json');
            const initialConfig = JSON.parse(Fs.readFileSync(configPath, {encoding: 'utf-8'}));

            const testSavePromise = new Promise(resolve =>
                Sinon.stub(Fs, 'writeFileSync').callsFake((...args) => resolve(args)),
            );
            themeConfig.updateConfig(newSettings, true);
            let [, newConfig] = await testSavePromise;

            newConfig = JSON.parse(newConfig);

            expect(newConfig).not.to.equal(initialConfig);

            delete newConfig.variations;
            delete initialConfig.variations;

            expect(newConfig).to.equal(initialConfig);

            Fs.writeFileSync.restore();
        });
    });

    describe('getSchema()', () => {
        it('should return the correct schema', async () => {
            const themeConfig = ThemeConfig.getInstance();
            const originalSchema = require(Path.join(themePath, 'schema.json'));

            const schema = await promisify(themeConfig.getSchema.bind(themeConfig))();

            expect(schema).to.be.an.array();

            expect(schema[0]).to.equal(originalSchema[0]);
            expect(schema).to.have.length(2);

            expect(schema[1].settings[0].force_reload).to.true();
            expect(schema[1].settings[1].force_reload).to.true();
            expect(schema[1].settings[2].force_reload).to.true();
        });

        it('should return an empty schema', async () => {
            const themeConfig = ThemeConfig.getInstance(bareBonesThemePath);

            const schema = await promisify(themeConfig.getSchema.bind(themeConfig))();

            expect(schema).to.be.an.array();
            expect(schema).to.have.length(0);
        });
    });
});
