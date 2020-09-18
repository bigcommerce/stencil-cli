#!/usr/bin/env node

require('colors');

const { DOT_STENCIL_FILE_PATH, PACKAGE_INFO, API_HOST } = require('../constants');
const program = require('../lib/commander');
const stencilPull = require('../lib/stencil-pull');
const versionCheck = require('../lib/version-check');
const { printCliResultError}  = require('../lib/cliCommon');

program
    .version(PACKAGE_INFO.version)
    .option('--host [hostname]', 'specify the api host', API_HOST)
    .option('--save [filename]', 'specify the filename to save the config as', 'config.json')
    .parse(process.argv);

if (!versionCheck()) {
    process.exit(2);
}

const cliOptions = program.opts();
const options = {
    dotStencilFilePath: DOT_STENCIL_FILE_PATH,
    apiHost: cliOptions.host || API_HOST,
    saveConfigName: cliOptions.save,
};

stencilPull(options, (err, result) => {
    if (err) {
        printCliResultError(err);
        return;
    }
    console.log('ok'.green + ` -- Pulled active theme config to ${result.saveConfigName}`);
});
