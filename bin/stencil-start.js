#!/usr/bin/env node

require('colors');
const { PACKAGE_INFO } = require('../constants');
const program = require('../lib/commander');
const StencilStart = require('../lib/stencil-start');
const { printCliResultErrorAndExit } = require('../lib/cliCommon');
const BuildConfigManager = require('../lib/BuildConfigManager');

program
    .version(PACKAGE_INFO.version)
    .option('-o, --open', 'Automatically open default browser')
    .option('-v, --variation [name]', 'Set which theme variation to use while developing')
    .option('-c, --channelId [channelId]', 'Set the channel id for the storefront')
    .option('--host [hostname]', 'specify the api host')
    .option(
        '--tunnel [name]',
        'Create a tunnel URL which points to your local server that anyone can use.',
    )
    .option(
        '-n, --no-cache',
        'Turns off caching for API resource data per storefront page. The cache lasts for 5 minutes before automatically refreshing.',
    )
    .option('-t, --timeout', 'Set a timeout for the bundle operation. Default is 20 secs', '60')
    .parse(process.argv);

const cliOptions = program.opts();

const options = {
    open: cliOptions.open,
    variation: cliOptions.variation,
    channelId: cliOptions.channelId,
    apiHost: cliOptions.host,
    tunnel: cliOptions.tunnel,
    cache: cliOptions.cache,
};

const timeout = cliOptions.timeout * 1000; // seconds
const buildConfigManager = new BuildConfigManager({ timeout });
new StencilStart({ buildConfigManager }).run(options).catch(printCliResultErrorAndExit);
