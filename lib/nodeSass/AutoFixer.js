import 'colors';
import fs from 'fs';
import path from 'path';
import ScssValidator from '../ScssValidator.js';
import cssCompiler from '../css/compile.js';
import BaseRulesFixer from './BaseRulesFixer.js';
import ConditionaImportFixer from './ConditionalImportFixer.js';
import CommaRemovalFixer from './CommaRemovalFixer.js';
import UndefinedVariableFixer from './UndefinedVariableFixer.js';

const CONDITIONAL_IMPORT = 'conditional-import';
const BASE_LEVEL_RULES = 'base-level-rules';
const POSSIBLE_WRONG_COMMA = 'possible-wrong-comma';
const UNDEFINED_VARIABLE = 'undefined-variable';
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
                console.log('No issues detected');
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
            } else if (problem === POSSIBLE_WRONG_COMMA) {
                const toFixFile = err.file === 'stdin' ? file : err.file;
                const commaRemovalFixer = new CommaRemovalFixer(dirname, toFixFile);
                files = await commaRemovalFixer.run();
            } else if (problem === UNDEFINED_VARIABLE) {
                const toFixFile = err.file === 'stdin' ? file : err.file;
                const fixer = new UndefinedVariableFixer(dirname, toFixFile);
                files = await fixer.run(err.message);
            }
            this.parseChangedFiles(files);
        } else {
            const filePath = path.join(this.themePath, 'assets/scss', file + '.scss');
            console.log("Couldn't determine and autofix the problem. Please fix it manually.".red);
            console.log('Found trying to compile file:'.red, filePath);
            throw new Error(err.formatted ? err.formatted : err);
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
            if (
                err.formatted.includes('Invalid CSS after') &&
                err.formatted.includes('expected selector, was ",')
            ) {
                return POSSIBLE_WRONG_COMMA;
            }
            if (err.formatted.includes('Undefined variable')) {
                return UNDEFINED_VARIABLE;
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
            console.log('----Content----'.yellow);
            console.log(data);
            console.log('----END of Content----'.yellow);
        } else {
            fs.writeFileSync(filePath, data);
        }
    }
}
export default AutoFixer;
