#!/usr/bin/env node

require('colors');
const Bs = require('browser-sync').create();
const recursiveRead = require('recursive-readdir');
const Async = require('async');
const Wreck = require('wreck');
const Fs = require('fs');
const Path = require('path');
const Url = require('url');

const Cycles = require('../lib/cycles');
const templateAssembler = require('../lib/template-assembler');
const { PACKAGE_INFO, DOT_STENCIL_FILE_PATH, THEME_PATH } = require('../constants');
const program = require('../lib/commander');
const Server = require('../server');
const ThemeConfig = require('../lib/theme-config');
const BuildConfigManager = require('../lib/BuildConfigManager');
const jsonLint = require('../lib/json-lint');
const versionCheck = require('../lib/version-check');

program
    .version(PACKAGE_INFO.version)
    .option('-o, --open', 'Automatically open default browser')
    .option('-v, --variation [name]', 'Set which theme variation to use while developing')
    .option('--tunnel [name]', 'Create a tunnel URL which points to your local server that anyone can use.')
    .option('-n, --no-cache', 'Turns off caching for API resource data per storefront page. The cache lasts for 5 minutes before automatically refreshing.')
    .parse(process.argv);

const cliOptions = program.opts();
const templatePath = Path.join(THEME_PATH, 'templates');
const themeConfig = ThemeConfig.getInstance(THEME_PATH);

// tunnel value should be true/false or a string with name
// https://browsersync.io/docs/options#option-tunnel
const tunnel = typeof cliOptions.tunnel === 'string'
    ? cliOptions.tunnel
    : Boolean(cliOptions.tunnel); // convert undefined/true -> false/true

if (!versionCheck()) {
    process.exit(2);
}

if (!Fs.existsSync(DOT_STENCIL_FILE_PATH)) {
    console.error('Error: Please run'.red + ' $ stencil init'.cyan + ' first.'.red);
    process.exit(2);
}

if (!Fs.existsSync(themeConfig.configPath)) {
    console.error('Error: You must have a '.red + 'config.json'.cyan + ' file in your top level theme directory.');
    process.exit(2);
}

// If the value is true it means that no variation was passed in.
if (cliOptions.variation === true) {
    console.error('Error: You have to specify a value for -v or --variation'.red);
    process.exit(2);
}

if (cliOptions.variation) {
    try {
        themeConfig.setVariationByName(cliOptions.variation);
    } catch (err) {
        console.error('Error: The variation '.red + cliOptions.variation + ' does not exists in your config.json file'.red);
        process.exit(2);
    }
}

let dotStencilFile = Fs.readFileSync(DOT_STENCIL_FILE_PATH, { encoding: 'utf-8' });
try {
    dotStencilFile = jsonLint.parse(dotStencilFile, DOT_STENCIL_FILE_PATH);
} catch (e) {
    console.error(e.stack);
    process.exit(2);
}

let browserSyncPort = dotStencilFile.port;
let stencilServerPort = ++dotStencilFile.port;
if (!(dotStencilFile.normalStoreUrl) || !(dotStencilFile.customLayouts)) {
    console.error(
        'Error: Your stencil config is outdated. Please run'.red +
        ' $ stencil init'.cyan + ' again.'.red,
    );
    process.exit(2);
}

let staplerUrl;
const headers = {
    'stencil-cli': PACKAGE_INFO.version,
};
if (dotStencilFile.staplerUrl) {
    staplerUrl = dotStencilFile.staplerUrl;
    headers['stencil-store-url'] = dotStencilFile.normalStoreUrl;
} else {
    staplerUrl = dotStencilFile.normalStoreUrl;
}

Wreck.get(
    Url.resolve(staplerUrl, '/stencil-version-check?v=' + PACKAGE_INFO.version),
    {
        headers: headers,
        json: true,
        rejectUnauthorized: false,
    },
    function (err, res, payload) {
        if (err || !payload) {
            console.error(
                'The BigCommerce Store you are pointing to either does not exist or is not available at this time.'.red,
            );
        } else if (payload.error) {
            return console.error(payload.error.red);
        } else if (payload.status !== 'ok') {
            console.error(
                'Error: You are using an outdated version of stencil-cli, please run '.red +
                '$ npm install -g @bigcommerce/stencil-cli'.cyan,
            );
        } else {
            dotStencilFile.storeUrl = payload.sslUrl;
            dotStencilFile.normalStoreUrl = payload.baseUrl;
            dotStencilFile.stencilServerPort = stencilServerPort;

            return startServer();
        }
    },
);

/**
 * Starts up the local Stencil Server as well as starts up BrowserSync and sets some watch options.
 */
async function startServer() {
    await Server.create({
        dotStencilFile: dotStencilFile,
        variationIndex: themeConfig.variationIndex || 0,
        useCache: cliOptions.cache,
        themePath: THEME_PATH,
    });

    const buildConfigManger = new BuildConfigManager();
    let watchFiles = [
        '/assets',
        '/templates',
        '/lang',
        '/.config',
    ];
    let watchIgnored = [
        '/assets/scss',
        '/assets/css',
    ];

    // Display Set up information
    console.log(getStartUpInfo());

    // Watch sccs directory and automatically reload all css files if a file changes
    Bs.watch(Path.join(THEME_PATH, 'assets/scss'), event => {
        if (event === 'change') {
            Bs.reload('*.css');
        }
    });

    Bs.watch('config.json', event => {
        if (event === 'change') {
            themeConfig.resetVariationSettings();
            Bs.reload();
        }
    });

    Bs.watch('.config/storefront.json', (event, file) => {
        if (event === 'change') {
            console.log("storefront json changed");
            Bs.emitter.emit("storefront_config_file:changed", {
                event: event,
                path: file,
                namespace: "",
            });
            Bs.reload();
        }
    });

    Bs.watch(templatePath, {ignoreInitial: true}, () => {
        assembleTemplates(templatePath, (err, results) => {
            if (err) {
                return console.error(err);
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

    Bs.init({
        open: !!cliOptions.open,
        port: browserSyncPort,
        files: watchFiles.map(val => Path.join(THEME_PATH, val)),
        watchOptions: {
            ignoreInitial: true,
            ignored: watchIgnored.map(val => Path.join(THEME_PATH, val)),
        },
        proxy: "localhost:" + stencilServerPort,
        tunnel,
    });

    // Handle manual reloading of browsers by typing 'rs';
    // Borrowed from https://github.com/remy/nodemon
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', data => {
        data = (data + '').trim().toLowerCase();

        // if the keys entered match the restartable value, then restart!
        if (data === 'rs') {
            Bs.reload();
        }
    });

    if (buildConfigManger.development) {
        buildConfigManger.initWorker().development(Bs);
    }
}

/**
 * Assembles all the needed templates and resolves their partials.
 * @param {string} templatePath
 * @param {function} callback
 */
function assembleTemplates(templatePath, callback) {
    recursiveRead(templatePath, ['!*.html'], (err, files) => {
        files = files.map(function (file) {
            return file.replace(templatePath + Path.sep, '').replace('.html', '');
        });

        Async.map(files, templateAssembler.assemble.bind(null, templatePath), (err, results) => {
            if (err) {
                callback(err);
            }
            callback(null, results);
        });
    });
}

/**
 * Displays information about your environment and configuration.
 * @return {string}
 */
function getStartUpInfo() {
    let information = '\n';

    information += '-----------------Startup Information-------------\n'.gray;
    information += '\n';
    information += '.stencil location: ' + DOT_STENCIL_FILE_PATH.cyan + '\n';
    information += 'config.json location: ' + themeConfig.configPath.cyan + '\n';
    information += 'Store URL: ' + dotStencilFile.normalStoreUrl.cyan + '\n';

    if (dotStencilFile.staplerUrl) {
        information += 'Stapler URL: ' + staplerUrl.cyan + '\n';
    }

    information += 'SSL Store URL: ' + dotStencilFile.storeUrl.cyan + '\n';
    information += 'Node Version: ' + process.version.cyan + '\n';
    information += '\n';
    information += '-------------------------------------------------\n'.gray;

    return information;
}
