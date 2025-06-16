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
        it('should analyze templates from valid mocked theme', async () => {
            const analyzer = new StencilContextAnalyzer(validTemplatesPath);
            const results = await analyzer.analyzeTemplates();

            expect(results).toBeInstanceOf(Object);
            expect(Object.keys(results).length).toBeGreaterThan(0);

            // Verify expected variables from the mocked theme templates
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

        it('should handle component templates with variables', async () => {
            const analyzer = new StencilContextAnalyzer(validTemplatesPath);
            const results = await analyzer.analyzeTemplates();

            // Check variables from component templates
            expect(results.link).toBeDefined();
            expect(results.text).toBeDefined();
            expect(results.link.paths).toContain('components/li.html');
            expect(results.text.paths).toContain('components/li.html');
        });

        it('should unify direct and parent context variable access', async () => {
            // Create a test template with unified variable scenarios
            const testTemplatesDir = path.join(tempDir, 'templates');
            await fs.promises.mkdir(testTemplatesDir, { recursive: true });

            const unifiedTemplate = `
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

            await fs.promises.writeFile(
                path.join(testTemplatesDir, 'unified.html'),
                unifiedTemplate,
            );

            const analyzer = new StencilContextAnalyzer(testTemplatesDir);
            const results = await analyzer.analyzeTemplates();

            // Verify unified counting
            expect(results['store.name'].count).toBe(2); // 1 direct + 1 parent context
            expect(results['store.address'].count).toBe(2); // 1 direct + 1 parent context
            expect(results['products[0].name'].count).toBe(1);

            // Verify no unresolved parent context references
            const parentRefs = Object.keys(results).filter((key) => key.startsWith('../'));
            expect(parentRefs).toHaveLength(0);
        });

        it('should detect variables in helper parameters', async () => {
            // Create a test template with helper variables
            const testTemplatesDir = path.join(tempDir, 'templates');
            await fs.promises.mkdir(testTemplatesDir, { recursive: true });

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

            await fs.promises.writeFile(
                path.join(testTemplatesDir, 'helpers.html'),
                helpersTemplate,
            );

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

        it('should handle nested block statements correctly', async () => {
            const testTemplatesDir = path.join(tempDir, 'templates');
            await fs.promises.mkdir(testTemplatesDir, { recursive: true });

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

            await fs.promises.writeFile(path.join(testTemplatesDir, 'nested.html'), nestedTemplate);

            const analyzer = new StencilContextAnalyzer(testTemplatesDir);
            const results = await analyzer.analyzeTemplates();

            // Verify nested context handling
            expect(results.products).toBeDefined();
            expect(results['products[0].name']).toBeDefined();
            expect(results['products[0].variants']).toBeDefined();
            expect(results['products[0].variants[0].name']).toBeDefined();
            expect(results['products[0].variants[0].details']).toBeDefined();
            expect(results['products[0].variants[0].details.color']).toBeDefined();
            expect(results['products[0].variants[0].details.size']).toBeDefined();

            // Verify unified counting for nested parent context
            expect(results['products[0].name'].count).toBe(2); // Direct + parent context
        });
    });

    describe('Error Handling', () => {
        it('should handle non-existent templates directory', async () => {
            const nonExistentPath = path.join(tempDir, 'non-existent');
            const analyzer = new StencilContextAnalyzer(nonExistentPath);

            // Should not throw but return empty results
            const results = await analyzer.analyzeTemplates();
            expect(results).toEqual({});
        });

        it('should handle empty templates directory', async () => {
            const emptyDir = path.join(tempDir, 'empty-templates');
            await fs.promises.mkdir(emptyDir, { recursive: true });

            const analyzer = new StencilContextAnalyzer(emptyDir);
            const results = await analyzer.analyzeTemplates();

            expect(results).toEqual({});
        });

        it('should handle invalid Handlebars syntax gracefully', async () => {
            const testTemplatesDir = path.join(tempDir, 'templates');
            await fs.promises.mkdir(testTemplatesDir, { recursive: true });

            const invalidTemplate = `
<div>
    {{#if unclosed_block}}
        <p>This block is not closed properly</p>
    <!-- Missing {{/if}} -->
    
    {{invalid.handlebars.syntax{{}}
    {{}}
</div>`;

            await fs.promises.writeFile(
                path.join(testTemplatesDir, 'invalid.html'),
                invalidTemplate,
            );

            const analyzer = new StencilContextAnalyzer(testTemplatesDir);

            // Should not throw but warn and continue
            const results = await analyzer.analyzeTemplates();
            expect(results).toBeInstanceOf(Object);
            // Should be empty since the template couldn't be parsed
            expect(Object.keys(results)).toHaveLength(0);
        });

        it('should handle empty template files', async () => {
            const testTemplatesDir = path.join(tempDir, 'templates');
            await fs.promises.mkdir(testTemplatesDir, { recursive: true });

            // Create various empty files
            await fs.promises.writeFile(path.join(testTemplatesDir, 'empty.html'), '');
            await fs.promises.writeFile(
                path.join(testTemplatesDir, 'whitespace.html'),
                '   \n\t  ',
            );
            await fs.promises.writeFile(
                path.join(testTemplatesDir, 'valid.html'),
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
            await fs.promises.mkdir(testTemplatesDir, { recursive: true });

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

            await fs.promises.writeFile(
                path.join(testTemplatesDir, 'static.html'),
                htmlOnlyTemplate,
            );

            const analyzer = new StencilContextAnalyzer(testTemplatesDir);
            const results = await analyzer.analyzeTemplates();

            expect(results).toEqual({});
        });

        it('should handle file read permissions errors', async () => {
            const testTemplatesDir = path.join(tempDir, 'templates');
            await fs.promises.mkdir(testTemplatesDir, { recursive: true });

            const testFile = path.join(testTemplatesDir, 'test.html');
            await fs.promises.writeFile(testFile, '<p>{{test.variable}}</p>');

            // Mock fs.promises.readFile to simulate permission error
            const originalReadFile = fs.promises.readFile;
            fs.promises.readFile = jest
                .fn()
                .mockRejectedValue(new Error('EACCES: permission denied'));

            const analyzer = new StencilContextAnalyzer(testTemplatesDir);
            const results = await analyzer.analyzeTemplates();

            // Should handle error gracefully and return empty results
            expect(results).toEqual({});

            // Restore original function
            fs.promises.readFile = originalReadFile;
        });

        it('should handle Paper initialization errors', async () => {
            const analyzer = new StencilContextAnalyzer(validTemplatesPath);

            // Mock Paper's handlebars.parse to throw an error
            const originalParse = analyzer.paper.renderer.handlebars.parse;
            analyzer.paper.renderer.handlebars.parse = jest.fn().mockImplementation(() => {
                throw new Error('Handlebars parse error');
            });

            const results = await analyzer.analyzeTemplates();

            // Should handle error gracefully
            expect(results).toEqual({});

            // Restore original function
            analyzer.paper.renderer.handlebars.parse = originalParse;
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
            await fs.promises.mkdir(testTemplatesDir, { recursive: true });

            const helpersOnlyTemplate = `
<div>
    {{#if true}}
        <p>Always shown</p>
    {{/if}}
    
    {{#unless false}}
        <p>Also always shown</p>
    {{/unless}}
    
    {{#each (range 1 5)}}
        <span>{{@index}}</span>
    {{/each}}
</div>`;

            await fs.promises.writeFile(
                path.join(testTemplatesDir, 'helpers-only.html'),
                helpersOnlyTemplate,
            );

            const analyzer = new StencilContextAnalyzer(testTemplatesDir);
            const results = await analyzer.analyzeTemplates();

            // Should detect minimal variables (may include special Handlebars variables like @index)
            expect(Object.keys(results).length).toBeLessThanOrEqual(1);
        });
    });

    describe('Integration with Bundle Process', () => {
        it('should work with actual bundle-like template structure', async () => {
            // Test with the actual mocked theme structure
            const analyzer = new StencilContextAnalyzer(validTemplatesPath);
            const results = await analyzer.analyzeTemplates();

            // Verify it finds variables from multiple template types
            expect(Object.keys(results).length).toBeGreaterThan(0);

            // Verify it handles partial references correctly
            const paths = Object.values(results).flatMap((variable) => variable.paths);
            expect(paths).toEqual(
                expect.arrayContaining([
                    expect.stringMatching(/^pages\//),
                    expect.stringMatching(/^components\//),
                ]),
            );

            // Verify output format is ready for bundle inclusion
            Object.values(results).forEach((variable) => {
                expect(variable).toHaveProperty('count');
                expect(variable).toHaveProperty('paths');
                expect(variable.count).toBeGreaterThan(0);
                expect(variable.paths.length).toBeGreaterThan(0);
            });
        });
    });
});
