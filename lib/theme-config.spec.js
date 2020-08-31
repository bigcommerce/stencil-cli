'use strict';

const _ = require('lodash');
const Path = require('path');
const Os = require('os');
const Fs = require('fs');
const { promisify } = require('util');

const ThemeConfig = require('./theme-config');
const themePath = Path.join(process.cwd(), 'test/_mocks/themes/valid');
const missingVariationsThemePath = Path.join(process.cwd(), 'test/_mocks/themes/missing-variation');
const bareBonesThemePath = Path.join(process.cwd(), 'test/_mocks/themes/bare-bones');

describe('ThemeConfig', () => {
    let themeConfig;

    beforeEach(async () => {
        themeConfig = ThemeConfig.getInstance(themePath).setVariationByName('First');
    });

    afterEach(async () => {
        jest.restoreAllMocks();
    });

    describe('getInstance()', () => {
        it ('should always return the same instance', async () => {
            expect(themeConfig).toEqual(ThemeConfig.getInstance());
        });

        it ('should allow overwriting of configPath, schemaPath, and variationName by calling getInstance with params', async () => {
            const isWindows = Os.platform() === 'win32';
            const secondConfigPath = isWindows ? '\\fake\\config.json' : '/fake/config.json';
            const secondSchemaPath = isWindows ? '\\fake\\schema.json' : '/fake/schema.json';
            const secondThemeConfig = ThemeConfig.getInstance('/fake');

            expect(secondThemeConfig.configPath).toEqual(secondConfigPath);
            expect(secondThemeConfig.schemaPath).toEqual(secondSchemaPath);
            expect(secondThemeConfig).toEqual(themeConfig);
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

            expect(config.settings).toEqual(settingsToCompare);
            expect(config.images).toEqual(imagesToCompare);
            expect(ThemeConfig.getInstance().globalSettings).toEqual(originalSettingsToCompare);
        });

        it('should throw an Error if there are no variations in config.json file', async () => {
            const themeConfig = ThemeConfig.getInstance(missingVariationsThemePath);

            expect(themeConfig.getConfig).toThrow(Error);
        });

        it('should grab the first variation if none is passed in', async () => {
            const themeConfig = ThemeConfig.getInstance();

            themeConfig.setVariationByName(null);
            // console.log(themeConfig.getConfig());
            expect(themeConfig.getConfig().variationName).toEqual('First');
        });

        it('should grab a specific variation if passed in', async () => {
            const themeConfig = ThemeConfig.getInstance();

            themeConfig.setVariationByName('Second');
            expect(themeConfig.getConfig().variationName).toEqual('Second');
        });

        it('should throw an Error if the passed in variation name does not match any in the config.json', async () => {
            const themeConfig = ThemeConfig.getInstance(themePath);

            function setVariation() {
                themeConfig.setVariationByName('Does Not Exist');
            }

            expect(setVariation).toThrow(Error);
        });

        it('should set proper default values if they do not exist', async () => {
            const themeConfig = ThemeConfig.getInstance(bareBonesThemePath),
                config = themeConfig.getConfig();

            expect(config.settings).toEqual({});
            expect(config.images).toEqual({});
            expect(config.css_compiler).toEqual('scss');
            expect(config.autoprefixer_cascade).toEqual(true);
            expect(config.autoprefixer_browsers).toEqual(['> 1%', 'last 2 versions', 'Firefox ESR']);
        });
    });

    describe('updateConfig()', () => {
        let config,
            newSettings,
            originalSettings,
            themeConfig;

        beforeEach(async () => {
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
            expect(originalSettings).not.toEqual(newSettings);

            themeConfig.updateConfig(newSettings);

            expect(themeConfig.getConfig().settings).not.toEqual(originalSettings);
            expect(themeConfig.getConfig().settings).toEqual(newSettings);
        });

        it('should not write to config file if saveToFile is falsy', async () => {
            jest.spyOn(Fs, 'writeFileSync').mockImplementation(jest.fn());

            themeConfig.updateConfig(newSettings);

            expect(Fs.writeFileSync.called).toBeFalsy();
        });

        it('should write to config file if saveToFile is truthy', async () => {
            jest.spyOn(Fs, 'writeFileSync').mockImplementation(jest.fn());

            themeConfig.updateConfig(newSettings, true);

            expect(Fs.writeFileSync).toHaveBeenCalled();
        });

        it('should just modify the variations section of the file', async () => {
            const configPath = Path.join(themePath, 'config.json');
            const initialConfig = JSON.parse(Fs.readFileSync(configPath, {encoding: 'utf-8'}));

            const writeFileSyncStub = jest.spyOn(Fs, 'writeFileSync').mockImplementation(jest.fn());

            themeConfig.updateConfig(newSettings, true);

            const newConfig = JSON.parse(writeFileSyncStub.mock.calls[0][1]);

            expect(newConfig).not.toEqual(initialConfig);

            delete newConfig.variations;
            delete initialConfig.variations;

            expect(newConfig).toEqual(initialConfig);
        });
    });

    describe('getSchema()', () => {
        it('should return the correct schema', async () => {
            const themeConfig = ThemeConfig.getInstance();
            const originalSchema = require(Path.join(themePath, 'schema.json'));

            const schema = await promisify(themeConfig.getSchema.bind(themeConfig))();

            expect(schema).toBeInstanceOf(Array);

            expect(schema[0]).toEqual(originalSchema[0]);
            expect(schema).toHaveLength(2);

            expect(schema[1].settings[0].force_reload).toBeTruthy();
            expect(schema[1].settings[1].force_reload).toBeTruthy();
            expect(schema[1].settings[2].force_reload).toBeTruthy();
        });

        it('should return an empty schema', async () => {
            const themeConfig = ThemeConfig.getInstance(bareBonesThemePath);

            const schema = await promisify(themeConfig.getSchema.bind(themeConfig))();

            expect(schema).toBeInstanceOf(Array);
            expect(schema).toHaveLength(0);
        });
    });
});
