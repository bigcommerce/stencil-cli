var Code = require('code'),
    Lab = require('lab'),
    lab = exports.lab = Lab.script(),
    describe = lab.describe,
    Cycles = require('./cycles'),
    expect = Code.expect,
    it = lab.it;

describe('Cycles', function () {

    var invaldResults = [
        {"page":"---\nfront_matter_options:\n    setting_x:\n        value: {{theme_settings.front_matter_value}}\n---\n<!DOCTYPE html>\n<html>\n<body>\n{{#if theme_settings.display_that}}\n    <div>{{> components/index}}</div>\n{{/if}}\n</body>\n</html>\n",
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

    var validResults = [
        {"page":"---\nfront_matter_options:\n    setting_x:\n        value: {{theme_settings.front_matter_value}}\n---\n<!DOCTYPE html>\n<html>\n<body>\n{{#if theme_settings.display_that}}\n    <div>{{> components/index}}</div>\n{{/if}}\n</body>\n</html>\n",
            "components/index":"<h1>This is the index</h1>\n",
        },
        {
            "page2":"<!DOCTYPE html>\n<html>\n<body>\n    <h1>{{theme_settings.customizable_title}}</h1>\n</body>\n</html>\n",
        },
    ];

    it('should throw error when cycle is detected', function (done) {
        var throws = function () {
            new Cycles(invaldResults).detect();
        };

        expect(throws).throw(Error, /Circular/);
        done();
    });

    it('should throw an error when non array passed in', function (done) {
        var throws = function () {
            new Cycles('test');
        };

        expect(throws).throw(Error);
        done();
    });

    it('should not throw an error when checking for cycles', function (done) {
        var throws = function () {
            new Cycles(validResults).detect();
        };

        expect(throws).to.not.throw();
        done();
    });
});
