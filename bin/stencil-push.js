#!/usr/bin/env node

require('colors');
const { DOT_STENCIL_FILE_PATH, PACKAGE_INFO, API_HOST } = require('../constants');
const program = require('../lib/commander');
const stencilPush = require('../lib/stencil-push');
const versionCheck = require('../lib/version-check');
const themeApiClient = require('../lib/theme-api-client');

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
        console.log("\n\n" + 'not ok'.red + ` -- ${err} see details below:`);
        themeApiClient.printErrorMessages(err.messages);
        console.log('If this error persists, please visit https://github.com/bigcommerce/stencil-cli/issues and submit an issue.');
    } else {
        console.log('ok'.green + ` -- ${result}`);
    }
});
