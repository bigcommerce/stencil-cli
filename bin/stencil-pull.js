#!/usr/bin/env node
import 'colors';
import { PACKAGE_INFO } from '../constants.js';
import program from '../lib/commander.js';
import stencilPull from '../lib/stencil-pull.js';
import { prepareCommand, printCliResultErrorAndExit } from '../lib/cliCommon.js';

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
