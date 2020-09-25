#!/usr/bin/env node

const program = require('../lib/commander');

const StencilInit = require('../lib/stencil-init');
const { DOT_STENCIL_FILE_PATH, PACKAGE_INFO } = require('../constants');
const versionCheck = require('../lib/version-check');

program
    .version(PACKAGE_INFO.version)
    .option('-u, --url [url]', 'Store URL')
    .option('-t, --token [token]', 'Access Token')
    .option('-p, --port [port]', 'Port')
    .parse(process.argv);

if (!versionCheck()) {
    process.exit(2);
}

const cliOptions = program.opts();

new StencilInit().run(DOT_STENCIL_FILE_PATH, 
    {
        normalStoreUrl: cliOptions.url,
        accessToken: cliOptions.token,
        port: cliOptions.port,
    });
