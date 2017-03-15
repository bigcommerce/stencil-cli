require('colors');
var MAX_SIZE_BUNDLE = 1048576 * 50; //50MB
var upath = require('upath');
var Tmp = require('tmp');
var _ = require('lodash');
var rr = require('recursive-readdir');
var Archiver = require('archiver');
var Async = require('async');
var Crypto = require('crypto');
var Fs = require('fs');
var Jspm = require('jspm');
var Path = require('path');
var buildConfig = require('../lib/stencil-build-config');
var BundleValidator = require('./bundle-validator');
var Cycles = require('./cycles');
var CssAssembler = require('./css-assembler');
var LangAssembler = require('./lang-assembler');
var TemplateAssembler = require('./template-assembler');
var validator;

function Bundle(themePath, themeConfig, rawConfig, options) {
    var tasks = {};
    this.options = options || {};

    this.templatesBasePath = Path.join(themePath, 'templates');
    this.themePath = themePath;
    this.themeConfig = themeConfig;
    this.configuration = rawConfig;
    this.manifest = {};
    validator = new BundleValidator(this.themePath, this.themeConfig, this.options.marketplace !== true);

    if (this.configuration.css_compiler) {
        tasks.css = this.getCssAssembleTask(this.configuration.css_compiler);
    }

    tasks.templates = this.assembleTemplatesTask.bind(this);
    tasks.lang = this.assembleLangTask.bind(this);
    tasks.schema = this.assembleSchema.bind(this);
    tasks.manifest = this.generateManifest.bind(this);

    if (typeof buildConfig.production === 'function') {
        tasks.theme = callback => {
            console.log('Theme task Started...');
            buildConfig.production(() => {
                console.log('ok'.green + ' -- Theme task Finished');
                callback();
            });
        }
    }

    this.tasks = tasks;

    if (this.configuration.jspm) {
        this.configuration.jspm.tmpBundleFile = Tmp.fileSync().name;
        this.tasks.jspmBundle = this.getJspmBundleTask(this.configuration.jspm);
    }
}

/**
 * Initializes bundling process and executes all required tasks.
 * @param {Function} callback
 */
Bundle.prototype.initBundle = function (callback) {
    var tasks = this.tasks || {};
    Async.series({
        validate: validateTheme,
        bundle: bundleTaskRunner.bind(this, tasks)
    }, (err, result) => {
        var errorMessage = '';

        if (err) {
            errorMessage = err.message ? err.message : String(err);
            console.error('failed  -- '.red + errorMessage.red);
            return callback(err);
        }

        callback(null, result.bundle);
    });
};

Bundle.prototype.getCssAssembleTask = function (compiler) {
    var self = this;
    var assembleOptions = {
        bundle: true
    };
    return function (callback) {
        var basePath = Path.join(self.themePath, 'assets', compiler);

        console.log('%s Parsing Started...', compiler.toUpperCase());
        Fs.readdir(basePath, function (err, files) {
            files = files.filter(function (file) {
                return file.substr(-(compiler.length + 1)) === '.' + compiler;
            });
            Async.map(files, function (file, mapCallback) {
                CssAssembler.assemble(file, basePath, compiler, assembleOptions, mapCallback);
            }, function (err, results) {
                var ret = {};
                if (err) {
                    return callback(err);
                }

                _.each(files, function (file, index) {
                    ret[file] = results[index];
                });

                console.log('ok'.green + ' -- %s Parsing Finished', compiler.toUpperCase());
                callback(null, ret);
            });
        });
    };
};

Bundle.prototype.assembleTemplatesTask = function (callback) {
    var self = this;
    console.log('Template Parsing Started...');

    // https://github.com/bigcommerce-stencil/stencil-cli/pull/1
    rr(self.templatesBasePath, ['!*.html'], function (err, files) {
        files = files.map(function (file) {
            return upath.toUnix(file.replace(self.templatesBasePath + Path.sep, '').replace('.html', ''));
        });

        Async.map(files, TemplateAssembler.assembleAndBundle, function (err, results) {
            var ret = {};

            if (err) {
                return callback(err);
            }

            _.each(files, function (file, index) {
                ret[file] = results[index];
            });

            Async.parallel([
                checkObjects.bind(null, results),
                detectCycles.bind(null, results)

            ], function (err) {
                if (err) {
                    callback(err);
                }

                console.log('ok'.green + ' -- Template Parsing Finished');
                callback(null, ret);
            })
        });
    });
};

Bundle.prototype.assembleSchema = function (callback) {
    console.log('Building Theme Schema File...');

    this.themeConfig.getSchema(function (err, schema) {
        if (err) {
            callback(err);
        }

        console.log('ok'.green + ' -- Theme Schema Building Finished');

        callback(null, schema);
    });
};

Bundle.prototype.assembleLangTask = function (callback) {
    console.log('Language Files Parsing Started...');
    LangAssembler.assemble(function (err, results) {
        if (err) {
            return callback(err);
        }

        console.log('ok'.green + ' -- Language Files Parsing Finished');
        callback(null, results);
    });
};

Bundle.prototype.getJspmBundleTask = function (jspmConfig) {
    var self = this;
    return function (callback) {
        var oldConsoleError = console.error;

        console.log('JavaScript Bundling Started...');

        // Need to suppress annoying errors from Babel.
        // They will be gone in the next minor version of JSPM (0.16.0).
        // Until then, this will stay in place
        console.error = function (error) {
            if (!/Deprecated option metadataUsedHelpers/.test(error)) {
                oldConsoleError(error);
            }
        };

        Jspm.setPackagePath(self.themePath);
        Jspm.bundleSFX(jspmConfig.bootstrap, jspmConfig.tmpBundleFile, {
            minify: true,
            mangle: true
        }).then(function () {
            console.log('ok'.green + ' -- JavaScript Bundling Finished');
            console.error = oldConsoleError;
            callback(null, true);
        }).catch(function (err) {
            callback(err);
        });
    }
};

Bundle.prototype.generateManifest = function (callback) {
    console.log('Generating Manifest Started...');
    var self = this;
    var output = {
        createdAt: Date.now()
    };

    rr(self.templatesBasePath, ['!*.html'], function (err, filePaths) {
        if (err) {
            return callback(err);
        }

        filePaths = filePaths.map(function (file) {
            return upath.toUnix(file.replace(self.templatesBasePath + Path.sep, '').replace('.html', ''));
        });

        output.templates = filePaths;
        self.manifest = output;
        console.log('ok'.green + ' -- Manifest Generation Finished');
        callback()
    });
};

function checkObjects(results, callback) {
    validator.validateObjects(results, function (err) {
        if (err) {
            console.error('error '.red + err.message);
            return callback(err);
        }

        callback();
    });
}

function detectCycles(results, callback) {
    try {
        new Cycles(results).detect();
        callback();
    } catch (err) {
        callback(err)
    }
}

function validateTheme(cb) {
    console.log("Validating theme...");
    validator.validateTheme(function (err) {
        if (err) {
            throw err;
        }

        cb(null, true);
    });
}

function bundleTaskRunner(tasks, callback) {
    var self = this;
    var defaultName = self.configuration.name + '-' + self.configuration.version + '.zip';

    if (!self.configuration.name) {
        defaultName = 'Custom-0.0.1.zip';
    }

    Async.parallel(tasks, function (err, assembledData) {
        var outputFolder = typeof self.options.dest === 'string' ? self.options.dest : self.themePath;
        var outputName = typeof self.options.name === 'string' ? self.options.name + '.zip' : defaultName;
        var output;
        var pathsToZip = [
            'assets/**/*',
            '!assets/cdn/**',
            '!assets/**/*.js.map',
            '!assets/jspm_packages/**', // Don't want jspm_packages if it's there
            'CHANGELOG.md',
            'config.json',
            '.eslintrc',
            '.eslintignore',
            'Gruntfile.js',
            'karma.conf.js',
            'lang/*',
            'meta/**/*',
            'package.json',
            'README.md',
            '.scss-lint.yml',
            'stencil.conf.js',
            'templates/**/*',
            'webpack.conf.js'
        ];
        var archive = Archiver('zip');
        const bundleZipPath = Path.join(outputFolder, outputName);

        if (err) {
            return callback(err);
        }

        output = Fs.createWriteStream(bundleZipPath);

        output.on('close', () => {
            var stats = Fs.statSync(bundleZipPath);
            var size = stats['size'];

            if (size > MAX_SIZE_BUNDLE) {
                return console.error('Error: Your bundle of size' + size
                    + 'bytes is above the max size of ' + MAX_SIZE_BUNDLE + 'bytes');
            }

            console.log('ok'.green + ' -- Zipping Files Finished');

            callback(null, bundleZipPath);
        });

        archive.pipe(output);

        if (self.configuration.jspm) {
            archive.append(
                Fs.createReadStream(self.configuration.jspm.tmpBundleFile),
                {name: self.configuration.jspm.bundle_location}
            );
        }

        archive.bulk({
            src: pathsToZip,
            cwd: self.themePath,
            expand: true
        });

        Async.forEachOf(assembledData, function (data, type, next) {

            if (type === 'css' || type === 'templates') {
                // Create the parsed tree files
                Async.forEachOf(data, function (val, filename, forEachOfCallback) {
                    if (type === 'templates') {
                        filename = Crypto.createHash('md5').update(filename).digest('hex');
                        filename = Path.join('parsed', 'templates', filename + '.json');
                    } else {
                        filename = Path.join('parsed', 'scss', filename + '.json');
                    }
                    archive.append(JSON.stringify(val), {name: filename});
                    forEachOfCallback();
                }, next);

                return;

            } else if (type === 'lang') {
                // append the parsed translation file with all translations
                archive.append(JSON.stringify(data), {name: 'parsed/lang.json'});
            } else if (type === 'schema') {
                // append the generated schema.json file
                archive.append(JSON.stringify(data), {name: 'schema.json'});
            }

            if (self.manifest.templates) {
                archive.append(JSON.stringify(self.manifest), {name: 'manifest.json'});
            }

            next();

        }, function (err) {
            if (err) {
                callback(err);
            }

            archive.finalize();
        });
    });
}

module.exports = Bundle;
