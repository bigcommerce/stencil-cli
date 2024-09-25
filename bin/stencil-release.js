#!/usr/bin/env node
import 'colors';
import StencilRelease from '../lib/release/release.js';
import { PACKAGE_INFO } from '../constants.js';
import program from '../lib/commander.js';
import { checkNodeVersion, printCliResultErrorAndExit } from '../lib/cliCommon.js';

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
