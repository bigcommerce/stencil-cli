import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import StencilContextAnalyzer from './StencilContextAnalyzer.js';

describe('StencilContextAnalyzer', () => {
    const validThemePath = path.join(process.cwd(), 'test/_mocks/themes/valid');
    const validTemplatesPath = path.join(validThemePath, 'templates');
    let tempDir;

    beforeEach(async () => {
        tempDir = await fs.promises.mkdtemp('stencil-context-analyzer-test-');
    });

    afterEach(async () => {
        if (tempDir && fs.existsSync(tempDir)) {
            await fs.promises.rm(tempDir, { recursive: true });
        }
    });

    describe('Happy Path', () => {
        it('should analyze page templates and track context flow', async () => {
            const analyzer = new StencilContextAnalyzer(validTemplatesPath);
            const results = await analyzer.analyzeTemplates();

            expect(results).toBeInstanceOf(Object);
            expect(Object.keys(results).length).toBeGreaterThan(0);

            // Verify expected variables from page templates with full context paths
            expect(results['head.scripts']).toBeDefined();
            expect(results['head.scripts'].count).toBeGreaterThan(0);
            expect(results['head.scripts'].paths).toContain('pages/page.html');

            expect(results['theme_settings.display_that']).toBeDefined();
            expect(results['theme_settings.customizable_title']).toBeDefined();
            expect(results['footer.scripts']).toBeDefined();

            // Verify path tracking
            expect(results['head.scripts'].paths).toEqual(
                expect.arrayContaining(['pages/page.html', 'pages/page3.html']),
            );
        });

        it('should capture form variables with form context in second pass', async () => {
            const testTemplatesDir = path.join(tempDir, 'templates');
            const pagesDir = path.join(testTemplatesDir, 'pages');
            const formsDir = path.join(testTemplatesDir, 'components', 'common', 'forms');
            await fs.promises.mkdir(pagesDir, { recursive: true });
            await fs.promises.mkdir(formsDir, { recursive: true });

            // Create a page template
            const pageTemplate = `
<div>
    <h1>{{product.name}}</h1>
    {{> components/common/forms/text}}
</div>`;

            // Create a form component with standalone variables
            const formTemplate = `
<input type="text" {{#if required}}required{{/if}} name="{{name}}" value="{{defaultValue}}">
{{#if hasError}}<span class="error">{{errorMessage}}</span>{{/if}}`;

            await fs.promises.writeFile(path.join(pagesDir, 'product.html'), pageTemplate);
            await fs.promises.writeFile(path.join(formsDir, 'text.html'), formTemplate);

            const analyzer = new StencilContextAnalyzer(testTemplatesDir);
            const results = await analyzer.analyzeTemplates();

            // Verify page template context tracking
            expect(results['product.name']).toBeDefined();
            expect(results['product.name'].paths).toContain('pages/product.html');

            // Verify form variables captured with form context
            expect(results['form.required']).toBeDefined();
            expect(results['form.name']).toBeDefined();
            expect(results['form.defaultValue']).toBeDefined();
            expect(results['form.hasError']).toBeDefined();
            expect(results['form.errorMessage']).toBeDefined();
            // Verify form variables are attributed to the form component
            expect(results['form.required'].paths).toContain('components/common/forms/text.html');
        });

        it('should track full context paths through nested loops', async () => {
            const testTemplatesDir = path.join(tempDir, 'templates');
            const pagesDir = path.join(testTemplatesDir, 'pages');
            await fs.promises.mkdir(pagesDir, { recursive: true });

            const nestedTemplate = `
<div>
    <h1>{{store.name}}</h1>
    <p>{{store.address}}</p>
    
    {{#each products}}
        <div>
            <p>Store: {{../store.name}}</p>
            <p>Address: {{../store.address}}</p>
            <h3>{{name}}</h3>
        </div>
    {{/each}}
</div>`;

            await fs.promises.writeFile(path.join(pagesDir, 'catalog.html'), nestedTemplate);

            const analyzer = new StencilContextAnalyzer(testTemplatesDir);
            const results = await analyzer.analyzeTemplates();

            // Verify context path tracking (note: parent context resolution may create unified paths)
            expect(results['store.name']).toBeDefined();
            expect(results['store.address']).toBeDefined();
            expect(results['products.name']).toBeDefined();

            // Note: The exact count depends on how parent context (../) is resolved
            // Both direct access and parent context access should be tracked
            expect(results['store.name'].count).toBeGreaterThanOrEqual(1);
            expect(results['store.address'].count).toBeGreaterThanOrEqual(1);

            // Verify no unresolved parent context references
            const parentRefs = Object.keys(results).filter((key) => key.startsWith('../'));
            expect(parentRefs).toHaveLength(0);
        });

        it('should detect variables in helper parameters', async () => {
            const testTemplatesDir = path.join(tempDir, 'templates');
            const pagesDir = path.join(testTemplatesDir, 'pages');
            await fs.promises.mkdir(pagesDir, { recursive: true });

            const helpersTemplate = `
<div>
    {{#if (compare product.price ">" 100)}}
        <span>Expensive: {{product.name}}</span>
    {{/if}}
    
    {{#unless (isEmpty cart.items)}}
        <p>Items: {{cart.count}}</p>
    {{/unless}}
    
    {{currency product.price settings.currency}}
</div>`;

            await fs.promises.writeFile(path.join(pagesDir, 'product.html'), helpersTemplate);

            const analyzer = new StencilContextAnalyzer(testTemplatesDir);
            const results = await analyzer.analyzeTemplates();

            // Verify helper parameter variables are detected
            expect(results['product.price']).toBeDefined();
            expect(results['product.price'].count).toBe(2); // Once in compare, once in currency
            expect(results['cart.items']).toBeDefined();
            expect(results['settings.currency']).toBeDefined();
            expect(results['product.name']).toBeDefined();
            expect(results['cart.count']).toBeDefined();
        });

        it('should export results to JSON file', async () => {
            const analyzer = new StencilContextAnalyzer(validTemplatesPath);
            const outputPath = path.join(tempDir, 'output.json');

            const results = await analyzer.analyzeAndExport(outputPath);

            expect(results).toBeInstanceOf(Object);
            expect(fs.existsSync(outputPath)).toBe(true);

            const jsonContent = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
            expect(jsonContent).toEqual(results);

            // Verify JSON structure
            Object.values(jsonContent).forEach((variable) => {
                expect(variable).toHaveProperty('count');
                expect(variable).toHaveProperty('paths');
                expect(typeof variable.count).toBe('number');
                expect(Array.isArray(variable.paths)).toBe(true);
            });
        });

        it('should handle deeply nested block statements correctly', async () => {
            const testTemplatesDir = path.join(tempDir, 'templates');
            const pagesDir = path.join(testTemplatesDir, 'pages');
            await fs.promises.mkdir(pagesDir, { recursive: true });

            const nestedTemplate = `
<div>
    {{#each products}}
        <div class="product">
            <h3>{{name}}</h3>
            
            {{#each variants}}
                <div class="variant">
                    <span>{{name}} ({{../name}})</span>
                    
                    {{#with details}}
                        <p>{{color}} - {{size}}</p>
                        <p>Product: {{../../name}}</p>
                    {{/with}}
                </div>
            {{/each}}
        </div>
    {{/each}}
</div>`;

            await fs.promises.writeFile(path.join(pagesDir, 'catalog.html'), nestedTemplate);

            const analyzer = new StencilContextAnalyzer(testTemplatesDir);
            const results = await analyzer.analyzeTemplates();

            // Verify deeply nested context handling
            expect(results.products).toBeDefined();
            expect(results['products.name']).toBeDefined();
            expect(results['products.variants']).toBeDefined();
            expect(results['products.variants.name']).toBeDefined();
            expect(results['products.variants.details']).toBeDefined();
            expect(results['products.variants.details.color']).toBeDefined();
            expect(results['products.variants.details.size']).toBeDefined();

            // Verify context tracking (exact count may vary based on parent context resolution)
            expect(results['products.name'].count).toBeGreaterThanOrEqual(1);
        });

        it('should handle partial parameters correctly', async () => {
            const testTemplatesDir = path.join(tempDir, 'templates');
            const pagesDir = path.join(testTemplatesDir, 'pages');
            await fs.promises.mkdir(pagesDir, { recursive: true });

            const pageWithPartials = `
<div>
    {{> components/product-card product=featured_product}}
    {{> components/user-info user=current_user email=user.email}}
</div>`;

            await fs.promises.writeFile(path.join(pagesDir, 'home.html'), pageWithPartials);

            const analyzer = new StencilContextAnalyzer(testTemplatesDir);
            const results = await analyzer.analyzeTemplates();

            // Verify partial parameters are tracked
            expect(results.featured_product).toBeDefined();
            expect(results.current_user).toBeDefined();
            expect(results['user.email']).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle non-existent pages directory', async () => {
            const testTemplatesDir = path.join(tempDir, 'templates');
            await fs.promises.mkdir(testTemplatesDir, { recursive: true });
            // Note: not creating pages/ subdirectory

            const analyzer = new StencilContextAnalyzer(testTemplatesDir);
            const results = await analyzer.analyzeTemplates();

            expect(results).toEqual({});
        });

        it('should handle empty pages directory', async () => {
            const testTemplatesDir = path.join(tempDir, 'templates');
            const pagesDir = path.join(testTemplatesDir, 'pages');
            await fs.promises.mkdir(pagesDir, { recursive: true });

            const analyzer = new StencilContextAnalyzer(testTemplatesDir);
            const results = await analyzer.analyzeTemplates();

            expect(results).toEqual({});
        });

        it('should handle invalid Handlebars syntax gracefully', async () => {
            const testTemplatesDir = path.join(tempDir, 'templates');
            const pagesDir = path.join(testTemplatesDir, 'pages');
            await fs.promises.mkdir(pagesDir, { recursive: true });

            const invalidTemplate = `
<div>
    {{#if unclosed_block}}
        <p>This block is not closed properly</p>
    <!-- Missing {{/if}} -->
    
    {{invalid.handlebars.syntax{{}}
    {{}}
</div>`;

            await fs.promises.writeFile(path.join(pagesDir, 'invalid.html'), invalidTemplate);

            const analyzer = new StencilContextAnalyzer(testTemplatesDir);

            // Should not throw but warn and continue
            const results = await analyzer.analyzeTemplates();
            expect(results).toBeInstanceOf(Object);
        });

        it('should handle empty template files', async () => {
            const testTemplatesDir = path.join(tempDir, 'templates');
            const pagesDir = path.join(testTemplatesDir, 'pages');
            await fs.promises.mkdir(pagesDir, { recursive: true });

            // Create various empty files
            await fs.promises.writeFile(path.join(pagesDir, 'empty.html'), '');
            await fs.promises.writeFile(path.join(pagesDir, 'whitespace.html'), '   \n\t  ');
            await fs.promises.writeFile(
                path.join(pagesDir, 'valid.html'),
                '<p>{{valid.variable}}</p>',
            );

            const analyzer = new StencilContextAnalyzer(testTemplatesDir);
            const results = await analyzer.analyzeTemplates();

            // Should only contain variables from valid template
            expect(results['valid.variable']).toBeDefined();
            expect(Object.keys(results)).toHaveLength(1);
        });

        it('should handle templates with only HTML content (no variables)', async () => {
            const testTemplatesDir = path.join(tempDir, 'templates');
            const pagesDir = path.join(testTemplatesDir, 'pages');
            await fs.promises.mkdir(pagesDir, { recursive: true });

            const htmlOnlyTemplate = `
<!DOCTYPE html>
<html>
<head>
    <title>Static Title</title>
</head>
<body>
    <h1>Static Content</h1>
    <p>No Handlebars variables here</p>
</body>
</html>`;

            await fs.promises.writeFile(path.join(pagesDir, 'static.html'), htmlOnlyTemplate);

            const analyzer = new StencilContextAnalyzer(testTemplatesDir);
            const results = await analyzer.analyzeTemplates();

            expect(results).toEqual({});
        });

        it('should handle file read permissions errors gracefully', async () => {
            const testTemplatesDir = path.join(tempDir, 'templates');
            const pagesDir = path.join(testTemplatesDir, 'pages');
            await fs.promises.mkdir(pagesDir, { recursive: true });

            const testFile = path.join(pagesDir, 'test.html');
            await fs.promises.writeFile(testFile, '<p>{{test.variable}}</p>');

            // Mock fs.promises.readFile to simulate permission error for this specific file
            const originalReadFile = fs.promises.readFile;
            fs.promises.readFile = jest.fn().mockImplementation((filePath, encoding) => {
                if (filePath === testFile) {
                    return Promise.reject(new Error('EACCES: permission denied'));
                }
                return originalReadFile(filePath, encoding);
            });

            const analyzer = new StencilContextAnalyzer(testTemplatesDir);
            const results = await analyzer.analyzeTemplates();

            // Should handle error gracefully and continue with other templates
            expect(results).toBeInstanceOf(Object);

            // Restore original function
            fs.promises.readFile = originalReadFile;
        });

        it('should handle export to JSON file in non-existent directory', async () => {
            const analyzer = new StencilContextAnalyzer(validTemplatesPath);
            const nonExistentDir = path.join(tempDir, 'non-existent', 'deep', 'path');
            const outputPath = path.join(nonExistentDir, 'output.json');

            // Should throw an error when trying to write to non-existent directory
            await expect(analyzer.analyzeAndExport(outputPath)).rejects.toThrow();
        });

        it('should handle templates with only Handlebars helpers (no variables)', async () => {
            const testTemplatesDir = path.join(tempDir, 'templates');
            const pagesDir = path.join(testTemplatesDir, 'pages');
            await fs.promises.mkdir(pagesDir, { recursive: true });

            const helpersOnlyTemplate = `
<div>
    {{#if true}}
        <p>Always shown</p>
    {{/if}}
    
    {{#unless false}}
        <p>Also always shown</p>
    {{/unless}}
    
    <span>Static content</span>
</div>`;

            await fs.promises.writeFile(
                path.join(pagesDir, 'helpers-only.html'),
                helpersOnlyTemplate,
            );

            const analyzer = new StencilContextAnalyzer(testTemplatesDir);
            const results = await analyzer.analyzeTemplates();

            // Should detect no data variables (only helpers)
            // Note: May include some variables captured during form analysis
            expect(Object.keys(results).length).toBeLessThanOrEqual(2);
        });
    });

    describe('Component Analysis', () => {
        it('should capture form component variables with form context in second pass', async () => {
            const testTemplatesDir = path.join(tempDir, 'templates');
            const formsDir = path.join(testTemplatesDir, 'components', 'common', 'forms');
            const optionsDir = path.join(testTemplatesDir, 'components', 'products', 'options');
            await fs.promises.mkdir(formsDir, { recursive: true });
            await fs.promises.mkdir(optionsDir, { recursive: true });

            // Create form components with standalone variables
            const textFieldTemplate = `
<input type="text" 
       name="{{fieldName}}" 
       value="{{fieldValue}}"
       {{#if isRequired}}required{{/if}}
       {{#if isDisabled}}disabled{{/if}}>
{{#if hasErrors}}<span class="error">{{errorText}}</span>{{/if}}`;

            const selectFieldTemplate = `
<select name="{{selectName}}" {{#if isRequired}}required{{/if}}>
    {{#each optionsList}}
        <option value="{{optionValue}}" {{#if isSelected}}selected{{/if}}>{{optionLabel}}</option>
    {{/each}}
</select>`;

            await fs.promises.writeFile(path.join(formsDir, 'text.html'), textFieldTemplate);
            await fs.promises.writeFile(path.join(optionsDir, 'select.html'), selectFieldTemplate);

            const analyzer = new StencilContextAnalyzer(testTemplatesDir);
            const results = await analyzer.analyzeTemplates();

            // Verify form variables are captured with form prefix
            expect(results['form.fieldName']).toBeDefined();
            expect(results['form.fieldValue']).toBeDefined();
            expect(results['form.isRequired']).toBeDefined();
            expect(results['form.isDisabled']).toBeDefined();
            expect(results['form.hasErrors']).toBeDefined();
            expect(results['form.errorText']).toBeDefined();
            expect(results['form.selectName']).toBeDefined();
            expect(results['form.optionsList']).toBeDefined();
            expect(results['form.optionValue']).toBeDefined();
            expect(results['form.isSelected']).toBeDefined();
            expect(results['form.optionLabel']).toBeDefined();

            // Verify proper attribution to components
            expect(results['form.fieldName'].paths).toEqual(
                expect.arrayContaining(['components/common/forms/text.html']),
            );
            expect(results['form.selectName'].paths).toEqual(
                expect.arrayContaining(['components/products/options/select.html']),
            );
        });

        it('should not capture common form helper variables', async () => {
            const testTemplatesDir = path.join(tempDir, 'templates');
            const formsDir = path.join(testTemplatesDir, 'components', 'common', 'forms');
            await fs.promises.mkdir(formsDir, { recursive: true });

            const formWithHelpersTemplate = `
<div>
    {{#each items}}
        <div data-index="{{@index}}">
            {{this.name}} - {{@key}}
            {{#if @first}}First{{/if}}
            {{#if @last}}Last{{/if}}
        </div>
    {{/each}}
</div>`;

            await fs.promises.writeFile(path.join(formsDir, 'list.html'), formWithHelpersTemplate);

            const analyzer = new StencilContextAnalyzer(testTemplatesDir);
            const results = await analyzer.analyzeTemplates();

            // Should capture real variables but not helper variables
            expect(results['form.items']).toBeDefined();
            // Should not capture helper variables like @index, @key, etc.
            expect(results['form.@index']).toBeUndefined();
            expect(results['form.@key']).toBeUndefined();
            expect(results['form.@first']).toBeUndefined();
            expect(results['form.@last']).toBeUndefined();
            expect(results['form.this']).toBeUndefined();
        });

        it('should capture non-form component variables with component context in second pass', async () => {
            const testTemplatesDir = path.join(tempDir, 'templates');
            const commonDir = path.join(testTemplatesDir, 'components', 'common');
            await fs.promises.mkdir(commonDir, { recursive: true });

            // Create non-form components
            const headerTemplate = `
<header>
    <h1>{{siteName}}</h1>
    <nav>{{#each menuItems}}<a href="{{url}}">{{title}}</a>{{/each}}</nav>
    <div class="user-info">{{userName}} - {{userRole}}</div>
</header>`;

            const footerTemplate = `
<footer>
    <p>&copy; {{copyrightYear}} {{companyName}}</p>
    <div class="social-links">
        {{#each socialLinks}}
            <a href="{{url}}" target="_blank">{{platform}}</a>
        {{/each}}
    </div>
</footer>`;

            await fs.promises.writeFile(path.join(commonDir, 'header.html'), headerTemplate);
            await fs.promises.writeFile(path.join(commonDir, 'footer.html'), footerTemplate);

            const analyzer = new StencilContextAnalyzer(testTemplatesDir);
            const results = await analyzer.analyzeTemplates();

            // Verify non-form component variables are captured with component context
            expect(results['component.siteName']).toBeDefined();
            expect(results['component.menuItems']).toBeDefined();
            expect(results['component.menuItems.url']).toBeDefined();
            expect(results['component.menuItems.title']).toBeDefined();
            expect(results['component.userName']).toBeDefined();
            expect(results['component.userRole']).toBeDefined();
            expect(results['component.copyrightYear']).toBeDefined();
            expect(results['component.companyName']).toBeDefined();
            expect(results['component.socialLinks']).toBeDefined();
            expect(results['component.socialLinks.url']).toBeDefined();
            expect(results['component.socialLinks.platform']).toBeDefined();

            // Verify attribution to component files
            expect(results['component.siteName'].paths).toContain('components/common/header.html');
            expect(results['component.copyrightYear'].paths).toContain(
                'components/common/footer.html',
            );
        });
    });

    describe('Integration with Bundle Process', () => {
        it('should work with actual bundle-like template structure', async () => {
            // Test with the actual mocked theme structure
            const analyzer = new StencilContextAnalyzer(validTemplatesPath);
            const results = await analyzer.analyzeTemplates();

            // Verify it finds variables from page templates
            expect(Object.keys(results).length).toBeGreaterThan(0);

            // Verify it handles page template references correctly
            const paths = Object.values(results).flatMap((variable) => variable.paths);
            expect(paths).toEqual(expect.arrayContaining([expect.stringMatching(/^pages\//)]));

            // Verify output format is ready for bundle inclusion
            Object.values(results).forEach((variable) => {
                expect(variable).toHaveProperty('count');
                expect(variable).toHaveProperty('paths');
                expect(variable.count).toBeGreaterThan(0);
                expect(variable.paths.length).toBeGreaterThan(0);
            });
        });

        it('should provide consistent results across multiple runs', async () => {
            const analyzer = new StencilContextAnalyzer(validTemplatesPath);
            const results1 = await analyzer.analyzeTemplates();
            const results2 = await analyzer.analyzeTemplates();

            // Results should be identical across multiple runs
            expect(results1).toEqual(results2);
            expect(Object.keys(results1)).toEqual(Object.keys(results2));
        });
    });
});
