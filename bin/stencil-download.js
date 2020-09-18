#!/usr/bin/env node

require('colors');
const inquirer = require('inquirer');
const program = require('../lib/commander');
const { promisify } = require("util");

const { API_HOST, PACKAGE_INFO, DOT_STENCIL_FILE_PATH } = require('../constants');
const stencilDownload = require('../lib/stencil-download');
const versionCheck = require('../lib/version-check');
const { printCliResultError } = require('../lib/cliCommon');

program
    .version(PACKAGE_INFO.version)
    .option('--host [hostname]', 'specify the api host', API_HOST)
    .option('--file [filename]', 'specify the filename to download only')
    .option('--exclude [exclude]', 'specify a directory to exclude from download')
    .parse(process.argv);

if (!versionCheck()) {
    process.exit(2);
}

const cliOptions = program.opts();
const extraExclude = cliOptions.exclude ? [cliOptions.exclude] : [];
const options = {
    dotStencilFilePath: DOT_STENCIL_FILE_PATH,
    exclude: ['parsed', 'manifest.json', ...extraExclude],
    apiHost: cliOptions.host || API_HOST,
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
        printCliResultError(err);
        return;
    }

    console.log('ok'.green + ` -- Theme file(s) updated from remote`);
}
