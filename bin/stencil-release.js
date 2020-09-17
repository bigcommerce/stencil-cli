#!/usr/bin/env node

require('colors');
const release = require('../lib/release/release');
const pkg = require('../package.json');
const program = require('../lib/commander');
const versionCheck = require('../lib/version-check');

program
    .version(pkg.version)
    .parse(process.argv);

if (!versionCheck()) {
    process.exit(2);
}

release();
