'use strict';
var Fs = require('fs');
var jsonLint = require('./json-lint');
var Path = require('path');
var Inquirer = require('inquirer');
var themePath = process.cwd();
var hoek = require('hoek');
var configuration;
var internals = {};

internals.parseAnswers = function(JspmAssembler, ThemeConfig, dotStencilFile, dotStencilFilePath, answers) {

    // Check for custom layout configurations
    // If already set, do nothing otherwise write the empty configurations
    if (!dotStencilFile || dotStencilFile && !dotStencilFile.customLayouts) {
        answers.customLayouts = {
            'brand': {},
            'category': {},
            'page': {},
            'product': {},
        };
    }

    var defaults = dotStencilFile ? hoek.applyToDefaults(dotStencilFile, answers) : answers;

    Fs.writeFile(dotStencilFilePath, JSON.stringify(defaults, null, 2), function (err) {
        var ready = 'You are now ready to go! To start developing, run $ ' + 'stencil start'.cyan,
            bundleTask;

        if (err) {
            throw err;
        }

        // bundle dev dependencies
        configuration = ThemeConfig.getInstance(themePath).getConfig();
        if (configuration.jspm) {
            if (!Fs.existsSync(Path.join(themePath, configuration.jspm.jspm_packages_path))) {
                console.log('Error: The path you specified for your "jspm_packages" folder does not exist.'.red);
                return console.log(
                    'Please check your '.red +
                    'jspm.jspm_packages_path'.cyan +
                    ' setting in your theme\'s '.red +
                    'config.json'.cyan +
                    ' file to make sure it\'s correct.'.red
                );
            }

            bundleTask = JspmAssembler.assemble(configuration.jspm, themePath);

            bundleTask(function () {
                console.log(ready);
            });

        } else {
            console.log(ready);
        }
    });
};

internals.implementation = function(JspmAssembler, ThemeConfig, dotStencilFilePath, url, token, port) {
    var dotStencilFile;
    var questions;

    if (Fs.existsSync(dotStencilFilePath)) {
        dotStencilFile = Fs.readFileSync(dotStencilFilePath, {encoding: 'utf-8'});
        try {
            dotStencilFile = jsonLint.parse(dotStencilFile, dotStencilFilePath);
        } catch (e) {
            return console.error(e.fileName, e.stack);
        }
    }

    questions = [
        {
            type: 'input',
            name: 'normalStoreUrl',
            message: 'What is the URL of your store\'s home page?',
            validate: function (val) {
                if (/^https?:\/\//.test(val)) {
                    return true;
                } else {
                    return 'You must enter a URL';
                }
            },
            default: url || dotStencilFile && dotStencilFile.normalStoreUrl || undefined,
        },
        {
            type: 'input',
            name: 'accessToken',
            message: 'What is your Stencil OAuth Access Token?',
            default: token || dotStencilFile && dotStencilFile.accessToken,
            filter: function(val) {
                return val.trim();
            },
        },
        {
            type: 'input',
            name: 'port',
            message: 'What port would you like to run the server on?',
            default: port || dotStencilFile && dotStencilFile.port || 3000,
            validate: function (val) {
                if (isNaN(val)) {
                    return 'You must enter an integer';
                } else if (val < 1024 || val > 65535) {
                    return 'The port number must be between 1025 and 65535';
                } else {
                    return true;
                }
            },
        },
    ];

    Inquirer.prompt(questions, function(answers) {
        internals.parseAnswers(JspmAssembler, ThemeConfig, dotStencilFile, dotStencilFilePath, answers);
    });
};

module.exports = internals.implementation;
