#!/usr/bin/env node
import 'colors';
import path from 'path';
import program from '../lib/commander.js';
import StencilContextAnalyzer from '../lib/StencilContextAnalyzer.js';
import { THEME_PATH, PACKAGE_INFO } from '../constants.js';
import { printCliResultErrorAndExit } from '../lib/cliCommon.js';

program
    .version(PACKAGE_INFO.version)
    .option(
        '-p, --path [path]',
        'path where to save the output file (default: ./stencil-context.json)',
        './stencil-context.json',
    )
    .parse(process.argv);
const cliOptions = program.opts();

new StencilContextAnalyzer(path.join(THEME_PATH, 'templates'))
    .analyzeAndExport(cliOptions.path)
    .catch(printCliResultErrorAndExit);
