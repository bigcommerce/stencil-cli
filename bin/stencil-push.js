#!/usr/bin/env node

require('colors');
const { PACKAGE_INFO } = require('../constants');
const program = require('../lib/commander');
const stencilPush = require('../lib/stencil-push');
const { prepareCommand } = require('../lib/cliCommon');
const { printCliResultErrorAndExit } = require('../lib/cliCommon');

program
    .version(PACKAGE_INFO.version)
    .option('-f, --file [filename]', 'specify the filename of the bundle to upload')
    .option('-s, --save [filename]', 'specify the filename to save the bundle as')
    .option('-a, --activate [variationname]', 'specify the variation of the theme to activate')
    .option('-d, --delete', 'delete oldest private theme if upload limit reached')
    .option(
        '-c, --channel_ids <channelIds...>',
        'specify the channel IDs of the storefront to push the theme to',
    )
    .option('-allc, --all_channels', 'push a theme to all available channels');

const cliOptions = prepareCommand(program);
const options = {
    apiHost: cliOptions.host,
    channelIds: cliOptions.channel_ids,
    bundleZipPath: cliOptions.file,
    activate: cliOptions.activate,
    saveBundleName: cliOptions.save,
    deleteOldest: cliOptions.delete,
    allChannels: cliOptions.all_channels,
};
stencilPush(options, (err, result) => {
    if (err) {
        printCliResultErrorAndExit(err);
    }
    console.log(`${'ok'.green} -- ${result}`);
});
