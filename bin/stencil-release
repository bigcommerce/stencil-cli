#!/usr/bin/env node

require('colors');
const release = require('../lib/release/release');
const pkg = require('../package.json');
const Program = require('commander');
const versionCheck = require('../lib/version-check');

Program
    .version(pkg.version)
    .parse(process.argv);

if (!versionCheck()) {
    return;
}

release();
