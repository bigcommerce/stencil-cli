'use strict';

const MAX_SIZE_BUNDLE = 1048576 * 50; //50MB
const PATHS_TO_ZIP = [
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
    'webpack.*.js',
];

const Upath = require('upath');
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
const Regions = require('./regions');

function Bundle(themePath, themeConfig, rawConfig, options) {
    const tasks = {};
    this.options = options || {};

    this.templatesPath = Path.join(themePath, 'templates');
    this.themePath = themePath;
    this.themeConfig = themeConfig;
    this.configuration = rawConfig;

    this.validator = new BundleValidator(this.themePath, this.themeConfig, this.options.marketplace !== true);

    if (this.configuration.css_compiler) {
        tasks.css = this.getCssAssembleTask(this.configuration.css_compiler);
    }

    tasks.templates = this.assembleTemplatesTask.bind(this);
    tasks.lang = this.assembleLangTask.bind(this);
    tasks.schema = this.assembleSchema.bind(this);

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
        validate: validateTheme.bind(this),
        bundle: bundleTaskRunner.bind(this),
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

    Readdir(this.templatesPath, ['!*.html'], (err, files) => {
        if (err) {
            return callback(err);
        }

        const partials = files.map((file) => {
            return Upath.toUnix(file.replace(this.templatesPath + Path.sep, '').replace(/\.html$/, ''));
        });

        Async.map(partials, TemplateAssembler.assembleAndBundle.bind(null, this.templatesPath), (err, results) => {
            const ret = {};

            if (err) {
                return callback(err);
            }

            partials.forEach((file, index) => {
                ret[file] = results[index];
            });

            Async.parallel([
                checkObjects.bind(this, results),
                detectCycles.bind(this, results),
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

Bundle.prototype.generateManifest = function (taskResults, callback) {
    console.log('Generating Manifest Started...');

    Readdir(this.templatesPath, ['!*.html'], (err, filePaths) => {
        if (err) {
            return callback(err);
        }

        const templates = filePaths.map(file => {
            return Upath.toUnix(file.replace(this.templatesPath + Path.sep, '').replace('.html', ''));
        });

        const regions = Regions.fetchRegions(taskResults.templates, templates);

        console.log('ok'.green + ' -- Manifest Generation Finished');
        return callback(null, {
            regions,
            templates,
        });
    });
};

function checkObjects(results, callback) {
    this.validator.validateObjects(results, err => {
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

function validateTheme(callback) {
    console.log("Validating theme...");
    this.validator.validateTheme(err => {
        if (err) {
            throw err;
        }

        callback(null, true);
    });
}

function bundleTaskRunner(callback) {
    let defaultName = this.configuration.name + '-' + this.configuration.version + '.zip';
    const outputName = typeof this.options.name === 'string' ? this.options.name + '.zip' : defaultName;
    const outputFolder = typeof this.options.dest === 'string' ? this.options.dest : this.themePath;
    const bundleZipPath = Path.join(outputFolder, outputName);

    if (!this.configuration.name) {
        defaultName = 'Theme.zip';
    }


    Async.parallel(this.tasks, (err, taskResults) => {
        if (err) {
            return callback(err);
        }

        const archive = Archiver('zip');
        const fileStream = Fs.createWriteStream(bundleZipPath);
        archive.pipe(fileStream);

        // Create manifest will use taskResults to generate a manifest file
        this.generateManifest(taskResults, (err, manifest) => {
            if (err) {
                return callback(err);
            }

            taskResults.manifest = manifest;
            // zip theme files
            bundleThemeFiles(archive, this.themePath, this.configuration);

            // zip all generated files
            bundleParsedFiles(archive, taskResults);

            fileStream.on('close', () => {
                const stats = Fs.statSync(bundleZipPath);
                const size = stats['size'];

                if (size > MAX_SIZE_BUNDLE) {
                    return console.error(`Error: Your bundle of size ${size} bytes is above the max size of ${MAX_SIZE_BUNDLE} bytes`);
                }

                console.log('ok'.green + ' -- Zipping Files Finished');

                return callback(null, bundleZipPath);
            });

            // This triggers 'close' event in the file stream. No need to callback()
            archive.finalize();
        });
    });
}

/**
 * Archive theme files
 * @param {Archive} archive
 * @param {String} themePath
 * @param {Object} configuration
 */
function bundleThemeFiles(archive, themePath, configuration) {
    if (configuration.jspm) {
        archive.append(
            Fs.createReadStream(configuration.jspm.tmpBundleFile),
            { name: configuration.jspm.bundle_location }
        );
    }

    archive.bulk({
        src: PATHS_TO_ZIP,
        cwd: themePath,
        expand: true,
    });
}

/**
 * Archive all generated files (ex. parsed files)
 * @param {Archive} archive
 * @param {Object} taskResults
 */
function bundleParsedFiles(archive, taskResults) {
    const archiveJsonFile = (data, name) => {
        archive.append(JSON.stringify(data), { name });
    }

    for (let task in taskResults) {
        let data = taskResults[task];
        switch(task) {
        case 'css':
            // Create the parsed tree files
            for (let filename in data) {
                archiveJsonFile(data[filename], `parsed/scss/${filename}.json`);
            }
            break;

        case 'templates':
            // Create the parsed tree files
            for (let filename in data) {
                let hash = Crypto.createHash('md5').update(filename).digest('hex');
                archiveJsonFile(data[filename], `parsed/templates/${hash}.json`);
            }
            break;

        case 'lang':
            // append the parsed translation file with all translations
            archiveJsonFile(data, 'parsed/lang.json');
            break;

        case 'schema':
            // append the generated schema.json file
            archiveJsonFile(data, 'schema.json');
            break;

        case 'manifest':
            // append the generated manifest.json file
            archiveJsonFile(data, 'manifest.json');
            break;
        }
    }
}

module.exports = Bundle;
