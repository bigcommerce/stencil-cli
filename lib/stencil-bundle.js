'use strict';

require('colors');
const MAX_SIZE_BUNDLE = 1048576 * 50; //50MB
const upath = require('upath');
const Tmp = require('tmp');
const Readdir = require('recursive-readdir');
const Archiver = require('archiver');
const Async = require('async');
const Crypto = require('crypto');
const Fs = require('fs');
const Jspm = require('jspm');
const Path = require('path');
const buildConfig = require('../lib/build-config');
const BundleValidator = require('./bundle-validator');
const Cycles = require('./cycles');
const CssAssembler = require('./css-assembler');
const LangAssembler = require('./lang-assembler');
const TemplateAssembler = require('./template-assembler');
let validator;

function Bundle(themePath, themeConfig, rawConfig, options) {
    const tasks = {};
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
            buildConfig.initWorker().production(() => {
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
    Async.series({
        validate: validateTheme,
        bundle: bundleTaskRunner.bind(this, this.tasks),
    }, (err, result) => {
        let errorMessage = '';

        if (err) {
            errorMessage = err.message ? err.message : String(err);
            console.error('failed  -- '.red + errorMessage.red);
            return callback(err);
        }

        callback(null, result.bundle);
    });
};

Bundle.prototype.getCssAssembleTask = function (compiler) {
    const assembleOptions = {
        bundle: true,
    };
    return callback => {
        const basePath = Path.join(this.themePath, 'assets', compiler);

        console.log('%s Parsing Started...', compiler.toUpperCase());
        Fs.readdir(basePath, (err, files) => {
            const filterFiles = files.filter((file) => {
                return file.substr(-(compiler.length + 1)) === '.' + compiler;
            });
            Async.map(filterFiles, (file, mapCallback) => {
                CssAssembler.assemble(file, basePath, compiler, assembleOptions, mapCallback);
            }, (err, results) => {
                const ret = {};
                if (err) {
                    return callback(err);
                }

                filterFiles.forEach((file, index) => {
                    ret[file] = results[index];
                });

                console.log('ok'.green + ' -- %s Parsing Finished', compiler.toUpperCase());
                callback(null, ret);
            });
        });
    };
};

Bundle.prototype.assembleTemplatesTask = function (callback) {
    console.log('Template Parsing Started...');

    Readdir(this.templatesBasePath, ['!*.html'], (err, files) => {
        const partials = files.map((file) => {
            return upath.toUnix(file.replace(this.templatesBasePath + Path.sep, '').replace(/\.html$/, ''));
        });

        Async.map(partials, TemplateAssembler.assembleAndBundle.bind(null, this.templatesBasePath), (err, results) => {
            const ret = {};

            if (err) {
                return callback(err);
            }

            partials.forEach((file, index) => {
                ret[file] = results[index];
            });

            Async.parallel([
                checkObjects.bind(null, results),
                detectCycles.bind(null, results),
            ], err => {
                if (err) {
                    callback(err);
                }

                console.log('ok'.green + ' -- Template Parsing Finished');
                callback(null, ret);
            });
        });
    });
};

Bundle.prototype.assembleSchema = function (callback) {
    console.log('Building Theme Schema File...');

    this.themeConfig.getSchema((err, schema) => {
        if (err) {
            callback(err);
        }

        console.log('ok'.green + ' -- Theme Schema Building Finished');

        callback(null, schema);
    });
};

Bundle.prototype.assembleLangTask = function (callback) {
    console.log('Language Files Parsing Started...');
    LangAssembler.assemble((err, results) => {
        if (err) {
            return callback(err);
        }

        console.log('ok'.green + ' -- Language Files Parsing Finished');
        callback(null, results);
    });
};

Bundle.prototype.getJspmBundleTask = function (jspmConfig) {
    return callback => {
        const oldConsoleError = console.error;

        console.log('JavaScript Bundling Started...');

        // Need to suppress annoying errors from Babel.
        // They will be gone in the next minor version of JSPM (0.16.0).
        // Until then, this will stay in place
        console.error = error => {
            if (!/Deprecated option metadataUsedHelpers/.test(error)) {
                oldConsoleError(error);
            }
        };

        Jspm.setPackagePath(this.themePath);
        Jspm.bundleSFX(jspmConfig.bootstrap, jspmConfig.tmpBundleFile, {
            minify: true,
            mangle: true,
        }).then(() => {
            console.log('ok'.green + ' -- JavaScript Bundling Finished');
            console.error = oldConsoleError;
            callback(null, true);
        }).catch(err => {
            callback(err);
        });
    }
};

Bundle.prototype.generateManifest = function (callback) {
    const output = {
        createdAt: Date.now(),
    };

    console.log('Generating Manifest Started...');
    Readdir(this.templatesBasePath, ['!*.html'], (err, filePaths) => {
        if (err) {
            return callback(err);
        }

        filePaths = filePaths.map((file) => {
            return upath.toUnix(file.replace(this.templatesBasePath + Path.sep, '').replace('.html', ''));
        });

        output.templates = filePaths;
        this.manifest = output;
        console.log('ok'.green + ' -- Manifest Generation Finished');
        callback()
    });
};

function checkObjects(results, callback) {
    validator.validateObjects(results, err => {
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
    validator.validateTheme(err => {
        if (err) {
            throw err;
        }

        cb(null, true);
    });
}

function bundleTaskRunner(tasks, callback) {
    let defaultName = this.configuration.name + '-' + this.configuration.version + '.zip';

    if (!this.configuration.name) {
        defaultName = 'Custom-0.0.1.zip';
    }

    Async.parallel(tasks, (err, assembledData) => {
        const outputFolder = typeof this.options.dest === 'string' ? this.options.dest : this.themePath;
        const outputName = typeof this.options.name === 'string' ? this.options.name + '.zip' : defaultName;
        const pathsToZip = [
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
            'webpack.conf.js',
        ];
        const archive = Archiver('zip');
        const bundleZipPath = Path.join(outputFolder, outputName);

        if (err) {
            return callback(err);
        }

        let output = Fs.createWriteStream(bundleZipPath);

        output.on('close', () => {
            const stats = Fs.statSync(bundleZipPath);
            const size = stats['size'];

            if (size > MAX_SIZE_BUNDLE) {
                return console.error('Error: Your bundle of size' + size
                    + 'bytes is above the max size of ' + MAX_SIZE_BUNDLE + 'bytes');
            }

            console.log('ok'.green + ' -- Zipping Files Finished');

            callback(null, bundleZipPath);
        });

        archive.pipe(output);

        if (this.configuration.jspm) {
            archive.append(
                Fs.createReadStream(this.configuration.jspm.tmpBundleFile),
                {name: this.configuration.jspm.bundle_location}
            );
        }

        archive.bulk({
            src: pathsToZip,
            cwd: this.themePath,
            expand: true,
        });

        Async.forEachOf(assembledData, (data, type, next) => {

            if (type === 'css' || type === 'templates') {
                // Create the parsed tree files
                Async.forEachOf(data, (val, filename, forEachOfCallback) => {
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

            if (this.manifest.templates) {
                archive.append(JSON.stringify(this.manifest), {name: 'manifest.json'});
            }

            next();

        }, err => {
            if (err) {
                callback(err);
            }

            archive.finalize();
        });
    });
}

module.exports = Bundle;
