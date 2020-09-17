#!/usr/bin/env node

const program = require('../lib/commander');

const StencilInit = require('../lib/stencil-init');
const pkg = require('../package.json');
const versionCheck = require('../lib/version-check');

program
    .version(pkg.version)
    .option('-u, --url [url]', 'Store URL')
    .option('-t, --token [token]', 'Access Token')
    .option('-p, --port [port]', 'Port')
    .parse(process.argv);

if (!versionCheck()) {
    process.exit(2);
}

const dotStencilFilePath = './.stencil';
const cliOptions = program.opts();

new StencilInit().run(dotStencilFilePath, cliOptions);
