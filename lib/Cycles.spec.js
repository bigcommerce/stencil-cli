const Cycles = require('./Cycles');

describe('Cycles', () => {
    const templatesWithCircles = [
        {
            page: `---
                    front_matter_options:
                        setting_x:
                            value: {{theme_settings.front_matter_value}}
                    ---
                    <!DOCTYPE html>
                    <html>
                    <body>
                    {{#if theme_settings.display_that}}
                        <div>{{> components/index}}</div>
                    {{/if}}
                    </body>
                    </html>`,
            'components/index': `<h1>Oh Hai there</h1>
                                <p>
                                    <h1>Test product {{dynamicComponent 'components/options'}}</h1>
                                </p>`,
            'components/options/date': `<h1>This is a dynamic component</h1>
                                       <h1>Test product {{> components/index}}</h1>`,
        },
        {
            page2: `<!DOCTYPE html>
                     <html>
                     <body>
                         <h1>{{theme_settings.customizable_title}}</h1>
                     </body>
                     </html>`,
        },
        {
            'components/index': `<h1>Oh Hai there</h1>
                                <p>
                                    <h1>Test product {{dynamicComponent 'components/options'}}</h1>
                                </p>`,
            'components/options/date': `<h1>This is a dynamic component</h1>
                                       <h1>Test product {{> components/index}}</h1>`,
        },
        {
            'components/options/date': `<h1>This is a dynamic component</h1>
                                       <h1>Test product {{> components/index}}</h1>`,
            'components/index': `<h1>Oh Hai there</h1>
                                <p>
                                    <h1>Test product {{dynamicComponent 'components/options'}}</h1>
                                </p>`,
        },
    ];

    const templatesWithoutCircles = [
        {
            page: `---
                    front_matter_options:
                        setting_x:
                            value: {{theme_settings.front_matter_value}}
                    ---
                    <!DOCTYPE html>
                    <html>
                    <body>
                    {{#if theme_settings.display_that}}
                        <div>{{> components/index}}</div>
                    {{/if}}
                    </body>
                    </html>`,
            'components/index': `<h1>This is the index</h1>`,
        },
        {
            page2: `<!DOCTYPE html>
                     <html>
                     <body>
                         <h1>{{theme_settings.customizable_title}}</h1>
                     </body>
                     </html>`,
        },
    ];

    const templatesWithSelfReferences = [
        {
            page: `---
                    front_matter_options:
                        setting_x:
                            value: {{theme_settings.front_matter_value}}
                    ---
                    <!DOCTYPE html>
                    <html>
                    <body>
                    {{#if theme_settings.display_that}}
                        <div>{{> components/index}}</div>
                    {{/if}}
                    <h1>Self-reference: {{dynamicComponent 'page'}}</h1>
                    </body>
                    </html>`,
            'components/index': `<h1>This is the index</h1>`,
        },
    ];

    it('should throw error when cycle is detected', () => {
        const action = () => new Cycles(templatesWithCircles).detect();

        expect(action).toThrow(Error, /Circular/);
    });

    it('should throw an error when non array passed in', () => {
        const action = () => new Cycles('test');

        expect(action).toThrow(Error);
    });

    it("should not throw an error when cycles weren't detected", () => {
        const action = () => new Cycles(templatesWithoutCircles).detect();

        expect(action).not.toThrow();
    });

    it('should not throw an error for self-references', () => {
        const action = () => new Cycles(templatesWithSelfReferences).detect();

        expect(action).not.toThrow();
    });
});
