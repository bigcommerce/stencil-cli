import fs from 'fs';
import path from 'path';
import Paper from '@bigcommerce/stencil-paper';

class StencilContextAnalyzer {
    constructor(templatesDir) {
        this.templatesDir = templatesDir;
        this.variableUsage = {};
        this.templateExtensions = ['.html'];
        this.paper = new Paper();
    }

    /**
     * Analyzes all templates in the directory and returns variable usage statistics
     * @returns {Promise<Object>} Object with variable paths as keys and usage counts as values
     */
    async analyzeTemplates() {
        const templateFiles = await this.findTemplateFiles();
        console.log(`Found ${templateFiles.length} template files to analyze`);

        if (templateFiles.length === 0) {
            console.warn('No template files found in:', this.templatesDir);
        }

        await Promise.all(templateFiles.map((templateFile) => this.analyzeTemplate(templateFile)));

        console.log(
            `Analysis complete. Found ${Object.keys(this.variableUsage).length} unique variables`,
        );
        return this.variableUsage;
    }

    /**
     * @param {string} templatePath - Path to the template file
     */
    async analyzeTemplate(templatePath) {
        try {
            const content = await fs.promises.readFile(templatePath, 'utf-8');

            // Skip empty files
            if (!content.trim()) {
                return;
            }

            const ast = this.paper.renderer.handlebars.parse(content);
            // Get relative path from templates directory
            const relativePath = path.relative(this.templatesDir, templatePath);
            this.processASTNode(ast, [], relativePath);
        } catch (error) {
            console.warn(`Warning: Could not parse template ${templatePath}: ${error.message}`);
        }
    }

    /**
     * Recursively processes AST nodes to extract variable usage
     * @param {Object|Array} node - AST node or array of nodes
     * @param {Array} contextPath - Current context path for nested variables
     * @param {string} templatePath - Relative path of current template
     */
    processASTNode(node, contextPath = [], templatePath) {
        if (Array.isArray(node)) {
            node.forEach((child) => this.processASTNode(child, contextPath, templatePath));
            return;
        }

        if (!node || typeof node !== 'object') {
            return;
        }

        switch (node.type) {
            case 'Program':
                this.processASTNode(node.body, contextPath, templatePath);
                break;

            case 'MustacheStatement':
            case 'SubExpression':
                this.processExpression(node, contextPath, templatePath);
                break;

            case 'BlockStatement':
                this.processBlockStatement(node, contextPath, templatePath);
                break;

            case 'PartialStatement':
                this.processASTNode(node.params, contextPath, templatePath);
                break;

            case 'ContentStatement':
                // Text content, no variables to extract
                break;

            default:
                // Process any child nodes
                Object.keys(node).forEach((key) => {
                    if (key !== 'type' && key !== 'loc') {
                        this.processASTNode(node[key], contextPath, templatePath);
                    }
                });
        }
    }

    /**
     * Processes expression statements to extract variable paths
     * @param {Object} node - Expression AST node
     * @param {Array} contextPath - Current context path
     * @param {string} templatePath - Relative path of current template
     */
    processExpression(node, contextPath, templatePath) {
        // For regular expressions (not SubExpressions), process the main path only if it's not a helper
        if (node.type === 'MustacheStatement' && node.path) {
            // Only count as variable if it's not a helper and has no parameters
            // If it has parameters, it's likely a helper call
            if (!node.params || node.params.length === 0) {
                const variablePath = this.extractVariablePath(node.path, contextPath);
                if (variablePath) {
                    this.recordVariableUsage(variablePath, templatePath);
                }
            }
        }

        // For SubExpressions, don't process the main path (it's a helper name)
        // but do process the parameters

        // Process parameters (for both regular expressions and SubExpressions)
        if (node.params) {
            node.params.forEach((param) => {
                if (param.type === 'PathExpression') {
                    const variablePath = this.extractVariablePath(param, contextPath);
                    if (variablePath) {
                        this.recordVariableUsage(variablePath, templatePath);
                    }
                } else if (param.type === 'SubExpression') {
                    // Recursively process nested SubExpressions
                    this.processExpression(param, contextPath, templatePath);
                }
            });
        }

        // Process hash parameters
        if (node.hash && node.hash.pairs) {
            node.hash.pairs.forEach((pair) => {
                if (pair.value && pair.value.type === 'PathExpression') {
                    const variablePath = this.extractVariablePath(pair.value, contextPath);
                    if (variablePath) {
                        this.recordVariableUsage(variablePath, templatePath);
                    }
                } else if (pair.value && pair.value.type === 'SubExpression') {
                    // Recursively process SubExpressions in hash values
                    this.processExpression(pair.value, contextPath, templatePath);
                }
            });
        }
    }

    /**
     * Processes block statements (like #each, #if, #with)
     * @param {Object} node - Block statement AST node
     * @param {Array} contextPath - Current context path
     * @param {string} templatePath - Relative path of current template
     */
    processBlockStatement(node, contextPath, templatePath) {
        this.processExpression(node, contextPath, templatePath);

        let newContextPath = [...contextPath];

        if (node.path && node.path.original) {
            const { original: helperName } = node.path;

            if (helperName === 'each' && node.params && node.params[0]) {
                // For #each loops, add array index to context
                const arrayPath = this.extractVariablePath(node.params[0], contextPath);
                if (arrayPath) {
                    newContextPath = [arrayPath + '[0]']; // Represent as array access
                }
            } else if (helperName === 'with' && node.params && node.params[0]) {
                // For #with blocks, change context to the specified object
                const withPath = this.extractVariablePath(node.params[0], contextPath);
                if (withPath) {
                    newContextPath = [withPath];
                }
            }
        }

        // Process the block body with new context
        this.processASTNode(node.program, newContextPath, templatePath);

        // Process the inverse block (else clause) with original context
        if (node.inverse) {
            this.processASTNode(node.inverse, contextPath, templatePath);
        }
    }

    /**
     * Extracts variable path from a PathExpression node
     * @param {Object} pathNode - PathExpression AST node
     * @param {Array} contextPath - Current context path
     * @returns {string|null} Full variable path or null if not a data variable
     */
    extractVariablePath(pathNode, contextPath) {
        if (!pathNode || pathNode.type !== 'PathExpression') {
            return null;
        }

        const { original, parts } = pathNode;

        // Skip Handlebars helpers and built-in variables
        if (this.isHandlebarsHelper(original)) {
            return null;
        }

        if (!parts || parts.length === 0) {
            return null;
        }

        // Build the full path
        let fullPath;
        if (contextPath.length > 0 && !original.startsWith('../')) {
            // Relative to current context
            fullPath = contextPath[contextPath.length - 1] + '.' + parts.join('.');
        } else if (original.startsWith('../')) {
            // Parent context reference - resolve to absolute path to unify with direct access
            const upLevels = (original.match(/\.\.\//g) || []).length;

            // Remove the ../ prefixes from parts to get the actual property path
            const cleanParts = [...parts];
            for (let i = 0; i < upLevels; i += 1) {
                if (cleanParts[0] === '..') {
                    cleanParts.shift();
                }
            }
            const remainingPath = cleanParts.join('.');

            if (contextPath.length > upLevels) {
                // Going back to a specific parent context
                const targetContextIndex = contextPath.length - upLevels - 1;
                const parentContext = contextPath[targetContextIndex];

                // Extract the root path from parent context (e.g., "user.attributes[0]" -> "user")
                const rootPath = this.extractRootFromContext(parentContext);
                fullPath = remainingPath ? `${rootPath}.${remainingPath}` : rootPath;
            } else if (contextPath.length === upLevels) {
                // Going back one level from current context
                const currentContext = contextPath[contextPath.length - 1];
                const parentPath = this.getParentContext(currentContext);

                if (parentPath && remainingPath) {
                    fullPath = `${parentPath}.${remainingPath}`;
                } else if (parentPath) {
                    fullPath = parentPath;
                } else {
                    // No parent context, use remaining path as absolute
                    fullPath = remainingPath;
                }
            } else {
                // Can't resolve, treat as absolute path
                fullPath = remainingPath;
            }
        } else {
            // Absolute path from root context
            fullPath = parts.join('.');
        }

        return fullPath;
    }

    /**
     * Extracts the root path from a context string
     * @param {string} contextPath - Context like "user.attributes[0]" or "products[0].variants[0]"
     * @returns {string} Root path like "user" or "products"
     */
    extractRootFromContext(contextPath) {
        if (!contextPath) return '';

        // Handle array contexts like "products[0]" -> "products"
        const arrayMatch = contextPath.match(/^([^[.]+)/);
        if (arrayMatch) {
            return arrayMatch[1];
        }

        // Handle nested contexts like "user.profile.settings" -> "user"
        const dotIndex = contextPath.indexOf('.');
        if (dotIndex > 0) {
            return contextPath.substring(0, dotIndex);
        }

        // Simple context
        return contextPath;
    }

    /**
     * Gets the parent context from a nested context path
     * @param {string} contextPath - Context like "products[0].variants[0]" or "user.attributes[0]"
     * @returns {string|null} Parent context like "products[0]" or null if going to root
     */
    getParentContext(contextPath) {
        if (!contextPath) return null;

        // For nested contexts like "products[0].variants[0]", remove the last segment
        const lastDotIndex = contextPath.lastIndexOf('.');
        if (lastDotIndex > 0) {
            return contextPath.substring(0, lastDotIndex);
        }

        // For simple array contexts like "user.attributes[0]" or "products[0]",
        // the parent is root context (null), not the array name
        // This represents going back to the context before entering the #each loop
        return null;
    }

    /**
     * Records variable usage in the statistics
     * @param {string} variablePath - Full path of the variable
     * @param {string} templatePath - Relative path of current template
     */
    recordVariableUsage(variablePath, templatePath) {
        if (!this.variableUsage[variablePath]) {
            this.variableUsage[variablePath] = {
                count: 0,
                paths: [],
            };
        }

        this.variableUsage[variablePath].count += 1;

        // Only add path if it's not already in the array
        if (!this.variableUsage[variablePath].paths.includes(templatePath)) {
            this.variableUsage[variablePath].paths.push(templatePath);
        }
    }

    /**
     * Checks if a path is a Handlebars helper by reading from Paper's registered helpers
     * @param {string} pathOriginal - Original path string
     * @returns {boolean} True if it's a helper
     */
    isHandlebarsHelper(pathOriginal) {
        try {
            const registeredHelpers = this.paper.renderer.handlebars.helpers || {};
            return pathOriginal in registeredHelpers;
        } catch (error) {
            // Fallback to basic helpers if Paper fails
            const builtInHelpers = ['if', 'unless', 'each', 'with', 'lookup', 'log'];
            return builtInHelpers.includes(pathOriginal);
        }
    }

    /**
     * Recursively finds all template files in the directory
     * @returns {Promise<string[]>} Array of template file paths
     */
    async findTemplateFiles() {
        const templateFiles = [];

        // Check if templates directory exists
        try {
            await fs.promises.access(this.templatesDir);
        } catch (error) {
            console.warn(`Templates directory not accessible: ${this.templatesDir}`);
            return [];
        }

        const walkDir = async (dir) => {
            try {
                const entries = await fs.promises.readdir(dir, { withFileTypes: true });

                const promises = entries.map(async (entry) => {
                    const fullPath = path.join(dir, entry.name);

                    if (entry.isDirectory()) {
                        return walkDir(fullPath);
                    }
                    if (entry.isFile()) {
                        const ext = path.extname(entry.name);
                        if (this.templateExtensions.includes(ext)) {
                            templateFiles.push(fullPath);
                        }
                    }
                    return null;
                });

                await Promise.all(promises);
            } catch (error) {
                console.warn(`Error reading directory ${dir}: ${error.message}`);
            }
        };

        await walkDir(this.templatesDir);
        return templateFiles;
    }

    /**
     * Exports variable usage statistics to a JSON file
     * @param {string} outputPath - Path to output JSON file
     */
    async exportToJson(outputPath) {
        const sortedUsage = Object.keys(this.variableUsage)
            .sort()
            .reduce(
                (result, key) => ({
                    ...result,
                    [key]: {
                        count: this.variableUsage[key].count,
                        paths: this.variableUsage[key].paths.sort(),
                    },
                }),
                {},
            );

        await fs.promises.writeFile(outputPath, JSON.stringify(sortedUsage, null, 2), 'utf-8');
    }

    /**
     * @param {string} outputPath - Path to output JSON file
     * @returns {Promise<Object>} Variable usage statistics
     */
    async analyzeAndExport(outputPath) {
        const results = await this.analyzeTemplates();
        await this.exportToJson(outputPath);
        return results;
    }
}

export default StencilContextAnalyzer;
