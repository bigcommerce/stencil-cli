'use strict';
var Fs = require('fs');
var jsonLint = require('./jsonLint');
var Path = require('path');
var Inquirer = require('inquirer');
var themePath;
var configuration;
var internals = {};
var program;

internals.writeConfig = function (dotStencilFilePath, configuration, ThemeConfig, JspmAssembler) {
    Fs.writeFile(dotStencilFilePath, JSON.stringify(configuration, true, 2), function (err) {
        var ready = 'You are now ready to go! To start developing, run $ stencil start',
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

            bundleTask = JspmAssembler.assemble(
                {
                    bootstrap: configuration.jspm.dev.bootstrap
                },
                themePath
            );

            bundleTask(function () {
                console.log(ready);
            });

        } else {
            console.log(ready);
        }
    });
}

internals.parseAnswers = function(JspmAssembler, ThemeConfig, dotStencilFile, dotStencilFilePath, answers) {
    // preserve the staplerUrl
    if (dotStencilFile && dotStencilFile.staplerUrl) {
        answers.staplerUrl = dotStencilFile.staplerUrl;
    }

    // Check for custom layout configurations
    // If already set, do nothing otherwise write the empty configurations
    if (!dotStencilFile || dotStencilFile && !dotStencilFile.customLayouts) {
        answers.customLayouts = {
            'products': {},
            'search': {},
            'brands': {},
            'categories': {}
        };
    }
    internals.writeConfig(dotStencilFilePath, answers);
};

internals.parseUnattended = function (dotStencilFile, dotStencilFilePath, ThemeConfig, JspmAssembler, programOptions) {
    programOptions = programOptions || {};
    var answers = {
        normalStoreUrl: programOptions.storeUrl || dotStencilFile && dotStencilFile.normalStoreUrl,
        port: programOptions.port || dotStencilFile && dotStencilFile.port
    };

    if (dotStencilFile && dotStencilFile.staplerUrl) {
        answers.staplerUrl = dotStencilFile.staplerUrl;
    }

    if (!dotStencilFile || dotStencilFile && !dotStencilFile.customLayouts) {
        answers.customLayouts = {
            'products': {},
            'search': {},
            'brands': {},
            'categories': {}
        };
    } else {
        answers.customLayouts = dotStencilFile.customLayouts;
    }

    internals.writeConfig(dotStencilFilePath, answers, ThemeConfig, JspmAssembler);
};

internals.implementation = function(JspmAssembler, ThemeConfig, dotStencilFilePath, Program) {
    program = Program;
    themePath = Program.path || process.cwd();
    var dotStencilFile;
    var questions;

    if (Fs.existsSync(dotStencilFilePath)) {
        try {
            dotStencilFile = Fs.readFileSync(dotStencilFilePath, {encoding: 'utf-8'});
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
            default: dotStencilFile && dotStencilFile.normalStoreUrl || undefined
        },
        {
            type: 'input',
            name: 'port',
            message: 'What port would you like to run the server on?',
            default: dotStencilFile && dotStencilFile.port || 3000,
            validate: function (val) {
                if (isNaN(val)) {
                    return 'You must enter an integer';
                } else if (val < 1024 || val > 65535) {
                    return 'The port number must be between 1025 and 65535';
                } else {
                    return true;
                }
            }
        }
    ];

    if (!Program.path || !Program.port && !Program.storeUrl) {
        Inquirer.prompt(questions, function(answers) {
            internals.parseAnswers(JspmAssembler, ThemeConfig, dotStencilFile, dotStencilFilePath, answers);
        });
    } else {
        internals.parseUnattended(dotStencilFile, dotStencilFilePath, ThemeConfig, JspmAssembler, {
            port: Program.port,
            storeUrl: Program.storeUrl
        })
    }
};

module.exports = internals.implementation;
