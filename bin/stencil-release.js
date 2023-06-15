#!/usr/bin/env node

require('colors');
const StencilRelease = require('../lib/release/release');
const { PACKAGE_INFO } = require('../constants');
const program = require('../lib/commander');
const { checkNodeVersion } = require('../lib/cliCommon');
const { printCliResultErrorAndExit } = require('../lib/cliCommon');

program
    .version(PACKAGE_INFO.version)
    .option('-b, --branch [name]', 'specify the main branch name')
    .parse(process.argv);

checkNodeVersion();

const cliOptions = program.opts();
const options = {
    branch: cliOptions.branch || 'master',
};

new StencilRelease().run(options).catch(printCliResultErrorAndExit);
