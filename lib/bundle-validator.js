require('colors');
const os = require('os');

const VALID_IMAGE_TYPES = ['.jpg', '.jpeg', '.png', '.gif'];
const WIDTH_COMPOSED = 600;
const HEIGHT_COMPOSED = 760;
const WIDTH_MOBILE = 304;
const HEIGHT_MOBILE = 540;
const WIDTH_DESKTOP = 2048;
const HEIGHT_DESKTOP = 2600;
const OBJECTS_TO_VALIDATE = [
    'head.scripts',
    'footer.scripts',
];

const _ = require('lodash');
const Async = require('async');
const Fs = require('fs');
const sizeOf = require('image-size');
const Path = require('path');
const Validator = require('ajv');
const ValidatorSchemaTranslations = require('./validator/schema-translations');
const JsonSchemaValidatorOptions = {schemaId: 'auto', allErrors: true};

/**
 * Run some validations to ensure that the platform will accept the theme
 * @param themePath
 * @param themeConfig
 * @param isPrivate
 * @constructor
 */
function BundleValidator(themePath, themeConfig, isPrivate) {
    this.isPrivate = isPrivate;
    this.themeConfig = themeConfig;
    this.themePath = themePath;

    // Array of tasks used in Async.series
    this.validationTasks = [
        validateThemeConfiguration.bind(this),
        validateThemeSchema.bind(this),
        validateSchemaTranslations.bind(this),
        validateJspmSettings.bind(this),
    ];

    if (!this.isPrivate) {
        this.validationTasks.push(validateMetaImages.bind(this));
    }
}

/**
 * Run all validation tasks in parallel
 * @param callback
 */
BundleValidator.prototype.validateTheme = function (callback) {
    Async.series(this.validationTasks, function (error, result) {
        return callback(error, result);
    });
};

/**
 * Wrapper to enable testability.
 * @param path
 * @param callback
 */
BundleValidator.prototype.sizeOf = function (path, callback) {
    return sizeOf(path, callback);
};

/**
 * If theme schema exists we need to validate it make sure it passes all defined checks.
 * @param callback
 * @returns {*}
 */
function validateThemeSchema(callback) {
    const validationSchema = './schemas/themeSchema.json';

    if (this.themeConfig.schemaExists()) {
        const error = validateJsonSchema('schema', require(validationSchema), this.themeConfig.getRawSchema());
        if (error) {
            return callback(error);
        }
    }

    callback(null, true);
}

/**
 * Ensure theme configuration exists and passes the json schema file
 * @param callback
 * @returns {*}
 */
function validateThemeConfiguration(callback) {
    let validationSchema = './schemas/themeConfig.json';

    if (!this.themeConfig.configExists()) {
        return callback(
            new Error('You must have a '.red + 'config.json'.cyan + ' file in your top level theme directory.'),
        );
    }

    if (!this.isPrivate && !this.themeConfig.schemaExists()) {
        console.log('Warning: Your theme is missing a \'schema.json\' file.'.orange);
    }

    // Validate against the theme registry config schema
    if (this.isPrivate) {
        validationSchema = './schemas/privateThemeConfig.json';
    }

    const error = validateJsonSchema('config', require(validationSchema), this.themeConfig.getRawConfig());
    if (error) {
        return callback(error);
    }

    callback(null, true);
}

/**
 *
 * @param type
 * @param schema
 * @param data
 * @returns {Error}
 */
function validateJsonSchema(type, schema, data) {
    const validator = new Validator(JsonSchemaValidatorOptions);
    validator.validate(schema, data);
    if (validator.errors && validator.errors.length > 0) {
        let errorMessage;
        errorMessage = `Your theme's ${type}.json has errors:`;
        validator.errors.forEach(error => {
            errorMessage += os.EOL + type + error.dataPath + " " + error.message;
        });
        return new Error(errorMessage.red);
    }
}

/**
 * Ensure that schema translations exists and there are no missing or unused keys.
 * @param {function} callback
 * @return {function} callback
 */
function validateSchemaTranslations(callback) {
    const validatorSchemaTranslations = new ValidatorSchemaTranslations();
    const validator = new Validator(JsonSchemaValidatorOptions);

    if (this.themeConfig.schemaExists()) {
        validatorSchemaTranslations.setSchema(this.themeConfig.getRawSchema());
    }

    if (this.themeConfig.schemaTranslationsExists()) {
        try {
            validatorSchemaTranslations.setTranslations(this.themeConfig.getRawSchemaTranslations());
        } catch (e) {
            throw new Error('Corrupted schemaTranslations.json file'.red);
        }
    } else if (validatorSchemaTranslations.getSchemaKeys().length) {
        return callback(new Error('Missed schemaTranslations.json file'.red));
    }

    const missedKeys = validatorSchemaTranslations.findMissedKeys();
    const unusedKeys = validatorSchemaTranslations.findUnusedKeys();
    validator.validate(
        validatorSchemaTranslations.getValidationSchema(),
        validatorSchemaTranslations.getTranslations(),
    );

    if ((validator.errors && validator.errors.length) || missedKeys.length || unusedKeys.length) {
        let errorMessage = 'Your theme\'s schemaTranslations.json has errors:';

        missedKeys.forEach(key => {
            errorMessage += '\r\nmissing translation key "' + key + '"';
        });

        unusedKeys.forEach(key => {
            errorMessage += '\r\nunused translation key "' + key + '"';
        });

        validator.errors.forEach(error => {
            errorMessage += '\r\nschemaTranslations' + error.message;
        });

        return callback(new Error(errorMessage.red));
    }

    callback(null, true);
}

/**
 * If a theme is using JSPM, make sure they
 * @param callback
 * @returns {*}
 */
function validateJspmSettings(callback) {
    const configuration = this.themeConfig.getRawConfig();
    let errorMessage;

    if (configuration.jspm) {
        if (!fileExists(Path.join(this.themePath, configuration.jspm.jspm_packages_path))) {
            errorMessage = 'The path you specified for your "jspm_packages" folder does not exist.'.red;
            errorMessage += 'Please check your '.red + 'jspm.jspm_packages_path'.cyan +
                ' setting in your theme\'s '.red + 'config.json'.cyan + ' file to make sure it\'s correct.'.red;

            return callback(new Error(errorMessage));
        }
    }

    callback(null, true);
}

/**
 * Validates images for marketplace themes
 * @param callback
 * @returns {*}
 */
function validateMetaImages(callback) {
    const configuration = this.themeConfig.getConfig();
    let imagePath = Path.resolve(this.themePath, 'meta', configuration.meta.composed_image);
    let imageTasks = [];
    var self = this;

    if (!isValidImageType(imagePath)) {
        return callback(new Error('Invalid file type for "meta.composed_image".'.red
            + '\r\nValid types ('.red + VALID_IMAGE_TYPES.join(', ').red + ')'.red));
    } else if (!Fs.existsSync(imagePath)) {
        return callback(
            new Error('The path you specified for your "meta.composed_image" does not exist.'.red),
        );
    } else {
        (function (path) {
            imageTasks.push(function (cb) {
                validateImage.call(self, path, WIDTH_COMPOSED, HEIGHT_COMPOSED, cb);
            });
        }(imagePath));
    }

    configuration.variations.forEach(function (variation) {
        const id = variation.id.blue;

        imagePath = Path.resolve(this.themePath, 'meta', variation.meta.desktop_screenshot);

        if (!isValidImageType(imagePath)) {
            return callback(new Error('Invalid file type for '.red + id
                + ' variation\'s "desktop_screenshot".'.red
                + '\r\nValid types ('.red + VALID_IMAGE_TYPES.join(', ').red + ')'.red));
        } else if (!Fs.existsSync(imagePath)) {
            return callback(new Error('The path you specified for the '.red + id +
                ' variation\'s "desktop_screenshot" does not exist.'.red));
        } else {
            ((path => {
                imageTasks.push(function (cb) {
                    validateImage.call(self, path, WIDTH_DESKTOP, HEIGHT_DESKTOP, cb);
                });
            })(imagePath));
        }

        imagePath = Path.resolve(this.themePath, 'meta', variation.meta.mobile_screenshot);

        if (!isValidImageType(imagePath)) {
            return callback(new Error('Invalid file type for '.red + id
                + ' variation\'s "mobile_screenshot".'.red
                + '\r\nValid types ('.red + VALID_IMAGE_TYPES.join(', ').red + ')'.red));
        } else if (!Fs.existsSync(imagePath)) {
            return callback(new Error('The path you specified for the '.red + id +
                ' variation\'s "mobile_screenshot" does not exist.'.red));
        } else {
            ((path => {
                imageTasks.push(cb => {
                    validateImage.call(self, path, WIDTH_MOBILE, HEIGHT_MOBILE, cb);
                });
            })(imagePath));
        }
    }.bind(this));

    Async.parallel(imageTasks, (err, result) => {
        callback(err, result);
    });
}

/**
 * Check if file exist synchronous
 * @param  {string} path
 * @return {boolean}
 */
function fileExists(path) {
    try {
        return !!Fs.statSync(path);
    } catch (e) {
        return false;
    }
}

/**
 * Validates that require objects/properties exist in theme
 * @param {array} assembledTemplates
 * @param {function} callback
 */
BundleValidator.prototype.validateObjects = (assembledTemplates, callback) => {
    Async.map(assembledTemplates, (template, cb) => {
        let validated = [];
        Object.keys(template).forEach(templateString => {
            const match = OBJECTS_TO_VALIDATE.filter(function (element) {
                return template[templateString].search(new RegExp('\{+\\s*' + element + '\\s*}+')) !== -1;
            });

            Array.prototype.push.apply(validated, match);
        });

        cb(null, validated);

    }, function (err, results) {
        if (err) {
            return callback(err);
        }

        results = _.difference(OBJECTS_TO_VALIDATE, _.uniq(_.flatten(results)));
        if (results.length !== 0) {
            return callback(new Error('Missing required objects/properties: ' + results.join('\n')));
        }

        callback(null, !!results);
    });
};


function isValidImageType(imagePath) {
    const ext = Path.extname(imagePath);
    return _.includes(VALID_IMAGE_TYPES, ext);
}

function validateImage(path, width, height, cb) {
    const MAX_SIZE_COMPOSED = 1048576 * 2; //2MB
    const MAX_SIZE_MOBILE = 1048576; //1MB
    const MAX_SIZE_DESKTOP = 1048576 * 5; //5MB

    this.sizeOf(path, (err, dimensions) => {
        if (err) {
            return cb(err);
        }

        let failureMessage = '';
        const imageHeight = dimensions.height;
        const imageWidth = dimensions.width;
        const stats = Fs.statSync(path);
        const size = stats['size'];

        if (width === WIDTH_DESKTOP && height === HEIGHT_DESKTOP && size > MAX_SIZE_DESKTOP) {
            failureMessage = 'Image of size ' + size + ' bytes at path (' + path + ') '
                + 'is greater than allowed size ' + MAX_SIZE_DESKTOP + '\n';
        } else if (width === WIDTH_COMPOSED && height === HEIGHT_COMPOSED && size > MAX_SIZE_COMPOSED) {
            failureMessage = 'Image of size ' + size + ' bytes at path (' + path + ') '
                + 'is greater than allowed size ' + MAX_SIZE_COMPOSED + '\n';
        } else if (width === WIDTH_MOBILE && height === HEIGHT_MOBILE && size > MAX_SIZE_MOBILE) {
            failureMessage = 'Image of size ' + size + ' bytes at path (' + path + ') '
                + 'is greater than allowed size ' + MAX_SIZE_MOBILE + '\n';
        }

        if (imageWidth !== width || imageHeight !== height) {
            failureMessage += 'Image at (' + path + ') has incorrect dimensions ('
                + imageWidth + 'x' + imageHeight + ') should be' + '(' + width + 'x' + height + ')';
            return cb(new Error(failureMessage));
        }

        cb(null, true);
    });
}

module.exports = BundleValidator;
