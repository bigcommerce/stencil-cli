#!/usr/bin/env node

require('colors');
const program = require('../lib/commander');

const ThemeConfig = require('../lib/theme-config');
const NodeSassAutoFixer = require('../lib/nodeSass/AutoFixer');
const { THEME_PATH, PACKAGE_INFO } = require('../constants');
const { printCliResultErrorAndExit } = require('../lib/cliCommon');

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
