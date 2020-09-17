#!/usr/bin/env node

require('colors');

const program = require('../lib/commander');
const { THEME_PATH, PACKAGE_INFO } = require('../constants');
const ThemeConfig = require('../lib/theme-config');
const Bundle = require('../lib/stencil-bundle');
const versionCheck = require('../lib/version-check');

program
    .version(PACKAGE_INFO.version)
    .option('-d, --dest [dest]', 'Where to save the zip file. It defaults to the current directory you are in when bundling')
    .option('-n, --name  [filename]', 'What do you want to call the zip file. It defaults to stencil-bundle.zip')
    .option('-m, --marketplace', 'Runs extra bundle validations for partners who can create marketplace themes')
    .parse(process.argv);

const cliOptions = program.opts();
const themeConfig = ThemeConfig.getInstance(THEME_PATH);

if (!versionCheck()) {
    process.exit(2);
}

if (cliOptions.dest === true) {
    console.error('Error: You have to specify a value for -d or --dest'.red);
    process.exit(2);
}

if (cliOptions.name === true) {
    console.error('Error: You have to specify a value for -n or --name'.red);
    process.exit(2);
}

if (!themeConfig.configExists()) {
    console.error('Error: You must have a '.red + 'config.json'.cyan + ' file in your top level theme directory.');
    process.exit(2);
}

const rawConfig = themeConfig.getRawConfig();
const bundle = new Bundle(THEME_PATH, themeConfig, rawConfig, cliOptions);

bundle.initBundle((err, bundlePath) => {
    if (err) {
        throw err;
    }

    console.log(`Bundled saved to: ${bundlePath.cyan}`);
});
