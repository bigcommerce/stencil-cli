#!/usr/bin/env node

require('colors');
const { PACKAGE_INFO } = require('../constants');
const program = require('../lib/commander');
const StencilStart = require('../lib/stencil-start');
const { printCliResultErrorAndExit } = require('../lib/cliCommon');

program
    .version(PACKAGE_INFO.version)
    .option('-o, --open', 'Automatically open default browser')
    .option('-v, --variation [name]', 'Set which theme variation to use while developing')
    .option(
        '--tunnel [name]',
        'Create a tunnel URL which points to your local server that anyone can use.',
    )
    .option(
        '-n, --no-cache',
        'Turns off caching for API resource data per storefront page. The cache lasts for 5 minutes before automatically refreshing.',
    )
    .parse(process.argv);

new StencilStart().run(program.opts(), PACKAGE_INFO.version).catch(printCliResultErrorAndExit);
