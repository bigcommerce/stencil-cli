#!/usr/bin/env node
import 'colors';
import program from '../lib/commander.js';
import ThemeConfig from '../lib/theme-config.js';
import NodeSassAutoFixer from '../lib/nodeSass/AutoFixer.js';
import { THEME_PATH, PACKAGE_INFO } from '../constants.js';
import { printCliResultErrorAndExit } from '../lib/cliCommon.js';

program
    .version(PACKAGE_INFO.version)
    .option(
        '-d, --dry',
        'will not write any changes to the file system, instead it will print the changes to the console',
    )
    .parse(process.argv);
const cliOptions = program.opts();
const themeConfig = ThemeConfig.getInstance(THEME_PATH);
new NodeSassAutoFixer(THEME_PATH, themeConfig, cliOptions).run().catch(printCliResultErrorAndExit);
