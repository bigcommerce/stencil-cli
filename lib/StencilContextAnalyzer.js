/* eslint-disable no-plusplus */
import fs from 'fs';
import upath from 'upath';
import Paper from '@bigcommerce/stencil-paper';

class StencilContextAnalyzer {
    constructor(templatesDir) {
        this.templatesDir = templatesDir;
        this.variableUsage = {};
        this.templateExtensions = ['.html'];
        this.paper = new Paper();
        this.templateCache = new Map(); // Cache parsed templates
        this.contextAnalysisCache = new Map(); // Cache context analysis results
        this.processingStack = new Set(); // Track currently processing templates to prevent cycles
        this.maxDepth = 10; // Maximum recursion depth
    }

    /**
     * Analyzes all page templates and tracks context flow to child templates
     * @returns {Promise<Object>} Object with full variable paths as keys and usage counts as values
     */
    async analyzeTemplates() {
        const pageTemplates = await this.findPageTemplates();

        // First pass: analyze page templates
        if (pageTemplates.length > 0) {
            const promises = pageTemplates.map((templateFile) => {
                return this.analyzeTemplateWithContext(templateFile, 'root');
            });
            await Promise.all(promises);
        } else {
            console.warn('No page templates found in:', upath.join(this.templatesDir, 'pages'));
        }

        // Second pass: analyze standalone components/partials that weren't already analyzed
        const allComponents = await this.findAllComponents();
        const componentPromises = allComponents
            .filter((templateFile) => {
                // Check if this component hasn't been analyzed in any context yet
                const hasBeenAnalyzed = Array.from(this.contextAnalysisCache.keys()).some((key) =>
                    key.startsWith(`${templateFile}:`),
                );
                return !hasBeenAnalyzed;
            })
            .map((templateFile) => {
                // Determine appropriate context for the component
                const relativePath = upath.relative(this.templatesDir, templateFile);
                const context = this.isFormComponent(relativePath) ? 'form' : 'component';
                return this.analyzeTemplateWithContext(templateFile, context);
            });
        await Promise.all(componentPromises);

        return this.variableUsage;
    }

    /**
     * Analyzes a template with a given context path (simplified approach)
     * @param {string} templatePath - Path to the template file
     * @param {string} contextPath - Current context path like 'root', 'product', 'products'
     * @param {number} depth - Current recursion depth
     * @param {Map|null} contextMapping - Parameter mapping for partials
     */
    async analyzeTemplateWithContext(templatePath, contextPath, depth = 0, contextMapping = null) {
        // Prevent excessive recursion depth
        if (depth > this.maxDepth) {
            console.warn(
                `Warning: Maximum depth (${this.maxDepth}) reached for template ${templatePath} with context ${contextPath}`,
            );
            return;
        }

        // Create cache key for this template + context combination
        const cacheKey = `${templatePath}:${contextPath}`;
        if (this.contextAnalysisCache.has(cacheKey)) {
            return; // Already analyzed this template in this context
        }

        // Check if we're already processing this template (circular reference)
        if (this.processingStack.has(templatePath)) {
            // console.warn(`Warning: Circular reference detected for template ${templatePath}`);
            return;
        }

        // Mark as being processed to prevent circular references
        this.processingStack.add(templatePath);
        // Mark in cache immediately to prevent race conditions
        this.contextAnalysisCache.set(cacheKey, true);

        try {
            const ast = await this.getOrParseTemplate(templatePath);
            if (!ast) return;

            const relativePath = upath.relative(this.templatesDir, templatePath);

            // Use the passed context, but detect form components for legacy compatibility
            let effectiveContextPath = contextPath;
            if (contextPath === 'root' && this.isFormComponent(relativePath)) {
                // Only override to 'form' context if we're coming from root context
                // This maintains backward compatibility while allowing explicit context setting
                effectiveContextPath = 'form';
            }

            await this.processASTWithContext(
                ast,
                effectiveContextPath,
                relativePath,
                depth,
                contextMapping,
            );
        } catch (error) {
            console.warn(`Warning: Could not analyze template ${templatePath}: ${error.message}`);
        } finally {
            // Remove from processing stack when done
            this.processingStack.delete(templatePath);
        }
    }

    /**
     * Gets cached template AST or parses it
     * @param {string} templatePath - Path to template file
     * @returns {Object|null} Parsed AST or null
     */
    async getOrParseTemplate(templatePath) {
        if (this.templateCache.has(templatePath)) {
            return this.templateCache.get(templatePath);
        }

        try {
            const content = await fs.promises.readFile(templatePath, 'utf-8');
            if (!content.trim()) {
                this.templateCache.set(templatePath, null);
                return null;
            }

            const ast = this.paper.renderer.handlebars.parse(content);
            this.templateCache.set(templatePath, ast);
            return ast;
        } catch (error) {
            console.warn(`Warning: Could not parse template ${templatePath}: ${error.message}`);
            this.templateCache.set(templatePath, null);
            return null;
        }
    }

    /**
     * Processes AST nodes with context tracking (simplified)
     * @param {Object|Array} node - AST node or array of nodes
     * @param {string} contextPath - Current context path
     * @param {string} templatePath - Relative template path
     * @param {number} depth - Current recursion depth
     * @param {Map|null} contextMapping - Parameter mapping for partials
     */
    async processASTWithContext(node, contextPath, templatePath, depth = 0, contextMapping = null) {
        if (Array.isArray(node)) {
            for await (const child of node) {
                await this.processASTWithContext(
                    child,
                    contextPath,
                    templatePath,
                    depth,
                    contextMapping,
                );
            }
            return;
        }

        if (!node || typeof node !== 'object') {
            return;
        }

        switch (node.type) {
            case 'Program':
                await this.processASTWithContext(
                    node.body,
                    contextPath,
                    templatePath,
                    depth,
                    contextMapping,
                );
                break;

            case 'MustacheStatement':
                if (node.path && (!node.params || node.params.length === 0)) {
                    // Simple variable access
                    const fullPath = this.resolveVariablePath(
                        node.path,
                        contextPath,
                        contextMapping,
                    );
                    if (fullPath) {
                        this.recordVariableUsage(fullPath, templatePath);
                    }
                }
                // Process parameters
                if (node.params) {
                    for await (const param of node.params) {
                        await this.processASTWithContext(
                            param,
                            contextPath,
                            templatePath,
                            depth,
                            contextMapping,
                        );
                    }
                }
                // Process hash parameters
                if (node.hash && node.hash.pairs) {
                    for await (const pair of node.hash.pairs) {
                        if (pair.value) {
                            await this.processASTWithContext(
                                pair.value,
                                contextPath,
                                templatePath,
                                depth,
                                contextMapping,
                            );
                        }
                    }
                }
                break;

            case 'PathExpression':
                // eslint-disable-next-line no-case-declarations
                const fullPath = this.resolveVariablePath(node, contextPath, contextMapping);
                if (fullPath) {
                    this.recordVariableUsage(fullPath, templatePath);
                }
                break;

            case 'BlockStatement': {
                // Process the block expression itself
                await this.processASTWithContext(
                    node.path,
                    contextPath,
                    templatePath,
                    depth,
                    contextMapping,
                );
                if (node.params) {
                    for await (const param of node.params) {
                        await this.processASTWithContext(
                            param,
                            contextPath,
                            templatePath,
                            depth,
                            contextMapping,
                        );
                    }
                }

                // Determine new context for block body
                let newContextPath = contextPath;
                if (node.path && node.path.original) {
                    const helperName = node.path.original;
                    if (helperName === 'each' && node.params && node.params[0]) {
                        // Handle both direct paths and helper calls
                        let arrayPath = null;

                        if (node.params[0].type === 'PathExpression') {
                            // Simple case: {{#each products}}
                            arrayPath = this.resolveVariablePath(
                                node.params[0],
                                contextPath,
                                contextMapping,
                            );
                        } else if (node.params[0].type === 'SubExpression') {
                            // Helper case: {{#each (limit products 5)}}
                            arrayPath = this.extractArrayPathFromSubExpression(
                                node.params[0],
                                contextPath,
                                contextMapping,
                            );
                        }

                        if (arrayPath) {
                            // For form components, use simpler context paths
                            if (contextPath === 'form') {
                                newContextPath = 'form';
                            } else {
                                newContextPath = arrayPath;
                            }
                        }
                    } else if (helperName === 'with' && node.params && node.params[0]) {
                        const withPath = this.resolveVariablePath(
                            node.params[0],
                            contextPath,
                            contextMapping,
                        );
                        if (withPath) {
                            newContextPath = withPath;
                        }
                    }
                }

                // Process block body
                if (node.program) {
                    await this.processASTWithContext(
                        node.program,
                        newContextPath,
                        templatePath,
                        depth,
                        contextMapping,
                    );
                }
                // Process else block
                if (node.inverse) {
                    await this.processASTWithContext(
                        node.inverse,
                        contextPath,
                        templatePath,
                        depth,
                        contextMapping,
                    );
                }
                break;
            }

            case 'SubExpression': {
                // Process sub-expression parameters
                if (node.params) {
                    for await (const param of node.params) {
                        await this.processASTWithContext(
                            param,
                            contextPath,
                            templatePath,
                            depth,
                            contextMapping,
                        );
                    }
                }
                // Process hash parameters
                if (node.hash && node.hash.pairs) {
                    for await (const pair of node.hash.pairs) {
                        if (pair.value) {
                            await this.processASTWithContext(
                                pair.value,
                                contextPath,
                                templatePath,
                                depth,
                                contextMapping,
                            );
                        }
                    }
                }
                break;
            }

            case 'PartialStatement': {
                if (node.name && node.name.original) {
                    const partialName = node.name.original;
                    const partialPath = await this.resolvePartialPath(partialName);

                    // Process parameters first, even if partial can't be resolved
                    if (node.hash && node.hash.pairs && node.hash.pairs.length > 0) {
                        const paramPromises = node.hash.pairs.map(async (pair) => {
                            if (pair.value) {
                                // Handle different types of parameter values
                                if (pair.value.type === 'PathExpression') {
                                    // Variable reference: value=product.reviews.text
                                    const paramPath = this.resolveVariablePath(
                                        pair.value,
                                        contextPath,
                                        contextMapping,
                                    );
                                    if (paramPath) {
                                        // Record the parameter usage in the calling template
                                        this.recordVariableUsage(paramPath, templatePath);
                                    }
                                } else if (pair.value.type === 'SubExpression') {
                                    // Helper call: label=(lang 'products.reviews.form_write.comments')
                                    // Process the sub-expression to capture any variable usage
                                    await this.processASTWithContext(
                                        pair.value,
                                        contextPath,
                                        templatePath,
                                        depth,
                                        contextMapping,
                                    );
                                }
                                // Literal values (StringLiteral, BooleanLiteral, NumberLiteral) don't need processing
                            }
                        });

                        await Promise.all(paramPromises);
                    }

                    if (partialPath) {
                        // Determine context for the partial
                        const partialContext = contextPath;
                        let newContextMapping = null;

                        // If partial has explicit parameters (hash), create context mapping
                        if (node.hash && node.hash.pairs && node.hash.pairs.length > 0) {
                            newContextMapping = new Map();

                            // Create mapping from parameter name to actual context path
                            node.hash.pairs.forEach((pair) => {
                                if (pair.value && pair.value.type === 'PathExpression') {
                                    const mappedValue = this.resolveVariablePath(
                                        pair.value,
                                        contextPath,
                                        contextMapping,
                                    );
                                    if (mappedValue) {
                                        newContextMapping.set(pair.key, mappedValue);
                                    }
                                }
                            });
                        }

                        // Recursively analyze the partial component with context mapping
                        await this.analyzeTemplateWithContext(
                            partialPath,
                            partialContext,
                            depth + 1,
                            newContextMapping,
                        );
                    }
                }

                // Process regular parameters (if any)
                if (node.params) {
                    for await (const param of node.params) {
                        await this.processASTWithContext(
                            param,
                            contextPath,
                            templatePath,
                            depth,
                            contextMapping,
                        );
                    }
                }
                break;
            }

            default:
                // Process child nodes
                for await (const key of Object.keys(node)) {
                    if (key !== 'type' && key !== 'loc' && node[key]) {
                        await this.processASTWithContext(
                            node[key],
                            contextPath,
                            templatePath,
                            depth,
                            contextMapping,
                        );
                    }
                }
        }
    }

    /**
     * Resolves a variable path to its full context path (simplified)
     * @param {Object} pathNode - PathExpression AST node
     * @param {string} contextPath - Current context path
     * @param {Map|null} contextMapping - Parameter mapping for partials
     * @returns {string|null} Full variable path or null
     */
    resolveVariablePath(pathNode, contextPath, contextMapping = null) {
        if (!pathNode || pathNode.type !== 'PathExpression') {
            return null;
        }

        const { original, parts } = pathNode;

        // Skip Handlebars helpers
        if (this.isHandlebarsHelper(original)) {
            return null;
        }

        if (!parts || parts.length === 0) {
            return null;
        }

        // Check if this is a mapped parameter in a partial
        if (contextMapping && contextMapping.has(parts[0])) {
            const mappedPath = contextMapping.get(parts[0]);
            if (parts.length === 1) {
                return mappedPath;
            }
            // For nested properties like post.url, combine mapped path with remaining parts
            const remainingParts = parts.slice(1);
            return `${mappedPath}.${remainingParts.join('.')}`;
        }

        // Handle parent context references (../something)
        if (original.startsWith('../')) {
            const upLevels = (original.match(/\.\.\//g) || []).length;
            const cleanParts = [...parts];
            // Remove ../ prefixes
            for (let i = 0; i < upLevels; i++) {
                if (cleanParts[0] === '..') {
                    cleanParts.shift();
                }
            }

            const remainingPath = cleanParts.join('.');

            // Simple parent resolution
            const parentPath = this.getParentContext(contextPath, upLevels);
            if (parentPath === null) {
                return remainingPath || null;
            }

            return remainingPath ? `${parentPath}.${remainingPath}` : parentPath;
        }

        // Build full path
        const fullPath = parts.join('.');

        if (contextPath === 'root') {
            return fullPath;
        }
        return `${contextPath}.${fullPath}`;
    }

    /**
     * Simplified parent context resolution
     * @param {string} contextPath - Current context path
     * @param {number} levels - Levels to go up
     * @returns {string|null} Parent context or null
     */
    getParentContext(contextPath, levels) {
        if (contextPath === 'root') {
            return null;
        }

        let currentPath = contextPath;

        for (let i = 0; i < levels; i++) {
            const lastBracketIndex = currentPath.lastIndexOf('[');
            const lastDotIndex = currentPath.lastIndexOf('.');

            if (lastBracketIndex > lastDotIndex && lastBracketIndex !== -1) {
                // We're in an array context like "some.option.values[0]" (from legacy contexts)
                // Going up one level should remove both the array index AND the array property
                // So from "some.option.values[0]" we want "some.option", not "some.option.values"
                const beforeArray = currentPath.substring(0, lastBracketIndex);
                const lastDotBeforeArray = beforeArray.lastIndexOf('.');

                if (lastDotBeforeArray > 0) {
                    currentPath = beforeArray.substring(0, lastDotBeforeArray);
                } else {
                    // If there's no dot before the array, we go to root
                    return null;
                }
            } else if (lastDotIndex > 0) {
                // Remove property
                currentPath = currentPath.substring(0, lastDotIndex);
            } else {
                return null;
            }
        }
        return currentPath || null;
    }

    /**
     * Records variable usage
     * @param {string} variablePath - Full variable path
     * @param {string} templatePath - Template path
     */
    recordVariableUsage(variablePath, templatePath) {
        if (!this.variableUsage[variablePath]) {
            this.variableUsage[variablePath] = {
                count: 0,
                paths: [],
            };
        }

        this.variableUsage[variablePath].count += 1;

        const normalizedPath = upath.toUnix(templatePath);
        if (!this.variableUsage[variablePath].paths.includes(normalizedPath)) {
            this.variableUsage[variablePath].paths.push(normalizedPath);
        }
    }

    /**
     * Checks if a path is a Handlebars helper
     * @param {string} pathOriginal - Original path string
     * @returns {boolean} True if it's a helper
     */
    isHandlebarsHelper(pathOriginal) {
        try {
            const registeredHelpers = this.paper.renderer.handlebars.helpers || {};
            return pathOriginal in registeredHelpers;
        } catch (error) {
            const builtInHelpers = ['if', 'unless', 'each', 'with', 'lookup', 'log'];
            return builtInHelpers.includes(pathOriginal);
        }
    }

    /**
     * Finds all page templates
     * @returns {Promise<string[]>} Array of page template paths
     */
    async findPageTemplates() {
        const pagesDir = upath.join(this.templatesDir, 'pages');
        const pageTemplates = [];

        try {
            await fs.promises.access(pagesDir);
        } catch (error) {
            console.warn(`Pages directory not accessible: ${pagesDir}`);
            return [];
        }

        const walkDir = async (dir) => {
            try {
                const entries = await fs.promises.readdir(dir, { withFileTypes: true });

                for await (const entry of entries) {
                    const fullPath = upath.join(dir, entry.name);

                    if (entry.isDirectory()) {
                        await walkDir(fullPath);
                    } else if (entry.isFile()) {
                        const ext = upath.extname(entry.name);
                        if (this.templateExtensions.includes(ext)) {
                            pageTemplates.push(fullPath);
                        }
                    }
                }
            } catch (error) {
                console.warn(`Error reading directory ${dir}: ${error.message}`);
            }
        };

        await walkDir(pagesDir);
        return pageTemplates;
    }

    /**
     * Exports variable usage statistics to JSON
     * @param {string} outputPath - Output file path
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
     * Analyzes and exports results
     * @param {string} outputPath - Output file path
     * @returns {Promise<Object>} Analysis results
     */
    async analyzeAndExport(outputPath) {
        const results = await this.analyzeTemplates();
        await this.exportToJson(outputPath);
        return results;
    }

    /**
     * Resolves a partial name to its full file path
     * @param {string} partialName - Name of the partial (e.g., 'components/common/header')
     * @returns {Promise<string|null>} Full path to partial file or null if not found
     */
    async resolvePartialPath(partialName) {
        // Try different possible paths for the partial
        const possiblePaths = [
            upath.join(this.templatesDir, `${partialName}.html`),
            upath.join(this.templatesDir, partialName, 'index.html'),
            upath.join(this.templatesDir, `${partialName}/index.html`),
        ];

        // Check each path sequentially until we find one that exists
        return this.findFirstExistingPath(possiblePaths, partialName);
    }

    /**
     * Helper method to find the first existing path from a list
     * @param {string[]} paths - Array of paths to check
     * @param {string} partialName - Name of the partial for error logging
     * @returns {Promise<string|null>} First existing path or null
     */
    async findFirstExistingPath(paths, partialName) {
        const checkPath = async (index) => {
            if (index >= paths.length) {
                console.warn(`Warning: Could not resolve partial: ${partialName}`);
                return null;
            }

            try {
                await fs.promises.access(paths[index]);
                return paths[index];
            } catch (error) {
                return checkPath(index + 1);
            }
        };

        return checkPath(0);
    }

    /**
     * Extracts the array path from a SubExpression (helper call)
     * @param {Object} subExprNode - SubExpression AST node
     * @param {string} contextPath - Current context path
     * @param {Map|null} contextMapping - Parameter mapping for partials
     * @returns {string|null} Array path or null
     */
    extractArrayPathFromSubExpression(subExprNode, contextPath, contextMapping = null) {
        if (!subExprNode || subExprNode.type !== 'SubExpression') {
            return null;
        }

        // For helpers like (limit products 5), (filter products "active"), etc.
        // we want to extract the first parameter which should be the array
        if (subExprNode.params && subExprNode.params[0]) {
            return this.resolveVariablePath(subExprNode.params[0], contextPath, contextMapping);
        }

        return null;
    }

    /**
     * Checks if a template is a form component
     * @param {string} templatePath - Path to the template file
     * @returns {boolean} True if it's a form component
     */
    isFormComponent(templatePath) {
        // Detect form components based on their path
        const normalizedPath = upath.toUnix(templatePath);
        return (
            normalizedPath.includes('/forms/') ||
            normalizedPath.includes('/options/') ||
            normalizedPath.startsWith('components/common/forms/') ||
            normalizedPath.startsWith('components/products/options/')
        );
    }

    /**
     * Finds all component/partial templates (excluding page templates)
     * @returns {Promise<string[]>} Array of component/partial template paths
     */
    async findAllComponents() {
        const components = [];

        const walkDir = async (dir) => {
            try {
                const entries = await fs.promises.readdir(dir, { withFileTypes: true });

                for await (const entry of entries) {
                    const fullPath = upath.join(dir, entry.name);

                    if (entry.isDirectory()) {
                        await walkDir(fullPath);
                    } else if (entry.isFile()) {
                        const ext = upath.extname(entry.name);
                        if (this.templateExtensions.includes(ext)) {
                            // Exclude page templates since they're analyzed in the first pass
                            const relativePath = upath.relative(this.templatesDir, fullPath);
                            if (!relativePath.startsWith('pages/')) {
                                components.push(fullPath);
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn(`Error reading directory ${dir}: ${error.message}`);
            }
        };

        await walkDir(this.templatesDir);
        return components;
    }
}

export default StencilContextAnalyzer;
