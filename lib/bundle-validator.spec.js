const path = require('path');
const { promisify } = require('util');

const ThemeConfig = require('./theme-config');
const BundleValidator = require('./bundle-validator');

const themePath = path.join(process.cwd(), 'test/_mocks/themes/valid');

describe('BundleValidator', () => {
    let themeConfig;

    beforeEach(async () => {
        themeConfig = ThemeConfig.getInstance(themePath);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should not run image validations for private themes', async () => {
        const validator = new BundleValidator(themePath, themeConfig, true);
        const sizeOfSpy = jest.spyOn(validator, 'sizeOf');

        await promisify(validator.validateTheme.bind(validator))();

        expect(sizeOfSpy).not.toHaveBeenCalled();
    });

    it('should run image validations for marketplace themes', async () => {
        const validator = new BundleValidator(themePath, themeConfig, false);
        const sizeOfSpy = jest.spyOn(validator, 'sizeOf');

        await promisify(validator.validateTheme.bind(validator))();

        expect(sizeOfSpy).toHaveBeenCalled();
    });

    it('should validate returned objects exist in templates', async () => {
        const assembledTemplates = [
            {
                page:
                    '---\nfront_matter_options:\n    setting_x:\n        value: {{theme_settings.front_matter_value}}\n---\n<!DOCTYPE html>\n<html>\n<body>\n{{{footer.scripts}}}\n{{#if theme_settings.display_that}}\n    <div>{{> components/index}}</div>\n{{/if}}\n</body>\n</html>\n',
                'components/index': '<h1>This is the index</h1>\n',
            },
            {
                page2:
                    '<!DOCTYPE html>\n<html>\n<body>\n    <h1>{{theme_settings.customizable_title}}</h1>\n{{{head.scripts}}}\n</body>\n</html>\n',
            },
        ];
        const validator = new BundleValidator(themePath, themeConfig, false);

        const result = await promisify(validator.validateObjects.bind(validator))(
            assembledTemplates,
        );

        expect(result).toEqual(true);
    });

    it('should validate returned objects when they have whitespace in the object name', async () => {
        const assembledTemplates = [
            {
                page:
                    '---\nfront_matter_options:\n    setting_x:\n        value: {{theme_settings.front_matter_value}}\n---\n<!DOCTYPE html>\n<html>\n<body>\n{{{footer.scripts}}}\n{{#if theme_settings.display_that}}\n    <div>{{> components/index}}</div>\n{{/if}}\n</body>\n</html>\n',
                'components/index': '<h1>This is the index</h1>\n',
            },
            {
                page2:
                    '<!DOCTYPE html>\n<html>\n<body>\n    <h1>{{theme_settings.customizable_title}}</h1>\n{{{ head.scripts }}}\n</body>\n</html>\n',
            },
        ];
        const validator = new BundleValidator(themePath, themeConfig, false);

        const result = await promisify(validator.validateObjects.bind(validator))(
            assembledTemplates,
        );

        expect(result).toEqual(true);
    });

    it('should not validate returned objects exist in templates', async () => {
        const assembledTemplates = [
            {
                page:
                    '---\nfront_matter_options:\n    setting_x:\n        value: {{theme_settings.front_matter_value}}\n---\n<!DOCTYPE html>\n<html>\n<body>\n{{#if theme_settings.display_that}}\n    <div>{{> components/index}}</div>\n{{/if}}\n</body>\n</html>\n',
                'components/index': '<h1>This is the index</h1>\n',
            },
            {
                page2:
                    '<!DOCTYPE html>\n<html>\n<body>\n    <h1>{{theme_settings.customizable_title}}</h1>\n{{{head.scripts}}}\n</body>\n</html>\n',
            },
        ];
        const validator = new BundleValidator(themePath, themeConfig, false);

        await expect(
            promisify(validator.validateObjects.bind(validator))(assembledTemplates),
        ).rejects.toThrow('Missing required objects/properties: footer.scripts');
    });

    it('should validate theme schema successfully', async () => {
        const validator = new BundleValidator(themePath, themeConfig, false);

        const res = await promisify(validator.validateTheme.bind(validator))();

        expect(res).toHaveLength(4); // 4 validation tasks
        expect(res).not.toContain(false);
    });

    it('should validate theme schema and throw errors', async () => {
        const themePath2 = path.join(process.cwd(), 'test/_mocks/themes/invalid-schema');
        themeConfig = ThemeConfig.getInstance(themePath2);

        const validator = new BundleValidator(themePath2, themeConfig, false);

        await expect(promisify(validator.validateTheme.bind(validator))()).rejects.toThrow(
            "schema[0].settings[0] should have required property 'content'",
        );
    });
});
