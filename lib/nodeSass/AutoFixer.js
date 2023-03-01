/* eslint-disable no-param-reassign, operator-assignment */
require('colors');

const fs = require('fs');
const path = require('path');

const ScssValidator = require('../ScssValidator');
const cssCompiler = require('../css/compile');

const BaseRulesFixer = require('./BaseRulesFixer');
const ConditionaImportFixer = require('./ConditionalImportFixer');

const CONDITIONAL_IMPORT = 'conditional-import';
const BASE_LEVEL_RULES = 'base-level-rules';

class AutoFixer {
    /**
     *
     * @param themePath
     * @param themeConfig
     * @param cliOptions
     */
    constructor(themePath, themeConfig, cliOptions) {
        this.themePath = themePath;
        this.themeConfig = themeConfig;
        this.cliOptions = cliOptions;

        this.validator = new ScssValidator(themePath, themeConfig);
    }

    async run() {
        const assetsPath = path.join(this.themePath, 'assets');
        const rawConfig = await this.themeConfig.getConfig();
        const cssFiles = await this.validator.getCssFiles();

        let issuesDetected = false;
        /* eslint-disable-next-line no-useless-catch */
        try {
            for await (const file of cssFiles) {
                try {
                    /* eslint-disable-next-line no-await-in-loop */
                    await cssCompiler.compile(
                        rawConfig,
                        assetsPath,
                        file,
                        cssCompiler.SASS_ENGINE_NAME,
                    );
                } catch (e) {
                    issuesDetected = true;
                    await this.tryToFix(e, file);
                }
            }
            if (!issuesDetected) {
                console.log('No issues deteted');
            }
        } catch (e) {
            throw e;
        }
    }

    async tryToFix(err, file) {
        const problem = this.detectProblem(err);
        if (problem) {
            const dirname = path.join(this.themePath, 'assets/scss');
            let files = [];
            if (problem === CONDITIONAL_IMPORT) {
                const fixer = new ConditionaImportFixer(dirname, err.file);
                files = await fixer.run();
            } else if (problem === BASE_LEVEL_RULES) {
                const baseRulesFixer = new BaseRulesFixer(dirname, err.file);
                files = await baseRulesFixer.run();
            }
            this.parseChangedFiles(files);
        } else {
            const filePath = path.join(this.themePath, 'assets/scss', file + '.scss');
            console.log("Couldn't determine and autofix the problem. Please fix it manually.".red);
            console.log('Found trying compile file:'.red, filePath);
            throw new Error(err);
        }
    }

    detectProblem(err) {
        if (err.formatted) {
            if (
                err.formatted.includes(
                    'Error: Import directives may not be used within control directives or mixins',
                )
            ) {
                return CONDITIONAL_IMPORT;
            }
            if (
                err.formatted.includes(
                    "Base-level rules cannot contain the parent-selector-referencing character '&'",
                )
            ) {
                return BASE_LEVEL_RULES;
            }
        }

        return null;
    }

    parseChangedFiles(files) {
        for (const file of files) {
            this.overrideFile(file.filePath, file.data);
        }
    }

    overrideFile(filePath, data) {
        const phrase = this.cliOptions.dry ? 'Would override' : 'Overriding';
        console.log(phrase.green + ' file:'.green, filePath);
        if (this.cliOptions.dry) {
            console.log('---Content---'.yellow);
            console.log(data);
            console.log('---END of Content---'.yellow);
        } else {
            fs.writeFileSync(filePath, data);
        }
    }
}

module.exports = AutoFixer;
