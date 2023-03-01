/* eslint-disable no-param-reassign, operator-assignment */
const fs = require('fs');

const BaseFixer = require('./BaseFixer');

class ConditionalImportFixer extends BaseFixer {
    async run() {
        const files = [];
        const scss = fs.readFileSync(this.filePath, 'utf8');
        const condImportFile = await this.processCss(scss, this.transformConditionalImport());

        files.push({ filePath: this.filePath, data: condImportFile.css });
        for await (const message of condImportFile.messages) {
            if (message.type === 'import') {
                const importFile = this.findImportedFile(message.filename, this.filePath);
                const importFileScss = fs.readFileSync(importFile);
                const mixinFile = await this.processCss(
                    importFileScss,
                    this.transformRootToMixin(message),
                );
                files.push({
                    filePath: importFile,
                    data: mixinFile.css,
                });
            }
        }
        return files;
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
                        const oldName = decl.params.replace(/['"]+/g, '');
                        // replace slash with dash
                        decl.params = oldName.replace(/\//g, '-');
                        result.messages.push({
                            type: 'import',
                            filename: oldName,
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
                    params: data.filename.replace(/\//g, '_'),
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
}

module.exports = ConditionalImportFixer;
