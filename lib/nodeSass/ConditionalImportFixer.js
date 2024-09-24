/* eslint-disable no-param-reassign, operator-assignment */
import fs from 'fs';
import BaseFixer from './BaseFixer.js';

class ConditionalImportFixer extends BaseFixer {
    async run() {
        const files = [];
        const scss = fs.readFileSync(this.filePath, 'utf8');
        const result = await this.processCss(scss, this.transformConditionalImport());
        files.push({ filePath: this.filePath, data: result.css });
        const imports = this.mapFilesToRootFile(result.messages, this.filePath);
        const toUpdateNestedImports = [];
        for await (const fileImport of imports) {
            const importFile = this.findImportedFile(fileImport.file, fileImport.rootFile);
            const importFileScss = fs.readFileSync(importFile, { encoding: 'utf8' });
            const nestedImportFiles = await this.getNesterImportFiles(importFileScss, importFile);
            if (nestedImportFiles) {
                imports.push(...nestedImportFiles);
                // at this moment I don't know if this is an actual mixin
                toUpdateNestedImports.push(...nestedImportFiles);
            } else {
                const mixinFile = await this.processCss(
                    importFileScss,
                    this.transformRootToMixin(fileImport.file),
                );
                files.push({
                    filePath: importFile,
                    data: mixinFile.css,
                });
            }
        }
        if (this.shouldUpdateMixinNameInRootFile(toUpdateNestedImports)) {
            const mixins = this.mapMixinNameToImportFileName(result.mixins);
            // the target file is not updated right away, so the fresh content is in files object
            this.updateRootFileMixinName(files, toUpdateNestedImports, mixins);
        }
        return files;
    }

    shouldUpdateMixinNameInRootFile(toUpdateNestedImports) {
        return toUpdateNestedImports.length > 0;
    }

    updateRootFileMixinName(filesChanged, toUpdateNestedImports, mixins) {
        const rootFileHash = toUpdateNestedImports.reduce((acc, fileImport) => {
            if (!acc[fileImport.rootFile]) {
                acc[fileImport.rootFile] = [];
            }
            acc[fileImport.rootFile].push(fileImport.file);
            return acc;
        }, {});
        Object.keys(rootFileHash).forEach((rootFile) => {
            const rootFileData = filesChanged.find((file) => file.filePath.includes(this.filePath));
            const mixinImport = rootFileHash[rootFile]
                .map((fileImport) => `@include ${fileImport}`)
                .join(';\n    ');
            const mixinName = this.getMixinNameByImportName(mixins, rootFile);
            rootFileData.data = rootFileData.data.replace(
                new RegExp(`@include ${mixinName}`, 'g'),
                mixinImport,
            );
        });
    }

    getMixinNameByImportName(mixins, importName) {
        const found = mixins.find((m) => m.fileName === importName);
        return found.mixinName;
    }

    mapMixinNameToImportFileName(mixins) {
        return mixins.map((mixin) => {
            const fileName = this.findImportedFile(mixin.importName, this.filePath);
            return {
                fileName,
                mixinName: mixin.mixinName,
            };
        });
    }

    transformConditionalImport() {
        return {
            postcssPlugin: 'Transform Conditional Import',
            AtRule: (rule, { AtRule, result }) => {
                if (rule.name === 'if' || rule.name === 'else') {
                    rule.walkAtRules('import', (decl) => {
                        const newRule = new AtRule({
                            name: 'import',
                            params: decl.params,
                            source: decl.source,
                        });
                        const root = decl.root();
                        root.prepend(newRule);
                        decl.name = 'include';
                        // remove quotes from import
                        const oldName = this.prepareImportFileName(decl.params);
                        // replace slash with dash
                        const mixinName = oldName.replace(/\//g, '-');
                        decl.params = mixinName;
                        result.messages.push(oldName);
                        // adding new mixin info
                        if (!result.mixins) {
                            result.mixins = [];
                        }
                        result.mixins.push({
                            importName: oldName,
                            mixinName,
                        });
                    });
                }
            },
        };
    }

    transformRootToMixin(filename) {
        const self = this;
        return {
            postcssPlugin: 'Transform Root to Mixin',
            Once(root, { AtRule, result }) {
                const mixins = [];
                root.walkAtRules('mixin', (decl) => {
                    mixins.push(decl.clone());
                    decl.remove();
                });
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
                    params: filename.replace(/\//g, '_'),
                    source: root.source,
                    nodes,
                });
                if (mixins.length > 0) {
                    newRoot.raws.before = '\n';
                }
                result.root.nodes = [...mixins, newRoot];
            },
        };
    }

    checkForRecursiveImport() {
        const self = this;
        return {
            postcssPlugin: 'Check for Recursive Import',
            Once(root, { result }) {
                const imports = [];
                result.messages = [];
                root.walkAtRules('import', (decl) => {
                    imports.push(self.prepareImportFileName(decl.params));
                });
                if (imports.length > 0) {
                    result.messages = [...imports];
                }
            },
        };
    }

    async getNesterImportFiles(scss, file) {
        const result = await this.processCss(scss, this.checkForRecursiveImport());
        if (result.messages.length > 0) {
            return this.mapFilesToRootFile(result.messages, file);
        }
        return null;
    }

    mapFilesToRootFile(files, rootFile) {
        return files.map((file) => ({
            file,
            rootFile,
        }));
    }

    formatNodes(nodes) {
        if (nodes.length > 0) {
            const spacer = this.getSpacer(nodes[0]);
            this.addTabsToNodes(nodes, spacer);
        }
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

    prepareImportFileName(fileName) {
        return fileName.replace(/['"]+/g, '');
    }
}
export default ConditionalImportFixer;
