const Cycles = require('./cycles');

describe('Cycles', () => {
    const invaldResults = [
        {
            "page":"---\nfront_matter_options:\n    setting_x:\n        value: {{theme_settings.front_matter_value}}\n---\n<!DOCTYPE html>\n<html>\n<body>\n{{#if theme_settings.display_that}}\n    <div>{{> components/index}}</div>\n{{/if}}\n</body>\n</html>\n",
            "components/index":"<h1>Oh Hai there</h1>\n<p>\n    <h1>Test product {{dynamicComponent 'components/options'}}</h1>\n</p>\n",
            "components/options/date":"<h1>This is a dynamic component</h1>\n<h1>Test product {{> components/index}}</h1>\n",
        },
        {
            "page2":"<!DOCTYPE html>\n<html>\n<body>\n    <h1>{{theme_settings.customizable_title}}</h1>\n</body>\n</html>\n",
        },
        {
            "components/index":"<h1>Oh Hai there</h1>\n<p>\n    <h1>Test product {{dynamicComponent 'components/options'}}</h1>\n</p>\n",
            "components/options/date":"<h1>This is a dynamic component</h1>\n<h1>Test product {{> components/index}}</h1>\n",
        },
        {
            "components/options/date":"<h1>This is a dynamic component</h1>\n<h1>Test product {{> components/index}}</h1>\n",
            "components/index":"<h1>Oh Hai there</h1>\n<p>\n    <h1>Test product {{dynamicComponent 'components/options'}}</h1>\n</p>\n",
        },
    ];

    const validResults = [
        {
            "page":"---\nfront_matter_options:\n    setting_x:\n        value: {{theme_settings.front_matter_value}}\n---\n<!DOCTYPE html>\n<html>\n<body>\n{{#if theme_settings.display_that}}\n    <div>{{> components/index}}</div>\n{{/if}}\n</body>\n</html>\n",
            "components/index":"<h1>This is the index</h1>\n",
        },
        {
            "page2":"<!DOCTYPE html>\n<html>\n<body>\n    <h1>{{theme_settings.customizable_title}}</h1>\n</body>\n</html>\n",
        },
    ];

    it('should throw error when cycle is detected', () => {
        const action = () => {
            new Cycles(invaldResults).detect();
        };

        expect(action).toThrow(Error, /Circular/);
    });

    it('should throw an error when non array passed in', () => {
        const action = () => {
            new Cycles('test');
        };

        expect(action).toThrow(Error);
    });

    it('should not throw an error when cycles weren\'t detected', () => {
        const action = () => {
            new Cycles(validResults).detect();
        };

        expect(action).not.toThrow();
    });
});
