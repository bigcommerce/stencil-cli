#!/usr/bin/env node

require('colors');
const release = require('../lib/release/release');
const { PACKAGE_INFO } = require('../constants');
const program = require('../lib/commander');
const versionCheck = require('../lib/version-check');

program
    .version(PACKAGE_INFO.version)
    .parse(process.argv);

if (!versionCheck()) {
    process.exit(2);
}

release();
