#!/usr/bin/env node

require('colors');
const apiHost = 'https://api.bigcommerce.com';
const dotStencilFilePath = './.stencil';
const options = { dotStencilFilePath };
const pkg = require('../package.json');
const Program = require('commander');
const stencilDownload = require('../lib/stencil-download');
const versionCheck = require('../lib/version-check');
const themeApiClient = require('../lib/theme-api-client');
const inquirer = require('inquirer');

Program
    .version(pkg.version)
    .option('--host [hostname]', 'specify the api host', apiHost)
    .option('--file [filename]', 'specify the filename to download only')
    .option('--exclude [exclude]', 'specify a directory to exclude from download')
    .parse(process.argv);

if (!versionCheck()) {
    process.exit(2);
}

const overwriteType = Program.file ? Program.file : 'files';

Object.assign(options, {
    exclude: ['parsed', 'manifest.json'],
});

inquirer.prompt([{
    message: `${'Warning'.yellow} -- overwrite local with remote ${overwriteType}?`,
    name: 'overwrite',
    type: 'checkbox',
    choices: ['Yes', 'No'],
}], answers => {

    if (answers.overwrite.indexOf('Yes') > -1) {
        console.log(`${'ok'.green} -- ${overwriteType} will be overwritten by change`);

        if (Program.exclude) {
            options.exclude.push(Program.exclude);
        }

        stencilDownload(Object.assign({}, options, {
            apiHost: Program.host || apiHost,
            file: Program.file,
            // eslint-disable-next-line no-unused-vars
        }), (err, result) => {
            if (err) {
                console.log("\n\n" + 'not ok'.red + ` -- ${err} see details below:`);
                themeApiClient.printErrorMessages(err.messages);
                console.log('If this error persists, please visit https://github.com/bigcommerce/stencil-cli/issues and submit an issue.');
            } else {
                console.log('ok'.green + ` -- Theme file(s) updated from remote`);
            }
        });

    } else {
        console.log('Request cancelled by user '+ ('No'.red));
    }
});
