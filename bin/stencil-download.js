#!/usr/bin/env node

require('colors');
const inquirer = require('inquirer');
const program = require('../lib/commander');
const { promisify } = require("util");

const pkg = require('../package.json');
const stencilDownload = require('../lib/stencil-download');
const versionCheck = require('../lib/version-check');
const themeApiClient = require('../lib/theme-api-client');

const defaultApiHost = 'https://api.bigcommerce.com';

program
    .version(pkg.version)
    .option('--host [hostname]', 'specify the api host', defaultApiHost)
    .option('--file [filename]', 'specify the filename to download only')
    .option('--exclude [exclude]', 'specify a directory to exclude from download')
    .parse(process.argv);

if (!versionCheck()) {
    process.exit(2);
}

const cliOptions = program.opts();
const extraExclude = cliOptions.exclude ? [cliOptions.exclude] : [];
const options = {
    dotStencilFilePath: './.stencil',
    exclude: ['parsed', 'manifest.json', ...extraExclude],
    apiHost: cliOptions.host || defaultApiHost,
    file: cliOptions.file,
};

run(options);

async function run (opts) {
    const overwriteType = opts.file ? opts.file : 'files';

    const answers = await inquirer.prompt([{
        message: `${'Warning'.yellow} -- overwrite local with remote ${overwriteType}?`,
        name: 'overwrite',
        type: 'checkbox',
        choices: ['Yes', 'No'],
    }]);

    if (!answers.overwrite.includes('Yes')) {
        console.log('Request cancelled by user '+ ('No'.red));
        return;
    }

    console.log(`${'ok'.green} -- ${overwriteType} will be overwritten by change`);

    try {
        await promisify(stencilDownload)(opts);
    } catch (err) {
        console.log("\n\n" + 'not ok'.red + ` -- ${err} see details below:`);
        themeApiClient.printErrorMessages(err.messages);
        console.log('If this error persists, please visit https://github.com/bigcommerce/stencil-cli/issues and submit an issue.');
        return;
    }

    console.log('ok'.green + ` -- Theme file(s) updated from remote`);
}
