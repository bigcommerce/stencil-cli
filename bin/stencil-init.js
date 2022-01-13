#!/usr/bin/env node

const program = require('../lib/commander');

const StencilInit = require('../lib/stencil-init');
const { PACKAGE_INFO } = require('../constants');
const { checkNodeVersion, printCliResultErrorAndExit } = require('../lib/cliCommon');

program
    .version(PACKAGE_INFO.version)
    .option('-u, --url [url]', 'Store URL')
    .option('-t, --token [token]', 'Access Token')
    .option('-p, --port [port]', 'Port')
    .option('-h, --apiHost [host]', 'API Host')
    .parse(process.argv);

checkNodeVersion();

const cliOptions = program.opts();

new StencilInit()
    .run({
        normalStoreUrl: cliOptions.url,
        accessToken: cliOptions.token,
        port: cliOptions.port,
        apiHost: cliOptions.apiHost,
    })
    .catch(printCliResultErrorAndExit);
