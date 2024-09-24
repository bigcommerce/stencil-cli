import upath from 'upath';
import Archiver from 'archiver';
import async from 'async';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import StencilStyles from '@bigcommerce/stencil-styles';
import BuildConfigManager from './BuildConfigManager.js';
import BundleValidator from './bundle-validator.js';
import Cycles from './Cycles.js';
import langAssembler from './lang-assembler.js';
import templateAssembler from './template-assembler.js';
import { recursiveReadDir } from './utils/fsUtils.js';
import { fetchRegions } from './regions.js';

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

const stencilStyles = new StencilStyles();

class Bundle {
    constructor(
        themePath,
        themeConfig,
        rawConfig,
        options = {},
        buildConfigManager = new BuildConfigManager(),
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
        if (typeof buildConfigManager.production === 'function') {
            tasks.theme = (callback) => {
                console.log('Theme task Started...');
                buildConfigManager.initWorker().production((err) => {
                    if (err) {
                        return callback(err);
                    }
                    console.log(`${'ok'.green} -- Theme task Finished`);
                    return callback();
                });
            };
        }
        this.tasks = tasks;
        this._getExternalLibs = this._getExternalLibs.bind(this);
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
            let basePath;
            if (compiler === 'css') {
                basePath = path.join(this.themePath, 'assets/dist', compiler);
            } else {
                basePath = path.join(this.themePath, 'assets', compiler);
            }
            console.log('%s Parsing Started...', compiler.toUpperCase());
            fs.readdir(basePath, (err, files) => {
                const filterFiles = files.filter((file) => {
                    return file.substr(-(compiler.length + 1)) === `.${compiler}`;
                });
                async.map(
                    filterFiles,
                    async (file) => {
                        return stencilStyles.assembleCssFiles(
                            file,
                            basePath,
                            compiler,
                            assembleOptions,
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

    /**
     * helps to find any node modules dependencies with
     * ui templates and returns its list
     *
     * @private
     * @param {string} content
     * @returns {Array}
     */
    async _getExternalLibs(templatePath) {
        const content = await fs.promises.readFile(templatePath, { encoding: 'utf-8' });
        const externalPathRegex = /{{2}>\s*(['"]external)[^{]*?}{2}/g;
        const externalTemplatesImports = content.match(externalPathRegex);
        if (!externalTemplatesImports) return [];
        return externalTemplatesImports.map((templateImport) => {
            const [, importPath] = templateAssembler.partialRegex.exec(templateImport);
            templateAssembler.partialRegex.lastIndex = 0;
            return importPath
                .split('/templates/')[0]
                .slice(templateAssembler.packageMarker.length + 1);
        });
    }

    async assembleTemplatesTask(callback) {
        console.log('Template Parsing Started...');
        const internalTemplatesList = await recursiveReadDir(this.templatesPath, ['!*.html']);
        let externalLibs;
        try {
            const removeDuplicates = (arr) => Array.from(new Set(arr.flat()));
            const temp = internalTemplatesList.map(this._getExternalLibs);
            const result = await Promise.all(temp);
            externalLibs = removeDuplicates(result);
        } catch (error) {
            callback(error);
        }
        let externalLibPaths = [];
        if (externalLibs.length) {
            externalLibPaths = externalLibs.map((lib) =>
                recursiveReadDir(path.join(this.themePath, 'node_modules', lib, 'templates'), [
                    '!*.html',
                ]),
            );
        }
        // eslint-disable-next-line node/no-unsupported-features/es-builtins
        const res = await Promise.allSettled([
            recursiveReadDir(this.templatesPath, ['!*.html']),
            ...externalLibPaths,
        ]);
        const [{ value: internalTemplates }, ...externalTemplatesList] = res;
        const internalPartials = internalTemplates.map((file) => {
            return upath.toUnix(
                file.replace(this.templatesPath + path.sep, '').replace(/\.html$/, ''),
            );
        });
        const externalPartials = externalTemplatesList.reduce(
            (partials, { value: externalTemplates }) => {
                const extractedPartials = externalTemplates.map((file) => {
                    return upath.toUnix(
                        'external' + file.split('node_modules')[1].replace(/\.html$/, ''),
                    );
                });
                partials.push(...extractedPartials);
                return partials;
            },
            [],
        );
        const allPartials = [...externalPartials, ...internalPartials];
        let results;
        try {
            results = await async.map(
                allPartials,
                templateAssembler.assembleAndBundle.bind(null, this.templatesPath),
            );
            const ret = {};
            allPartials.forEach((file, index) => {
                ret[file] = results[index];
            });
            await Promise.all([
                this._checkObjects.bind(this, results),
                this._detectCycles.bind(this, results),
            ]);
            console.log(`${'ok'.green} -- Template Parsing Finished`);
            return ret;
        } catch (err) {
            return callback(err);
        }
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
        this.tasks.templates = this.assembleTemplatesTask.bind(this, callback);
        async
            .parallel(this.tasks)
            .then((taskResults) => {
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
            })
            .catch((err) => {
                console.log(err);
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
                        const ext =
                            this.configuration.css_compiler === 'css'
                                ? this.configuration.css_compiler
                                : 'scss';
                        archiveJsonFile(data, `parsed/${ext}/${filename}.json`);
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
export default Bundle;
