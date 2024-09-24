#!/usr/bin/env node
import 'colors';
import { PACKAGE_INFO } from '../constants.js';
import program from '../lib/commander.js';
import StencilStart from '../lib/stencil-start.js';
import { printCliResultErrorAndExit, prepareCommand } from '../lib/cliCommon.js';
import BuildConfigManager from '../lib/BuildConfigManager.js';

program
    .version(PACKAGE_INFO.version)
    .option('-o, --open', 'Automatically open default browser')
    .option('-v, --variation [name]', 'Set which theme variation to use while developing')
    .option('-c, --channelId [channelId]', 'Set the channel id for the storefront')
    .option(
        '--tunnel [name]',
        'Create a tunnel URL which points to your local server that anyone can use.',
    )
    .option(
        '-n, --no-cache',
        'Turns off caching for API resource data per storefront page. The cache lasts for 5 minutes before automatically refreshing.',
    )
    .option('-t, --timeout', 'Set a timeout for the bundle operation. Default is 20 secs', '60');
const cliOptions = prepareCommand(program);
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
