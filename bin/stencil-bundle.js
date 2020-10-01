#!/usr/bin/env node

require('colors');

const program = require('../lib/commander');
const { THEME_PATH, PACKAGE_INFO } = require('../constants');
const ThemeConfig = require('../lib/theme-config');
const Bundle = require('../lib/stencil-bundle');
const { printCliResultErrorAndExit } = require('../lib/cliCommon');
const { checkNodeVersion } = require('../lib/cliCommon');

program
    .version(PACKAGE_INFO.version)
    .option(
        '-d, --dest [dest]',
        'Where to save the zip file. It defaults to the current directory you are in when bundling',
    )
    .option(
        '-n, --name  [filename]',
        'What do you want to call the zip file. It defaults to stencil-bundle.zip',
    )
    .option(
        '-m, --marketplace',
        'Runs extra bundle validations for partners who can create marketplace themes',
    )
    .parse(process.argv);

const cliOptions = program.opts();
const themeConfig = ThemeConfig.getInstance(THEME_PATH);

async function run() {
    try {
        checkNodeVersion();

        if (cliOptions.dest === true) {
            throw new Error('You have to specify a value for -d or --dest'.red);
        }

        if (cliOptions.name === true) {
            throw new Error('You have to specify a value for -n or --name'.red);
        }

        if (!themeConfig.configExists()) {
            throw new Error(
                `${
                    'You must have a '.red + 'config.json'.cyan
                } file in your top level theme directory.`,
            );
        }

        const rawConfig = await themeConfig.getRawConfig();
        const bundle = new Bundle(THEME_PATH, themeConfig, rawConfig, cliOptions);

        const bundlePath = await bundle.initBundle();

        console.log(`Bundled saved to: ${bundlePath.cyan}`);
    } catch (err) {
        printCliResultErrorAndExit(err);
    }
}

run();
