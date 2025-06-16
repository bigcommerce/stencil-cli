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
    }

    /**
     * Analyzes all page templates and tracks context flow to child templates
     * @returns {Promise<Object>} Object with full variable paths as keys and usage counts as values
     */
    async analyzeTemplates() {
        const pageTemplates = await this.findPageTemplates();

        if (pageTemplates.length === 0) {
            console.warn('No page templates found in:', upath.join(this.templatesDir, 'pages'));
        }

        console.log(`📄 Found ${pageTemplates.length} page templates to analyze`);

        // First pass: Analyze page templates with full context tracking
        for (const templateFile of pageTemplates) {
            const relativePath = upath.relative(this.templatesDir, templateFile);
            console.log(`🔍 Analyzing: ${relativePath}`);
            await this.analyzeTemplateWithContext(templateFile, 'root');
        }

        console.log(`📝 First pass complete. Found ${Object.keys(this.variableUsage).length} variable paths.`);
        
        // Second pass: Analyze form and option components directly to capture standalone variables
        console.log(`🔍 Second pass: Analyzing form components for standalone variables...`);
        await this.analyzeFormComponents();

        console.log(`✅ Analysis complete. Found ${Object.keys(this.variableUsage).length} unique variable paths.`);
        return this.variableUsage;
    }

    /**
     * Analyzes a template with a given context path (simplified approach)
     * @param {string} templatePath - Path to the template file
     * @param {string} contextPath - Current context path like 'root', 'product', 'products[0]'
     */
    async analyzeTemplateWithContext(templatePath, contextPath) {
        // Create cache key for this template + context combination
        const cacheKey = `${templatePath}:${contextPath}`;
        if (this.contextAnalysisCache.has(cacheKey)) {
            return; // Already analyzed this template in this context
        }

        // Mark as being processed
        this.contextAnalysisCache.set(cacheKey, true);

        try {
            const ast = await this.getOrParseTemplate(templatePath);
            if (!ast) return;

            const relativePath = upath.relative(this.templatesDir, templatePath);
            await this.processASTWithContext(ast, contextPath, relativePath);
        } catch (error) {
            console.warn(`Warning: Could not analyze template ${templatePath}: ${error.message}`);
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
     */
    async processASTWithContext(node, contextPath, templatePath) {
        if (Array.isArray(node)) {
            for (const child of node) {
                await this.processASTWithContext(child, contextPath, templatePath);
            }
            return;
        }

        if (!node || typeof node !== 'object') {
            return;
        }

        switch (node.type) {
            case 'Program':
                await this.processASTWithContext(node.body, contextPath, templatePath);
                break;

            case 'MustacheStatement':
                if (node.path && (!node.params || node.params.length === 0)) {
                    // Simple variable access
                    const fullPath = this.resolveVariablePath(node.path, contextPath);
                    if (fullPath) {
                        this.recordVariableUsage(fullPath, templatePath);
                    }
                }
                // Process parameters
                if (node.params) {
                    for (const param of node.params) {
                        await this.processASTWithContext(param, contextPath, templatePath);
                    }
                }
                // Process hash parameters  
                if (node.hash && node.hash.pairs) {
                    for (const pair of node.hash.pairs) {
                        if (pair.value) {
                            await this.processASTWithContext(pair.value, contextPath, templatePath);
                        }
                    }
                }
                break;

            case 'PathExpression':
                const fullPath = this.resolveVariablePath(node, contextPath);
                if (fullPath) {
                    this.recordVariableUsage(fullPath, templatePath);
                }
                break;

            case 'BlockStatement': {
                // Process the block expression itself
                await this.processASTWithContext(node.path, contextPath, templatePath);
                if (node.params) {
                    for (const param of node.params) {
                        await this.processASTWithContext(param, contextPath, templatePath);
                    }
                }

                // Determine new context for block body
                let newContextPath = contextPath;
                if (node.path && node.path.original) {
                    const helperName = node.path.original;
                    
                    if (helperName === 'each' && node.params && node.params[0]) {
                        const arrayPath = this.resolveVariablePath(node.params[0], contextPath);
                        if (arrayPath) {
                            newContextPath = arrayPath === 'root' ? '[0]' : `${arrayPath}[0]`;
                        }
                    } else if (helperName === 'with' && node.params && node.params[0]) {
                        const withPath = this.resolveVariablePath(node.params[0], contextPath);
                        if (withPath) {
                            newContextPath = withPath;
                        }
                    }
                }

                // Process block body
                if (node.program) {
                    await this.processASTWithContext(node.program, newContextPath, templatePath);
                }
                // Process else block
                if (node.inverse) {
                    await this.processASTWithContext(node.inverse, contextPath, templatePath);
                }
                break;
            }

            case 'PartialStatement': {
                if (node.name && node.name.original) {
                    const partialName = node.name.original;
                    const partialPath = upath.join(this.templatesDir, `${partialName}.html`);
                    
                    // Only analyze explicit parameter passing to avoid exponential growth
                    // Form components will be handled in second pass
                    if (node.hash && node.hash.pairs && node.hash.pairs.length > 0) {
                        // For partials with explicit parameters, just analyze the parameters
                        for (const pair of node.hash.pairs) {
                            if (pair.value && pair.value.type === 'PathExpression') {
                                const paramPath = this.resolveVariablePath(pair.value, contextPath);
                                if (paramPath) {
                                    this.recordVariableUsage(paramPath, templatePath);
                                }
                            }
                        }
                    }
                }

                // Process parameters
                if (node.params) {
                    for (const param of node.params) {
                        await this.processASTWithContext(param, contextPath, templatePath);
                    }
                }
                break;
            }

            default:
                // Process child nodes
                for (const key of Object.keys(node)) {
                    if (key !== 'type' && key !== 'loc' && node[key]) {
                        await this.processASTWithContext(node[key], contextPath, templatePath);
                    }
                }
        }
    }

    /**
     * Resolves a variable path to its full context path (simplified)
     * @param {Object} pathNode - PathExpression AST node
     * @param {string} contextPath - Current context path
     * @returns {string|null} Full variable path or null
     */
    resolveVariablePath(pathNode, contextPath) {
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
            let parentPath = this.getParentContext(contextPath, upLevels);
            if (parentPath === null) {
                return remainingPath || null;
            }
            
            return remainingPath ? `${parentPath}.${remainingPath}` : parentPath;
        }

        // Build full path
        const fullPath = parts.join('.');
        
        if (contextPath === 'root') {
            return fullPath;
        } else {
            return `${contextPath}.${fullPath}`;
        }
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
            
            if (lastBracketIndex > lastDotIndex) {
                // Remove array index
                currentPath = currentPath.substring(0, lastBracketIndex);
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

                for (const entry of entries) {
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
            .reduce((result, key) => ({
                ...result,
                [key]: {
                    count: this.variableUsage[key].count,
                    paths: this.variableUsage[key].paths.sort(),
                },
            }), {});

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
     * Second pass: analyzes form and option components to capture standalone variables
     */
    async analyzeFormComponents() {
        const formComponentPaths = [
            'components/common/forms/',
            'components/products/options/',
            'components/common/requireness'
        ];

        for (const basePath of formComponentPaths) {
            const fullPath = upath.join(this.templatesDir, basePath);
            try {
                await this.analyzeComponentsInDirectory(fullPath, 'form');
            } catch (error) {
                // Directory doesn't exist, skip
            }
        }
    }

    /**
     * Analyzes components in a directory with a specific context
     * @param {string} dirPath - Directory path to analyze
     * @param {string} contextPrefix - Context prefix for variables found in these components
     */
    async analyzeComponentsInDirectory(dirPath, contextPrefix) {
        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isFile() && entry.name.endsWith('.html')) {
                    const componentPath = upath.join(dirPath, entry.name);
                    await this.analyzeStandaloneComponent(componentPath, contextPrefix);
                }
            }
        } catch (error) {
            // Directory doesn't exist or can't be read
        }
    }

    /**
     * Analyzes a standalone component for variables that need context
     * @param {string} componentPath - Path to component file
     * @param {string} contextPrefix - Context prefix for variables
     */
    async analyzeStandaloneComponent(componentPath, contextPrefix) {
        try {
            const ast = await this.getOrParseTemplate(componentPath);
            if (!ast) return;

            // Collect standalone variables (variables without context dots)
            const standaloneVars = new Set();
            this.collectStandaloneVariables(ast, standaloneVars);

            // Record these variables with form context
            const relativePath = upath.relative(this.templatesDir, componentPath);
            for (const varName of standaloneVars) {
                // Skip common helper variables and add context
                if (!this.isCommonFormVariable(varName)) {
                    this.recordVariableUsage(`${contextPrefix}.${varName}`, relativePath);
                }
            }
        } catch (error) {
            // Skip components that can't be parsed
        }
    }

    /**
     * Collects standalone variables (no dots) from AST
     * @param {Object} node - AST node
     * @param {Set} variables - Set to collect variables into
     */
    collectStandaloneVariables(node, variables) {
        if (Array.isArray(node)) {
            for (const child of node) {
                this.collectStandaloneVariables(child, variables);
            }
            return;
        }

        if (!node || typeof node !== 'object') {
            return;
        }

        if (node.type === 'PathExpression' && node.parts && node.parts.length === 1) {
            const varName = node.parts[0];
            if (!this.isHandlebarsHelper(varName)) {
                variables.add(varName);
            }
        }

        // Recurse through child nodes
        for (const key of Object.keys(node)) {
            if (key !== 'type' && key !== 'loc' && node[key]) {
                this.collectStandaloneVariables(node[key], variables);
            }
        }
    }

    /**
     * Checks if a variable is a common form helper variable that shouldn't be contextualized
     * @param {string} varName - Variable name
     * @returns {boolean}
     */
    isCommonFormVariable(varName) {
        const commonVars = ['this', 'index', 'key', 'value', 'first', 'last', '@index', '@key', '@first', '@last'];
        return commonVars.includes(varName);
    }
}

export default StencilContextAnalyzer;
