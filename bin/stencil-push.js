#!/usr/bin/env node

require('colors');
const { PACKAGE_INFO, API_HOST } = require('../constants');
const program = require('../lib/commander');
const stencilPush = require('../lib/stencil-push');
const { checkNodeVersion } = require('../lib/cliCommon');
const { printCliResultErrorAndExit } = require('../lib/cliCommon');

program
    .version(PACKAGE_INFO.version)
    .option('--host [hostname]', 'specify the api host')
    .option('-f, --file [filename]', 'specify the filename of the bundle to upload')
    .option('-s, --save [filename]', 'specify the filename to save the bundle as')
    .option('-a, --activate [variationname]', 'specify the variation of the theme to activate')
    .option('-d, --delete', 'delete oldest private theme if upload limit reached')
    .option(
        '-c, --channel_id [channelId]',
        'specify the channel ID of the storefront to push the theme to',
        parseInt,
    )
    .parse(process.argv);

checkNodeVersion();

const cliOptions = program.opts();
const options = {
    apiHost: cliOptions.host || API_HOST,
    channelId: cliOptions.channel_id,
    bundleZipPath: cliOptions.file,
    activate: cliOptions.activate,
    saveBundleName: cliOptions.save,
    deleteOldest: cliOptions.delete,
};
stencilPush(options, (err, result) => {
    if (err) {
        printCliResultErrorAndExit(err);
    }
    console.log(`${'ok'.green} -- ${result}`);
});
