#!/usr/bin/env node

require('colors');
const { DOT_STENCIL_FILE_PATH, PACKAGE_INFO, API_HOST } = require('../constants');
const program = require('../lib/commander');
const stencilPush = require('../lib/stencil-push');
const versionCheck = require('../lib/version-check');
const { printCliResultErrorAndExit } = require('../lib/cliCommon');

program
    .version(PACKAGE_INFO.version)
    .option('--host [hostname]', 'specify the api host', API_HOST)
    .option('-f, --file [filename]', 'specify the filename of the bundle to upload')
    .option('-s, --save [filename]', 'specify the filename to save the bundle as')
    .option('-a, --activate [variationname]', 'specify the variation of the theme to activate')
    .option('-d, --delete', 'delete oldest private theme if upload limit reached')
    .parse(process.argv);

if (!versionCheck()) {
    process.exit(2);
}

const cliOptions = program.opts();
const options = {
    dotStencilFilePath: DOT_STENCIL_FILE_PATH,
    apiHost: cliOptions.host || API_HOST,
    bundleZipPath: cliOptions.file,
    activate: cliOptions.activate,
    saveBundleName: cliOptions.save,
    deleteOldest: cliOptions.delete,
};
stencilPush(options, (err, result) => {
    if (err) {
        printCliResultErrorAndExit(err);
    }
    console.log('ok'.green + ` -- ${result}`);
});
