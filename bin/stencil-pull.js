#!/usr/bin/env node

require('colors');

const pkg = require('../package.json');
const program = require('../lib/commander');
const stencilPull = require('../lib/stencil-pull');
const versionCheck = require('../lib/version-check');
const themeApiClient = require('../lib/theme-api-client');

const dotStencilFilePath = './.stencil';
const defaultApiHost = 'https://api.bigcommerce.com';

program
    .version(pkg.version)
    .option('--host [hostname]', 'specify the api host', defaultApiHost)
    .option('--save [filename]', 'specify the filename to save the config as', 'config.json')
    .parse(process.argv);

if (!versionCheck()) {
    process.exit(2);
}

const cliOptions = program.opts();
const options = {
    dotStencilFilePath,
    apiHost: cliOptions.host || defaultApiHost,
    saveConfigName: cliOptions.save,
};

stencilPull(options, (err, result) => {
    if (err) {
        console.log("\n\n" + 'not ok'.red + ` -- ${err} see details below:`);
        themeApiClient.printErrorMessages(err.messages);
        console.log('If this error persists, please visit https://github.com/bigcommerce/stencil-cli/issues and submit an issue.');
    } else {
        console.log('ok'.green + ` -- Pulled active theme config to ${result.saveConfigName}`);
    }
});
