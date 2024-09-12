import 'colors';
import os from 'os';
import { isObject, isArray, difference, uniq, flatten, every } from 'lodash-es';
import async from 'async';
import fs from 'fs';
import sizeOf from 'image-size';
import path from 'path';
import Validator from 'ajv';
import yamlValidator from 'js-yaml';
import { recursiveReadDir } from './utils/fsUtils.js';
import { getFrontmatterContent, interpolateThemeSettings } from './utils/frontmatter.js';
import ValidatorSchemaTranslations from './validator/schema-translations.js';
import ScssValidator from './ScssValidator.js';
import LangHelpersValidator from './lang/validator.js';

const VALID_IMAGE_TYPES = ['.jpg', '.jpeg', '.png', '.gif'];
const WIDTH_COMPOSED = 600;
const HEIGHT_COMPOSED = 760;
const WIDTH_MOBILE = 304;
const HEIGHT_MOBILE = 540;
const WIDTH_DESKTOP = 2048;
const HEIGHT_DESKTOP = 2600;
const MAX_SIZE_COMPOSED = 1024 * 1024 * 2; // 2MB
const MAX_SIZE_MOBILE = 1024 * 1024; // 1MB
const MAX_SIZE_DESKTOP = 1024 * 1024 * 5; // 5MB

const privateThemeConfigUrl = new URL('./schemas/privateThemeConfig.json', import.meta.url);
const privateThemeConfigValidationSchema = JSON.parse(fs.readFileSync(privateThemeConfigUrl));

const themeConfigValidationSchemaUrl = new URL('./schemas/themeConfig.json', import.meta.url);
const themeConfigValidationSchema = JSON.parse(fs.readFileSync(themeConfigValidationSchemaUrl));

const themeValidationSchemaUrl = new URL('./schemas/themeSchema.json', import.meta.url);
const themeValidationSchema = JSON.parse(fs.readFileSync(themeValidationSchemaUrl));

class BundleValidator {
    /**
     * Run some validations to ensure that the platform will accept the theme
     * @param themePath
     * @param themeConfig
     * @param isPrivate
     * @constructor
     */
    constructor(themePath, themeConfig, isPrivate) {
        this.isPrivate = isPrivate;
        this.themeConfig = themeConfig;
        this.themePath = themePath;
        this.objectsToValidate = ['head.scripts', 'footer.scripts'];
        this.jsonSchemaValidatorOptions = { schemaId: 'auto', allErrors: true };
        this.scssValidator = new ScssValidator(themePath, themeConfig);
        this.langHelpersValidator = new LangHelpersValidator(themePath, themeConfig);
        // Array of tasks used in async.series
        this.validationTasks = [
            this._validateThemeConfiguration.bind(this),
            this._validateThemeSchema.bind(this),
            this._validateSchemaTranslations.bind(this),
            this._validateTemplatesFrontmatter.bind(this),
            this._validateCssFiles.bind(this),
            this._validateLangFiles.bind(this),
        ];
        if (!this.isPrivate) {
            this.validationTasks.push(this._validateMetaImages.bind(this));
        }
    }

    /**
     * Run all validation tasks in parallel
     * @param callback
     */
    validateTheme(callback) {
        async.series(this.validationTasks, (error, result) => {
            return callback(error, result);
        });
    }

    /**
     * Validates that required objects/properties exist in theme
     * @param {array} assembledTemplates
     * @param {function} callback
     */
    validateObjects(assembledTemplates, callback) {
        async.map(
            assembledTemplates,
            (template, cb) => {
                const validated = [];
                for (const templateString of Object.keys(template)) {
                    const matches = this.objectsToValidate.filter(
                        (element) =>
                            template[templateString].search(
                                new RegExp(`{+\\s*${element}\\s*}+`),
                            ) !== -1,
                    );
                    validated.push(...matches);
                }
                cb(null, validated);
            },
            (err, validationRes) => {
                if (err) {
                    callback(err);
                    return;
                }
                const results = difference(this.objectsToValidate, uniq(flatten(validationRes)));
                if (results.length !== 0) {
                    callback(
                        new Error(`Missing required objects/properties: ${results.join('\n')}`),
                    );
                    return;
                }
                callback(null, !!results);
            },
        );
    }

    /**
     * Wrapper to enable testability.
     * @param imagePath
     * @param callback
     */
    sizeOf(imagePath, callback) {
        return sizeOf(imagePath, callback);
    }

    /**
     * If theme schema exists we need to validate it to make sure it passes all defined checks.
     * @private
     * @returns {boolean}
     */
    async _validateThemeSchema() {
        if (this.themeConfig.schemaExists()) {
            const rawSchema = await this.themeConfig.getRawSchema();
            this._validateJsonSchema('schema', themeValidationSchema, rawSchema);
        }
        return true;
    }

    /**
     * Ensure theme configuration exists and passes the json schema file
     * @private
     * @returns {boolean}
     */
    async _validateThemeConfiguration() {
        if (!this.themeConfig.configExists()) {
            const errMsg =
                'You must have a '.red +
                'config.json'.cyan +
                ' file in your top level theme directory.';
            throw new Error(errMsg);
        }
        if (!this.isPrivate && !this.themeConfig.schemaExists()) {
            console.log("Warning: Your theme is missing a 'schema.json' file.".orange);
        }
        // Validate against the theme registry config schema
        const validationSchema = this.isPrivate
            ? privateThemeConfigValidationSchema
            : themeConfigValidationSchema;
        const rawConfig = await this.themeConfig.getRawConfig();
        return this._validateJsonSchema('config', validationSchema, rawConfig);
    }

    /**
     * @private
     * @param type
     * @param schema
     * @param data
     * @returns {boolean}
     */
    _validateJsonSchema(type, schema, data) {
        const validator = new Validator(this.jsonSchemaValidatorOptions);
        validator.validate(schema, data);
        if (validator.errors && validator.errors.length > 0) {
            let errorMessage = `Your theme's ${type}.json has errors:`;
            for (const error of validator.errors) {
                errorMessage += `${os.EOL + type + error.dataPath} ${error.message}`;
            }
            throw new Error(errorMessage.red);
        }
        return true;
    }

    /**
     * Ensure that schema translations exists and there are no missing or unused keys.
     * @private
     * @returns {boolean}
     */
    async _validateSchemaTranslations() {
        const validatorSchemaTranslations = new ValidatorSchemaTranslations();
        const validator = new Validator(this.jsonSchemaValidatorOptions);
        if (this.themeConfig.schemaExists()) {
            validatorSchemaTranslations.setSchema(await this.themeConfig.getRawSchema());
        }
        if (this.themeConfig.schemaTranslationsExists()) {
            try {
                const rawSchemaTranslations = await this.themeConfig.getRawSchemaTranslations();
                validatorSchemaTranslations.setTranslations(rawSchemaTranslations);
            } catch (e) {
                throw new Error('Corrupted schemaTranslations.json file'.red);
            }
        } else if (validatorSchemaTranslations.getSchemaKeys().length) {
            throw new Error('Missed schemaTranslations.json file'.red);
        }
        const missedKeys = validatorSchemaTranslations.findMissedKeys();
        const unusedKeys = validatorSchemaTranslations.findUnusedKeys();
        validator.validate(
            validatorSchemaTranslations.getValidationSchema(),
            validatorSchemaTranslations.getTranslations(),
        );
        if (
            (validator.errors && validator.errors.length) ||
            missedKeys.length ||
            unusedKeys.length
        ) {
            let errorMessage = "Your theme's schemaTranslations.json has errors:";
            missedKeys.forEach((key) => {
                errorMessage += `\r\nmissing translation key "${key}"`;
            });
            unusedKeys.forEach((key) => {
                errorMessage += `\r\nunused translation key "${key}"`;
            });
            if (validator.errors && validator.errors.length) {
                validator.errors.forEach((error) => {
                    errorMessage += `\r\nschemaTranslations${error.message}`;
                });
            }
            throw new Error(errorMessage.red);
        }
        return true;
    }

    /**
     * Validates images for marketplace themes
     * @private
     * @returns {boolean[]}
     */
    async _validateMetaImages() {
        const { meta, variations } = await this.themeConfig.getConfig();
        const composedImagePath = path.resolve(this.themePath, 'meta', meta.composed_image);
        const imageTasks = [];
        if (!this._isValidImageType(composedImagePath)) {
            throw new Error(
                'Invalid file type for "meta.composed_image".'.red +
                    `\r\nValid types (${VALID_IMAGE_TYPES.join(', ')})`.red,
            );
        }
        if (!fs.existsSync(composedImagePath)) {
            throw new Error(
                'The path you specified for your "meta.composed_image" does not exist.'.red,
            );
        }
        imageTasks.push((cb) =>
            this._validateImage(composedImagePath, WIDTH_COMPOSED, HEIGHT_COMPOSED, cb),
        );
        for (const variation of variations) {
            const id = variation.id.blue;
            const desktopScreenshotPath = path.resolve(
                this.themePath,
                'meta',
                variation.meta.desktop_screenshot,
            );
            if (!this._isValidImageType(desktopScreenshotPath)) {
                throw new Error(
                    `Invalid file type for ${id} variation's "desktop_screenshot".`.red +
                        `\r\nValid types (${VALID_IMAGE_TYPES.join(', ')})`.red,
                );
            }
            if (!fs.existsSync(desktopScreenshotPath)) {
                throw new Error(
                    `The path you specified for the ${id} variation's "desktop_screenshot" does not exist.`.red,
                );
            }
            imageTasks.push((cb) =>
                this._validateImage(desktopScreenshotPath, WIDTH_DESKTOP, HEIGHT_DESKTOP, cb),
            );
            const mobileScreenshotPath = path.resolve(
                this.themePath,
                'meta',
                variation.meta.mobile_screenshot,
            );
            if (!this._isValidImageType(mobileScreenshotPath)) {
                throw new Error(
                    `Invalid file type for ${id} variation's "mobile_screenshot".`.red +
                        `\r\nValid types (${VALID_IMAGE_TYPES.join(', ')})`.red,
                );
            }
            if (!fs.existsSync(mobileScreenshotPath)) {
                throw new Error(
                    `The path you specified for the ${id} variation's "mobile_screenshot" does not exist.`.red,
                );
            }
            imageTasks.push((cb) =>
                this._validateImage(mobileScreenshotPath, WIDTH_MOBILE, HEIGHT_MOBILE, cb),
            );
        }
        return async.parallel(imageTasks);
    }

    /**
     * @private
     * @param imagePath
     * @returns {boolean}
     */
    _isValidImageType(imagePath) {
        const ext = path.extname(imagePath);
        return VALID_IMAGE_TYPES.includes(ext);
    }

    /**
     * @private
     * @param imagePath
     * @param width
     * @param height
     * @param cb
     */
    _validateImage(imagePath, width, height, cb) {
        this.sizeOf(imagePath, (err, dimensions) => {
            if (err) {
                cb(err);
                return;
            }
            let failureMessage = '';
            const imageHeight = dimensions.height;
            const imageWidth = dimensions.width;
            const { size } = fs.statSync(imagePath);
            if (width === WIDTH_DESKTOP && height === HEIGHT_DESKTOP && size > MAX_SIZE_DESKTOP) {
                failureMessage =
                    `Image of size ${size} bytes at path (${imagePath}) ` +
                    `is greater than allowed size ${MAX_SIZE_DESKTOP}\n`;
            } else if (
                width === WIDTH_COMPOSED &&
                height === HEIGHT_COMPOSED &&
                size > MAX_SIZE_COMPOSED
            ) {
                failureMessage =
                    `Image of size ${size} bytes at path (${imagePath}) ` +
                    `is greater than allowed size ${MAX_SIZE_COMPOSED}\n`;
            } else if (
                width === WIDTH_MOBILE &&
                height === HEIGHT_MOBILE &&
                size > MAX_SIZE_MOBILE
            ) {
                failureMessage =
                    `Image of size ${size} bytes at path (${imagePath}) ` +
                    `is greater than allowed size ${MAX_SIZE_MOBILE}\n`;
            }
            if (imageWidth !== width || imageHeight !== height) {
                failureMessage +=
                    `Image at (${imagePath}) has incorrect dimensions (${imageWidth}x${imageHeight}) should be` +
                    `(${width}x${height})`;
                cb(new Error(failureMessage));
                return;
            }
            cb(null, true);
        });
    }

    async _validateTemplatesFrontmatter() {
        const config = await this.themeConfig.getRawConfig();
        const filePaths = await recursiveReadDir(path.join(this.themePath, 'templates'), [
            '!*.html',
        ]);
        for await (const filePath of filePaths) {
            const fileContent = await fs.promises.readFile(filePath, { encoding: 'utf-8' });
            const frontmatter = getFrontmatterContent(fileContent);
            if (frontmatter) {
                const yaml = interpolateThemeSettings(frontmatter, config.settings);
                try {
                    const result = yamlValidator.loadAll(yaml);
                    this.validateTrailingSymbols(result[0]);
                } catch (e) {
                    throw new Error(
                        `Error: ${e.message}, while parsing frontmatter at "${filePath}".`.red,
                    );
                }
            }
        }
        return true;
    }

    async _validateLangFiles() {
        await this.langHelpersValidator.run();
    }

    async _validateCssFiles() {
        await this.scssValidator.run();
    }

    validateTrailingSymbols(data) {
        if (isObject(data)) {
            return every(data, (value) => this.validateTrailingSymbols(value));
        }
        if (isArray(data)) {
            return data.every((row) => this.validateTrailingSymbols(row));
        }
        return data ? this.hasFrontmatterValidValue(data) : true;
    }

    hasFrontmatterValidValue(value) {
        if (this.hasUnallowedTrailingSymbol(value)) {
            throw new Error(`Found unallowed trailing symbol in: "${value}"`);
        }
        return true;
    }

    getUnallowedTrailingSymbols() {
        return [',', ';'];
    }

    hasUnallowedTrailingSymbol(value) {
        const symbols = this.getUnallowedTrailingSymbols();
        const trailingSymbol = value.toString().trim().slice(-1);
        return symbols.includes(trailingSymbol);
    }
}
export default BundleValidator;
