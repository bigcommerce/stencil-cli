#!/usr/bin/env node

require('colors');

const { PACKAGE_INFO, API_HOST } = require('../constants');
const program = require('../lib/commander');
const StencilPull = require('../lib/stencil-pull');
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
    .option('-a, --activate [variationname]', 'specify the variation of the theme to activate')
    .parse(process.argv);

checkNodeVersion();

const cliOptions = program.opts();
const options = {
    apiHost: cliOptions.host || API_HOST,
    saveConfigName: cliOptions.filename,
    channelId: cliOptions.channel_id,
    saved: cliOptions.saved || false,
    applyTheme: true,
    activate: cliOptions.activate,
};

new StencilPull().run(options).catch(printCliResultErrorAndExit);
