/* eslint-disable no-param-reassign, operator-assignment */
require('colors');

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const postcssScss = require('postcss-scss');

const ScssValidator = require('./ScssValidator');
const cssCompiler = require('./css/compile');

const CONDITIONAL_IMPORT = 'conditional-import';

class NodeSassAutoFixer {
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
            const filePath = this.resolveScssFileName(dirname, err.file);
            if (problem === CONDITIONAL_IMPORT) {
                await this.fixConditionalImport(filePath);
            }
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
        }

        return null;
    }

    async fixConditionalImport(filePath) {
        const scss = fs.readFileSync(filePath, 'utf8');
        const condImportFile = await this.processCss(scss, this.transformConditionalImport());

        this.overrideFile(filePath, condImportFile.css);
        for await (const message of condImportFile.messages) {
            if (message.type === 'import') {
                const importFile = this.findImportedFile(message.filename, filePath);
                const importFileScss = fs.readFileSync(importFile);
                const mixinFile = await this.processCss(
                    importFileScss,
                    this.transformRootToMixin(message),
                );
                this.overrideFile(importFile, mixinFile.css);
            }
        }
    }

    transformConditionalImport() {
        return {
            postcssPlugin: 'Transform Conditional Import',
            AtRule: (rule, { AtRule, result }) => {
                if (rule.name === 'if') {
                    rule.walkAtRules('import', (decl) => {
                        const newRule = new AtRule({
                            name: 'import',
                            params: decl.params,
                            source: decl.source,
                        });
                        const root = decl.root();
                        root.prepend(newRule);
                        decl.name = 'include';
                        decl.params = decl.params.replace(/['"]+/g, '');
                        result.messages.push({
                            type: 'import',
                            filename: decl.params,
                        });
                    });
                }
            },
        };
    }

    transformRootToMixin(data) {
        const self = this;
        return {
            postcssPlugin: 'Transform Root to Mixin',
            Once(root, { AtRule, result }) {
                // already wrapped in mixin
                if (
                    root.nodes.length === 1 &&
                    root.nodes[0].type === 'atrule' &&
                    root.nodes[0].name === 'mixin'
                ) {
                    return;
                }
                const nodes = root.nodes.map((node) => {
                    const cloned = node.clone();
                    cloned.raws.before = '\n';
                    return cloned;
                });
                self.formatNodes(nodes);
                const newRoot = new AtRule({
                    name: 'mixin',
                    params: data.filename,
                    source: root.source,
                    nodes,
                });
                result.root.nodes = [newRoot];
            },
        };
    }

    formatNodes(nodes) {
        const spacer = this.getSpacer(nodes[0]);
        this.addTabsToNodes(nodes, spacer);
    }

    addTabsToNodes(nodes, spacer) {
        nodes.forEach((node) => {
            if (node.nodes) {
                node.raws.before = node.raws.before + spacer;
                node.raws.after = node.raws.after + spacer;
                this.addTabsToNodes(node.nodes, spacer);
            } else {
                if (node.raws.before) {
                    node.raws.before = node.raws.before + spacer;
                }
                if (node.prop === 'src') {
                    node.value = node.value.replace(/\n/g, '\n' + spacer);
                }
            }
        });
    }

    getSpacer(node) {
        const hasTabSpace = this.hasTabSpace(node.raws.before);
        if (hasTabSpace) {
            return '\t';
        }

        return '    ';
    }

    hasTabSpace(string) {
        return /\t/g.test(string);
    }

    async processCss(data, plugin) {
        const processor = postcss([plugin]);
        return processor.process(data, { from: undefined, parser: postcssScss });
    }

    findImportedFile(file, originalFilePath) {
        const originalDirname = path.dirname(originalFilePath);
        return this.resolveScssFileName(originalDirname, file);
    }

    resolveScssFileName(dirname, fileName) {
        if (!fileName.includes('.scss')) {
            fileName += '.scss';
        }
        const filePath = path.join(dirname, fileName);
        if (!fs.existsSync(filePath)) {
            // try with underscore
            const withUnderscoreFileName = this.getFileNameWithUnderscore(fileName);
            const filePathWithUnderscore = path.join(dirname, withUnderscoreFileName);
            if (!fs.existsSync(filePathWithUnderscore)) {
                throw new Error(
                    `Import ${fileName} wasn't resolved in ${filePath} or ${filePathWithUnderscore}`,
                );
            }
            return filePathWithUnderscore;
        }

        return filePath;
    }

    getFileNameWithUnderscore(fileName) {
        const fileNameParts = fileName.split('/');
        const withUnderscoreFileName = fileNameParts
            .map((part, i) => {
                if (i === fileNameParts.length - 1) {
                    return '_' + part;
                }
                return part;
            })
            .join('/');
        return withUnderscoreFileName;
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

module.exports = NodeSassAutoFixer;
