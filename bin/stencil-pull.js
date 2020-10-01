#!/usr/bin/env node

require('colors');

const { DOT_STENCIL_FILE_PATH, PACKAGE_INFO, API_HOST } = require('../constants');
const program = require('../lib/commander');
const stencilPull = require('../lib/stencil-pull');
const { checkNodeVersion } = require('../lib/cliCommon');
const { printCliResultErrorAndExit } = require('../lib/cliCommon');

program
    .version(PACKAGE_INFO.version)
    .option('-s, --saved', 'get the saved configuration instead of the active one')
    .option('-h, --host [hostname]', 'specify the api host', API_HOST)
    .option(
        '-f, --filename [filename]',
        'specify the filename to save the config as',
        'config.json',
    )
    .option(
        '-c, --channel_id [channelId]',
        'specify the channel ID of the storefront to pull configuration from',
        parseInt,
    )
    .parse(process.argv);

checkNodeVersion();

const cliOptions = program.opts();
const options = {
    dotStencilFilePath: DOT_STENCIL_FILE_PATH,
    apiHost: cliOptions.host || API_HOST,
    saveConfigName: cliOptions.filename,
    channelId: cliOptions.channel_id || 1,
    saved: cliOptions.saved || false,
};

stencilPull(options, (err) => {
    if (err) {
        printCliResultErrorAndExit(err);
    }
});
