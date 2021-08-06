#!/usr/bin/env node

require('colors');
const StencilRelease = require('../lib/release/release');
const { PACKAGE_INFO } = require('../constants');
const program = require('../lib/commander');
const { checkNodeVersion } = require('../lib/cliCommon');
const { printCliResultErrorAndExit } = require('../lib/cliCommon');

program.version(PACKAGE_INFO.version).parse(process.argv);

checkNodeVersion();
new StencilRelease().run().catch(printCliResultErrorAndExit);
