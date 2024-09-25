#!/usr/bin/env node
import 'colors';
import program from '../lib/commander.js';
import StencilDebug from '../lib/StencilDebug.js';
import { PACKAGE_INFO } from '../constants.js';
import { printCliResultErrorAndExit } from '../lib/cliCommon.js';

program
    .version(PACKAGE_INFO.version)
    .option('-o, --output [filename]', 'If provided will write to file')
    .parse(process.argv);
const cliOptions = program.opts();
new StencilDebug().run(cliOptions).catch(printCliResultErrorAndExit);
