#!/usr/bin/env node
import 'colors';
import program from '../lib/commander.js';
import { THEME_PATH, PACKAGE_INFO } from '../constants.js';
import ThemeConfig from '../lib/theme-config.js';
import Bundle from '../lib/stencil-bundle.js';
import { printCliResultErrorAndExit, prepareCommand } from '../lib/cliCommon.js';
import BuildConfigManager from '../lib/BuildConfigManager.js';

program
    .version(PACKAGE_INFO.version)
    .option(
        '-d, --dest [dest]',
        'Where to save the zip file. It defaults to the current directory you are in when bundling',
    )
    .option('-S, --source-maps', 'Include source-maps in the bundle. This is useful for debugging')
    .option(
        '-n, --name  [filename]',
        'What do you want to call the zip file. It defaults to stencil-bundle.zip',
    )
    .option(
        '-m, --marketplace',
        'Runs extra bundle validations for partners who can create marketplace themes',
    )
    .option(
        '-t, --timeout [timeout]',
        'Set a timeout for the bundle operation. Default is 20 secs',
        '60',
    );
const cliOptions = prepareCommand(program);
const themeConfig = ThemeConfig.getInstance(THEME_PATH);
async function run() {
    try {
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
        const timeout = cliOptions.timeout * 1000; // seconds
        const buildConfigManager = new BuildConfigManager({ timeout });
        await buildConfigManager.initConfig();
        const bundle = new Bundle(
            THEME_PATH,
            themeConfig,
            rawConfig,
            cliOptions,
            buildConfigManager,
        );
        const bundlePath = await bundle.initBundle();
        console.log(`Bundled saved to: ${bundlePath.cyan}`);
    } catch (err) {
        printCliResultErrorAndExit(err);
    }
}
run();
