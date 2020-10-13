const upath = require('upath');
const Archiver = require('archiver');
const async = require('async');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BuildConfigManager = require('./BuildConfigManager');
const BundleValidator = require('./bundle-validator');
const Cycles = require('./Cycles');
const cssAssembler = require('./css-assembler');
const langAssembler = require('./lang-assembler');
const templateAssembler = require('./template-assembler');
const { recursiveReadDir } = require('./utils/fsUtils');
const { fetchRegions } = require('./regions');

const MEGABYTE = 1024 * 1024;
const MAX_SIZE_BUNDLE = MEGABYTE * 50;
const PATHS_TO_ZIP = [
    {
        pattern: 'assets/**/*',
        ignore: ['assets/cdn/**', 'assets/**/*.js.map'],
    },
    { pattern: 'CHANGELOG.md' },
    { pattern: 'config.json' },
    { pattern: '.eslintrc' },
    { pattern: '.eslintignore' },
    { pattern: 'Gruntfile.js' },
    { pattern: 'karma.conf.js' },
    { pattern: 'lang/*' },
    { pattern: 'meta/**/*' },
    { pattern: 'package.json' },
    { pattern: 'README.md' },
    { pattern: '.scss-lint.yml' },
    { pattern: 'stencil.conf.js' },
    { pattern: 'templates/**/*' },
    { pattern: 'webpack.*.js' },
];

class Bundle {
    constructor(
        themePath,
        themeConfig,
        rawConfig,
        options = {},
        buildConfigManger = new BuildConfigManager(),
    ) {
        const tasks = {};
        this.options = options;

        this.templatesPath = path.join(themePath, 'templates');
        this.themePath = themePath;
        this.themeConfig = themeConfig;
        this.configuration = rawConfig;

        this.validator = new BundleValidator(
            this.themePath,
            this.themeConfig,
            this.options.marketplace !== true,
        );

        if (this.configuration.css_compiler) {
            tasks.css = this.getCssAssembleTask(this.configuration.css_compiler);
        }

        tasks.templates = this.assembleTemplatesTask.bind(this);
        tasks.lang = this.assembleLangTask.bind(this);
        tasks.schema = this.assembleSchema.bind(this);
        tasks.schemaTranslations = this.assembleSchemaTranslations.bind(this);

        if (typeof buildConfigManger.production === 'function') {
            tasks.theme = (callback) => {
                console.log('Theme task Started...');
                buildConfigManger.initWorker().production((err) => {
                    if (err) {
                        return callback(err);
                    }

                    console.log(`${'ok'.green} -- Theme task Finished`);

                    return callback();
                });
            };
        }

        this.tasks = tasks;
    }

    /**
     * Initializes bundling process and executes all required tasks.
     *
     * @returns {Promise<string>} - path of the generated bundle
     */
    async initBundle() {
        try {
            const result = await async.series({
                validate: this._validateTheme.bind(this),
                bundle: this._bundleTaskRunner.bind(this),
            });
            return result.bundle;
        } catch (err) {
            const errorMessage = err.message ? err.message : String(err);
            console.error('failed  -- '.red + errorMessage.red);
            throw err;
        }
    }

    getCssAssembleTask(compiler) {
        const assembleOptions = {
            bundle: true,
        };
        return (callback) => {
            const basePath = path.join(this.themePath, 'assets', compiler);

            console.log('%s Parsing Started...', compiler.toUpperCase());
            fs.readdir(basePath, (err, files) => {
                const filterFiles = files.filter((file) => {
                    return file.substr(-(compiler.length + 1)) === `.${compiler}`;
                });
                async.map(
                    filterFiles,
                    (file, mapCallback) => {
                        cssAssembler.assemble(
                            file,
                            basePath,
                            compiler,
                            assembleOptions,
                            mapCallback,
                        );
                    },
                    (assemblingError, results) => {
                        const ret = {};
                        if (assemblingError) {
                            return callback(assemblingError);
                        }

                        filterFiles.forEach((file, index) => {
                            ret[file] = results[index];
                        });

                        console.log(`${'ok'.green} -- %s Parsing Finished`, compiler.toUpperCase());
                        return callback(null, ret);
                    },
                );
            });
        };
    }

    assembleTemplatesTask(callback) {
        console.log('Template Parsing Started...');

        recursiveReadDir(this.templatesPath, ['!*.html'], (readdirError, files) => {
            if (readdirError) {
                return callback(readdirError);
            }

            const partials = files.map((file) => {
                return upath.toUnix(
                    file.replace(this.templatesPath + path.sep, '').replace(/\.html$/, ''),
                );
            });

            return async.map(
                partials,
                templateAssembler.assembleAndBundle.bind(null, this.templatesPath),
                (err, results) => {
                    const ret = {};

                    if (err) {
                        return callback(err);
                    }

                    partials.forEach((file, index) => {
                        ret[file] = results[index];
                    });

                    return async.parallel(
                        [
                            this._checkObjects.bind(this, results),
                            this._detectCycles.bind(this, results),
                        ],
                        (checkingError) => {
                            if (checkingError) {
                                callback(checkingError);
                            }

                            console.log(`${'ok'.green} -- Template Parsing Finished`);
                            callback(null, ret);
                        },
                    );
                },
            );
        });
    }

    async assembleSchema() {
        console.log('Building Theme Schema File...');

        const schema = await this.themeConfig.getSchema();

        console.log(`${'ok'.green} -- Theme Schema Building Finished`);

        return schema;
    }

    async assembleSchemaTranslations() {
        console.log('Schema Translations Parsing Started...');

        const schema = await this.themeConfig.getSchemaTranslations();

        console.log(`${'ok'.green} -- Schema Translations Parsing Finished`);

        return schema;
    }

    assembleLangTask(callback) {
        console.log('Language Files Parsing Started...');
        langAssembler.assemble((err, results) => {
            if (err) {
                return callback(err);
            }

            console.log(`${'ok'.green} -- Language Files Parsing Finished`);
            return callback(null, results);
        });
    }

    generateManifest(taskResults, callback) {
        console.log('Generating Manifest Started...');

        recursiveReadDir(this.templatesPath, ['!*.html'], (err, filePaths) => {
            if (err) {
                return callback(err);
            }

            const templates = filePaths.map((file) => {
                return upath.toUnix(
                    file.replace(this.templatesPath + path.sep, '').replace('.html', ''),
                );
            });

            const regions = fetchRegions(taskResults.templates, templates);

            console.log(`${'ok'.green} -- Manifest Generation Finished`);
            return callback(null, {
                regions,
                templates,
            });
        });
    }

    /**
     * @private
     * @param {Object[]} results
     * @param {Function} callback
     * @returns {void}
     */
    _checkObjects(results, callback) {
        this.validator.validateObjects(results, (err) => {
            if (err) {
                console.error('error '.red + err.message);
                return callback(err);
            }

            return callback();
        });
    }

    /**
     * @private
     * @param {Object[]} results
     * @param {Function} callback
     * @returns {void}
     */
    _detectCycles(results, callback) {
        try {
            new Cycles(results).detect();
            callback();
        } catch (err) {
            callback(err);
        }
    }

    /**
     * @private
     * @param {Function} callback
     * @returns {void}
     */
    _validateTheme(callback) {
        console.log('Validating theme...');

        this.validator.validateTheme((err) => {
            if (err) {
                throw err;
            }
            callback(null, true);
        });
    }

    /**
     * @private
     * @param {Function} callback
     * @returns {void}
     */
    _bundleTaskRunner(callback) {
        const defaultName = this.configuration.name
            ? `${this.configuration.name}-${this.configuration.version}.zip`
            : 'Theme.zip';
        const outputName =
            typeof this.options.name === 'string' ? `${this.options.name}.zip` : defaultName;
        const outputFolder =
            typeof this.options.dest === 'string' ? this.options.dest : this.themePath;
        const bundleZipPath = path.join(outputFolder, outputName);

        async.parallel(this.tasks, (err, taskResults) => {
            if (err) {
                return callback(err);
            }

            const archive = Archiver('zip');
            const fileStream = fs.createWriteStream(bundleZipPath);
            archive.pipe(fileStream);

            // Create manifest will use taskResults to generate a manifest file
            return this.generateManifest(taskResults, (manifestGenerationError, manifest) => {
                if (manifestGenerationError) {
                    return callback(manifestGenerationError);
                }

                // eslint-disable-next-line no-param-reassign
                taskResults.manifest = manifest;
                // zip theme files
                this._bundleThemeFiles(archive, this.themePath);

                // zip all generated files
                const failedTemplates = this._bundleParsedFiles(archive, taskResults);

                fileStream.on('close', () => {
                    const stats = fs.statSync(bundleZipPath);
                    const { size } = stats;

                    if (failedTemplates.length) {
                        return console.error(
                            `Error: Your bundle failed as templates generated from the files below are greater than or equal to 1 megabyte in size:\n${failedTemplates.join(
                                '\n',
                            )}`,
                        );
                    }

                    if (size > MAX_SIZE_BUNDLE) {
                        return console.error(
                            `Error: Your bundle of size ${size} bytes is above the max size of ${MAX_SIZE_BUNDLE} bytes`,
                        );
                    }

                    console.log(`${'ok'.green} -- Zipping Files Finished`);

                    return callback(null, bundleZipPath);
                });

                // This triggers 'close' event in the file stream. No need to callback()
                return archive.finalize();
            });
        });
    }

    /**
     * Archive theme files
     * @private
     * @param {Archiver} archive
     * @param {string} themePath
     * @returns {void}
     */
    _bundleThemeFiles(archive, themePath) {
        for (const { pattern, ignore } of PATHS_TO_ZIP) {
            archive.glob(pattern, { ignore, cwd: themePath });
        }
    }

    /**
     * @private
     * Archive all generated files (ex. parsed files)
     * @param {Archiver} archive
     * @param {Object} taskResults
     * @returns {Array}
     */
    _bundleParsedFiles(archive, taskResults) {
        const archiveJsonFile = (data, name) => {
            archive.append(JSON.stringify(data, null, 2), { name });
        };
        const failedTemplates = [];

        for (const [task, result] of Object.entries(taskResults)) {
            switch (task) {
                case 'css':
                    // Create the parsed tree files
                    for (const [filename, data] of Object.entries(result)) {
                        archiveJsonFile(data, `parsed/scss/${filename}.json`);
                    }
                    break;

                case 'templates':
                    // Create the parsed tree files
                    for (const [filename, data] of Object.entries(result)) {
                        const hash = crypto.createHash('md5').update(filename).digest('hex');
                        const fileData = data;
                        archiveJsonFile(fileData, `parsed/templates/${hash}.json`);
                        // if file size is greater than 1 megabyte push filename to failedTemplates
                        if (JSON.stringify(fileData).length >= MEGABYTE) {
                            failedTemplates.push(filename);
                        }
                    }
                    break;

                case 'lang':
                    // append the parsed translation file with all translations
                    archiveJsonFile(result, 'parsed/lang.json');
                    break;

                case 'schema':
                    // append the generated schema.json file
                    archiveJsonFile(result, 'schema.json');
                    break;

                case 'schemaTranslations':
                    // append the parsed schemaTranslations.json file
                    archiveJsonFile(result, 'schemaTranslations.json');
                    break;

                case 'manifest':
                    // append the generated manifest.json file
                    archiveJsonFile(result, 'manifest.json');
                    break;

                default:
                    break;
            }
        }
        return failedTemplates;
    }
}

module.exports = Bundle;
