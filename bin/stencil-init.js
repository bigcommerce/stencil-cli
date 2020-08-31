#!/usr/bin/env node

require('colors');
const Program = require('commander');
const _ = require('lodash');

const StencilInit = require('../lib/stencil-init');
const pkg = require('../package.json');
const versionCheck = require('../lib/version-check');

Program
    .version(pkg.version)
    .option('-u, --url [url]', 'Store URL')
    .option('-t, --token [token]', 'Access Token')
    .option('-p, --port [port]', 'Port')
    .parse(process.argv);

if (!versionCheck()) {
    process.exit(2);
}

const dotStencilFilePath = './.stencil';
const cliOptions = _.pick(Program, ['url', 'token', 'port']);

new StencilInit().run(dotStencilFilePath, cliOptions);
