#!/usr/bin/env node
import 'colors';
import { PACKAGE_INFO } from '../constants.js';
import program from '../lib/commander.js';
import stencilPush from '../lib/stencil-push.js';
import { prepareCommand, printCliResultErrorAndExit } from '../lib/cliCommon.js';

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
