require('colors');

var VALID_IMAGE_TYPES = ['.jpg', '.jpeg', '.png', '.gif'];
var WIDTH_COMPOSED = 600;
var HEIGHT_COMPOSED = 760;
var WIDTH_MOBILE = 304;
var HEIGHT_MOBILE = 540;
var WIDTH_DESKTOP = 2048;
var HEIGHT_DESKTOP = 2600;
var OBJECTS_TO_VALIDATE = [
    'head.scripts',
    'footer.scripts',
];

var _ = require('lodash');
var Async = require('async');
var Eslint = require('eslint').CLIEngine;
var Fs = require('fs');
var sizeOf = require('image-size');
var Path = require('path');
var Validator = require('jsonschema').Validator;

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
        validateJspmSettings.bind(this),
    ];

    if (!this.isPrivate) {
        this.validationTasks.push(validateMetaImages.bind(this));
    }

    if (existsSync(Path.join(this.themePath, '.eslintrc'))) {
        this.validationTasks.push(runLintTask);
    }
}

/**
 * Run all validation tasks in parallel
 * @param callback
 */
BundleValidator.prototype.validateTheme = function (callback) {
    Async.series(this.validationTasks, function (error, result) {
        return callback(error, result);
    })
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
 * Ensure theme configuration exists and passes the json schema file
 * @param callback
 * @returns {*}
 */
function validateThemeConfiguration(callback) {
    var v = new Validator();
    var validationSchema = './themeConfig.schema.json';
    var validation;
    var errorMessage;

    if (!this.themeConfig.configExists()) {
        return callback(
            new Error('You must have a '.red + 'config.json'.cyan + ' file in your top level theme directory.')
        );
    }

    if (!this.isPrivate && !this.themeConfig.schemaExists()) {
        console.log('Warning: Your theme is missing a \'schema.json\' file.'.orange);
    }

    // Validate against the theme registry config schema
    if (this.isPrivate) {
        validationSchema = './privateThemeConfig.schema.json'
    }

    validation = v.validate(this.themeConfig.getRawConfig(), require(validationSchema));

    if (validation.errors && validation.errors.length > 0) {
        errorMessage = 'Your theme\'s config.json has errors:'.red;
        validation.errors.forEach(error => {
            errorMessage += '\r\nconfig'.red + error.stack.substring(8).red;
        });

        return callback(new Error(errorMessage));
    }

    callback(null, true);
}

/**
 * If a theme is using JSPM, make sure they
 * @param callback
 * @returns {*}
 */
function validateJspmSettings(callback) {
    var configuration = this.themeConfig.getRawConfig();
    var errorMessage;

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
    var configuration = this.themeConfig.getConfig();
    var imagePath = Path.resolve(this.themePath, 'meta', configuration.meta.composed_image);
    var imageTasks = [];
    var self = this;

    if (!isValidImageType(imagePath)) {
        return callback(new Error('Invalid file type for "meta.composed_image".'.red
            + '\r\nValid types ('.red + VALID_IMAGE_TYPES.join(', ').red + ')'.red));
    } else if (!Fs.existsSync(imagePath)) {
        return callback(
            new Error('The path you specified for your "meta.composed_image" does not exist.'.red)
        );
    } else {
        (function (path) {
            imageTasks.push(function (cb) {
                validateImage.call(self, path, WIDTH_COMPOSED, HEIGHT_COMPOSED, cb);
            });
        }(imagePath));
    }

    configuration.variations.forEach(function (variation) {
        var id = variation.id.blue;

        imagePath = Path.resolve(this.themePath, 'meta', variation.meta.desktop_screenshot);

        if (!isValidImageType(imagePath)) {
            return callback(new Error('Invalid file type for '.red + id
                + ' variation\'s "desktop_screenshot".'.red
                + '\r\nValid types ('.red + VALID_IMAGE_TYPES.join(', ').red + ')'.red));
        } else if (!Fs.existsSync(imagePath)) {
            return callback(new Error('The path you specified for the '.red + id +
                ' variation\'s "desktop_screenshot" does not exist.'.red));
        } else {
            (function (path) {
                imageTasks.push(function (cb) {
                    validateImage.call(self, path, WIDTH_DESKTOP, HEIGHT_DESKTOP, cb);
                });
            }(imagePath));
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
            (function (path) {
                imageTasks.push(function (cb) {
                    validateImage.call(self, path, WIDTH_MOBILE, HEIGHT_MOBILE, cb);
                });
            }(imagePath));
        }
    }.bind(this));

    Async.parallel(imageTasks, function (err, result) {
        callback(err, result);
    });
}
/**
 * Check if file exist syncronous
 * @param  {string} path
 * @return {boolean}
 */
function fileExists(path) {
    try {
        return !!Fs.statSync(path);
    }
    catch (e) {
        return false;
    }
}

/**
 * Validates that require objects/properties exist in theme
 * @param {array} assembledTemplates
 * @param {function} callback
 */
BundleValidator.prototype.validateObjects = function (assembledTemplates, callback) {
    Async.map(assembledTemplates, function (template, cb) {
        var validated = [];
        Object.keys(template).forEach(function (templateString) {
            var match = OBJECTS_TO_VALIDATE.filter(function (element) {
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
    var ext = Path.extname(imagePath);
    return _.includes(VALID_IMAGE_TYPES, ext);
}

function runLintTask(callback) {
    console.log('Running ESLint...');
    var options = {
        ignorePattern: [
            'assets/js/**/*.spec.js',
            'assets/js/dependency-bundle.js',
        ],
    };

    var cli = new Eslint(options);
    var report = cli.executeOnFiles([Path.join(process.cwd(), 'assets', 'js')]);
    var formatter = cli.getFormatter();

    console.log(formatter(report.results));

    if (report.errorCount !== 0) {
        callback(new Error('Please fix the above Javascript errors.'));
    }

    callback(null, true);
}

function existsSync(file) {
    try {
        Fs.accessSync(file);
        return true;
    } catch (e) {
        return false;
    }
}

function validateImage(path, width, height, cb) {
    var MAX_SIZE_COMPOSED = 1048576 * 2; //2MB
    var MAX_SIZE_MOBILE = 1048576; //1MB
    var MAX_SIZE_DESKTOP = 1048576 * 5; //5MB

    this.sizeOf(path, function (err, dimensions) {
        var failureMessage = '';
        var imageWidth;
        var imageHeight;
        var stats;
        var size;

        if (err) {
            return cb(err);
        }

        imageHeight = dimensions.height;
        imageWidth = dimensions.width;

        stats = Fs.statSync(path);
        size = stats['size'];

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

        if (imageWidth !== width || imageHeight != height) {
            failureMessage += 'Image at (' + path + ') has incorrect dimensions ('
                + imageWidth + 'x' + imageHeight + ') should be' + '(' + width + 'x' + height + ')';
            return cb(new Error(failureMessage));
        }

        cb(null, true);
    });
}

module.exports = BundleValidator;
