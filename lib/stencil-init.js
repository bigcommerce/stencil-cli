'use strict';
const Fs = require('fs');
const { promisify } = require("util");
const Path = require('path');
const Inquirer = require('inquirer');
const hoek = require('hoek');

const jsonLint = require('./json-lint');
const themePath = process.cwd();

async function performAnswers(JspmAssembler, ThemeConfig, stencilConfig, dotStencilFilePath, answers) {
    // Check for custom layout configurations
    // If already set, do nothing otherwise write the empty configurations
    if (!stencilConfig || stencilConfig && !stencilConfig.customLayouts) {
        answers.customLayouts = {
            'brand': {},
            'category': {},
            'page': {},
            'product': {},
        };
    }

    const performedStencilConfig = stencilConfig ? hoek.applyToDefaults(stencilConfig, answers) : answers;

    Fs.writeFileSync(dotStencilFilePath, JSON.stringify(performedStencilConfig, null, 2));

    // bundle dev dependencies
    const themeConfig = ThemeConfig.getInstance(themePath).getConfig();
    if (themeConfig.jspm) {
        if (!Fs.existsSync(Path.join(themePath, themeConfig.jspm.jspm_packages_path))) {
            console.log('Error: The path you specified for your "jspm_packages" folder does not exist.'.red);
            return console.log(
                'Please check your '.red +
                'jspm.jspm_packages_path'.cyan +
                ' setting in your theme\'s '.red +
                'config.json'.cyan +
                ' file to make sure it\'s correct.'.red,
            );
        }

        const bundleTask = promisify(JspmAssembler.assemble.bind(JspmAssembler));
        await bundleTask(themeConfig.jspm, themePath);
    }
}

async function run(JspmAssembler, ThemeConfig, dotStencilFilePath, url, token, port) {
    let stencilConfig;

    if (Fs.existsSync(dotStencilFilePath)) {
        const dotStencilFile = Fs.readFileSync(dotStencilFilePath, { encoding: 'utf-8' });
        try {
            stencilConfig = jsonLint.parse(dotStencilFile, dotStencilFilePath);
        } catch (err) {
            console.error(
                'Detected a broken .stencil file: ',
                err,
                '\nThe file will be rewritten with your answers',
            );
        }
    }

    const questions = [
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
            default: url || stencilConfig && stencilConfig.normalStoreUrl || undefined,
        },
        {
            type: 'input',
            name: 'accessToken',
            message: 'What is your Stencil OAuth Access Token?',
            default: token || stencilConfig && stencilConfig.accessToken,
            filter: function(val) {
                return val.trim();
            },
        },
        {
            type: 'input',
            name: 'port',
            message: 'What port would you like to run the server on?',
            default: port || stencilConfig && stencilConfig.port || 3000,
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
    const answers = await Inquirer.prompt(questions);

    await performAnswers(JspmAssembler, ThemeConfig, stencilConfig, dotStencilFilePath, answers);

    console.log('You are now ready to go! To start developing, run $ ' + 'stencil start'.cyan);
}

module.exports = {
    performAnswers,
    run,
};
