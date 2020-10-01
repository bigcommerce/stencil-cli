#!/usr/bin/env node

require('colors');
const bs = require('browser-sync').create();
const recursiveRead = require('recursive-readdir');
const async = require('async');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const Cycles = require('../lib/Cycles');
const templateAssembler = require('../lib/template-assembler');
const { PACKAGE_INFO, DOT_STENCIL_FILE_PATH, THEME_PATH } = require('../constants');
const program = require('../lib/commander');
const Server = require('../server');
const ThemeConfig = require('../lib/theme-config');
const BuildConfigManager = require('../lib/BuildConfigManager');
const { parseJsonFile } = require('../lib/utils/fsUtils');
const { checkNodeVersion } = require('../lib/cliCommon');

program
    .version(PACKAGE_INFO.version)
    .option('-o, --open', 'Automatically open default browser')
    .option('-v, --variation [name]', 'Set which theme variation to use while developing')
    .option(
        '--tunnel [name]',
        'Create a tunnel URL which points to your local server that anyone can use.',
    )
    .option(
        '-n, --no-cache',
        'Turns off caching for API resource data per storefront page. The cache lasts for 5 minutes before automatically refreshing.',
    )
    .parse(process.argv);

const cliOptions = program.opts();
const templatePath = path.join(THEME_PATH, 'templates');
const themeConfig = ThemeConfig.getInstance(THEME_PATH);

// tunnel value should be true/false or a string with name
// https://browsersync.io/docs/options#option-tunnel
// convert undefined/true -> false/true
const tunnel =
    typeof cliOptions.tunnel === 'string' ? cliOptions.tunnel : Boolean(cliOptions.tunnel);

checkNodeVersion();

if (!fs.existsSync(DOT_STENCIL_FILE_PATH)) {
    throw new Error('Please run'.red + ' $ stencil init'.cyan + ' first.'.red);
}

if (!fs.existsSync(themeConfig.configPath)) {
    throw new Error(
        `${'You must have a '.red + 'config.json'.cyan} file in your top level theme directory.`,
    );
}

// If the value is true it means that no variation was passed in.
if (cliOptions.variation === true) {
    throw new Error('You have to specify a value for -v or --variation'.red);
}

if (cliOptions.variation) {
    try {
        themeConfig.setVariationByName(cliOptions.variation);
    } catch (err) {
        throw new Error(
            'Error: The variation '.red +
                cliOptions.variation +
                ' does not exists in your config.json file'.red,
        );
    }
}

const dotStencilFile = parseJsonFile(DOT_STENCIL_FILE_PATH);
const browserSyncPort = dotStencilFile.port;
dotStencilFile.port = Number(dotStencilFile.port) + 1;

if (!dotStencilFile.normalStoreUrl || !dotStencilFile.customLayouts) {
    throw new Error(
        'Error: Your stencil config is outdated. Please run'.red +
            ' $ stencil init'.cyan +
            ' again.'.red,
    );
}

/**
 *
 * @param {object} stencilConfig
 * @param {string} currentCliVersion
 * @returns {Promise<object>}
 */
async function runAPICheck(stencilConfig, currentCliVersion) {
    const staplerUrl = stencilConfig.staplerUrl
        ? stencilConfig.staplerUrl
        : stencilConfig.normalStoreUrl;
    const reqUrl = new URL(`/stencil-version-check?v=${currentCliVersion}`, staplerUrl);
    let payload;

    const headers = {
        'stencil-cli': currentCliVersion,
    };
    if (stencilConfig.staplerUrl) {
        headers['stencil-store-url'] = stencilConfig.normalStoreUrl;
    }

    try {
        const response = await fetch(reqUrl, { headers });
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        payload = await response.json();
        if (!payload) {
            throw new Error('Empty payload in the server response');
        }
    } catch (err) {
        throw new Error(
            'The BigCommerce Store you are pointing to either does not exist or is not available at this time.'
                .red +
                '\nError details:\n' +
                err.message,
        );
    }
    if (payload.error) {
        throw new Error(payload.error.red);
    }
    if (payload.status !== 'ok') {
        throw new Error(
            'Error: You are using an outdated version of stencil-cli, please run '.red +
                '$ npm install -g @bigcommerce/stencil-cli'.cyan,
        );
    }
    return payload;
}

/**
 * Assembles all the needed templates and resolves their partials.
 * @param {string} templatesPath
 * @param {function} callback
 */
function assembleTemplates(templatesPath, callback) {
    recursiveRead(templatesPath, ['!*.html'], (err, files) => {
        const templateNames = files.map((file) =>
            file.replace(templatesPath + templatesPath.sep, '').replace('.html', ''),
        );

        async.map(
            templateNames,
            templateAssembler.assemble.bind(null, templatesPath),
            (err2, results) => {
                if (err2) {
                    callback(err2);
                }
                callback(null, results);
            },
        );
    });
}

/**
 * Displays information about your environment and configuration.
 * @returns {string}
 */
function getStartUpInfo() {
    let information = '\n';

    information += '-----------------Startup Information-------------\n'.gray;
    information += '\n';
    information += `.stencil location: ${DOT_STENCIL_FILE_PATH.cyan}\n`;
    information += `config.json location: ${themeConfig.configPath.cyan}\n`;
    information += `Store URL: ${dotStencilFile.normalStoreUrl.cyan}\n`;

    if (dotStencilFile.staplerUrl) {
        information += `Stapler URL: ${dotStencilFile.staplerUrl.cyan}\n`;
    }

    information += `SSL Store URL: ${dotStencilFile.storeUrl.cyan}\n`;
    information += `Node Version: ${process.version.cyan}\n`;
    information += '\n';
    information += '-------------------------------------------------\n'.gray;

    return information;
}

/**
 * Starts up the local Stencil Server as well as starts up BrowserSync and sets some watch options.
 */
async function startServer() {
    await Server.create({
        dotStencilFile,
        variationIndex: themeConfig.variationIndex || 0,
        useCache: cliOptions.cache,
        themePath: THEME_PATH,
    });

    const buildConfigManger = new BuildConfigManager();
    let watchFiles = ['/assets', '/templates', '/lang', '/.config'];
    let watchIgnored = ['/assets/scss', '/assets/css'];

    // Display Set up information
    console.log(getStartUpInfo());

    // Watch sccs directory and automatically reload all css files if a file changes
    bs.watch(path.join(THEME_PATH, 'assets/scss'), (event) => {
        if (event === 'change') {
            bs.reload('*.css');
        }
    });

    bs.watch('config.json', (event) => {
        if (event === 'change') {
            themeConfig.resetVariationSettings();
            bs.reload();
        }
    });

    bs.watch('.config/storefront.json', (event, file) => {
        if (event === 'change') {
            console.log('storefront json changed');
            bs.emitter.emit('storefront_config_file:changed', {
                event,
                path: file,
                namespace: '',
            });
            bs.reload();
        }
    });

    bs.watch(templatePath, { ignoreInitial: true }, () => {
        assembleTemplates(templatePath, (err, results) => {
            if (err) {
                console.error(err);
                return;
            }

            try {
                new Cycles(results).detect();
            } catch (e) {
                console.error(e);
            }
        });
    });

    if (buildConfigManger.watchOptions && buildConfigManger.watchOptions.files) {
        watchFiles = buildConfigManger.watchOptions.files;
    }

    if (buildConfigManger.watchOptions && buildConfigManger.watchOptions.ignored) {
        watchIgnored = buildConfigManger.watchOptions.ignored;
    }

    bs.init({
        open: !!cliOptions.open,
        port: browserSyncPort,
        files: watchFiles.map((val) => path.join(THEME_PATH, val)),
        watchOptions: {
            ignoreInitial: true,
            ignored: watchIgnored.map((val) => path.join(THEME_PATH, val)),
        },
        proxy: `localhost:${dotStencilFile.port}`,
        tunnel,
    });

    // Handle manual reloading of browsers by typing 'rs';
    // Borrowed from https://github.com/remy/nodemon
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (data) => {
        const normalizedData = `${data}`.trim().toLowerCase();

        // if the keys entered match the restartable value, then restart!
        if (normalizedData === 'rs') {
            bs.reload();
        }
    });

    if (buildConfigManger.development) {
        buildConfigManger.initWorker().development(bs);
    }
}

async function run() {
    try {
        const storeInfoFromAPI = await runAPICheck(dotStencilFile, PACKAGE_INFO.version);
        dotStencilFile.storeUrl = storeInfoFromAPI.sslUrl;
        dotStencilFile.normalStoreUrl = storeInfoFromAPI.baseUrl;

        await startServer();
    } catch (err) {
        console.error(err.message);
    }
}

run();
