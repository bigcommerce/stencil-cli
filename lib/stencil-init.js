'use strict';
const Fs = require('fs');
const Inquirer = require('inquirer');

const jsonLint = require('./json-lint');

async function performAnswers(stencilConfig, dotStencilFilePath, answers) {
    const performedStencilConfig = {
        customLayouts: {
            'brand': {},
            'category': {},
            'page': {},
            'product': {},
        },
        ...stencilConfig,
        ...answers,
    };

    Fs.writeFileSync(dotStencilFilePath, JSON.stringify(performedStencilConfig, null, 2));
}

async function run(dotStencilFilePath, url, token, port) {
    let stencilConfig = {};

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
            default: url || stencilConfig.normalStoreUrl,
        },
        {
            type: 'input',
            name: 'accessToken',
            message: 'What is your Stencil OAuth Access Token?',
            default: token || stencilConfig.accessToken,
            filter: function(val) {
                return val.trim();
            },
        },
        {
            type: 'input',
            name: 'port',
            message: 'What port would you like to run the server on?',
            default: port || stencilConfig.port || 3000,
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

    await performAnswers(stencilConfig, dotStencilFilePath, answers);

    console.log('You are now ready to go! To start developing, run $ ' + 'stencil start'.cyan);
}

module.exports = {
    performAnswers,
    run,
};
