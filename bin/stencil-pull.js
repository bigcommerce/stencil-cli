#!/usr/bin/env node

require('colors');

const { PACKAGE_INFO } = require('../constants');
const program = require('../lib/commander');
const stencilPull = require('../lib/stencil-pull');
const { prepareCommand } = require('../lib/cliCommon');
const { printCliResultErrorAndExit } = require('../lib/cliCommon');

program
    .version(PACKAGE_INFO.version)
    .option('-s, --saved', 'get the saved configuration instead of the active one')
    .option(
        '-f, --filename [filename]',
        'specify the filename to save the config as',
        'config.json',
    )
    .option(
        '-c, --channel_id [channelId]',
        'specify the channel ID of the storefront to pull configuration from',
        parseInt,
    );

const cliOptions = prepareCommand(program);

const options = {
    apiHost: cliOptions.host,
    saveConfigName: cliOptions.filename,
    channelId: cliOptions.channel_id,
    saved: cliOptions.saved || false,
    applyTheme: true, // fix to be compatible with stencil-push.utils
};

stencilPull(options, (err) => {
    if (err) {
        printCliResultErrorAndExit(err);
    }
});
