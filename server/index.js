'use strict';

const Glue = require('@hapi/glue');
const _ = require('lodash');
const Url = require('url');
const manifest = require('./manifest');
const logo = require('./lib/show-logo');

require('colors');

function buildManifest (srcManifest, options) {
    const resManifest = _.cloneDeep(srcManifest);
    const pluginsByName =  resManifest.register.plugins;

    const parsedSecureUrl = Url.parse(options.dotStencilFile.storeUrl); //The url to a secure page (prompted as login page)
    const parsedNormalUrl = Url.parse(options.dotStencilFile.normalStoreUrl); //The host url of the homepage;

    resManifest.server.port = options.dotStencilFile.port;
    pluginsByName['./plugins/router/router.module'].storeUrl = parsedSecureUrl.protocol + '//' + parsedSecureUrl.host;
    pluginsByName['./plugins/router/router.module'].normalStoreUrl = parsedNormalUrl.protocol + '//' + parsedNormalUrl.host;
    pluginsByName['./plugins/router/router.module'].apiKey = options.dotStencilFile.apiKey;
    pluginsByName['./plugins/router/router.module'].port = options.dotStencilFile.port;
    pluginsByName['./plugins/router/router.module'].staplerUrl = options.dotStencilFile.staplerUrl;
    pluginsByName['./plugins/renderer/renderer.module'].useCache = options.useCache;
    pluginsByName['./plugins/renderer/renderer.module'].username = options.dotStencilFile.username;
    pluginsByName['./plugins/renderer/renderer.module'].token = options.dotStencilFile.token;
    pluginsByName['./plugins/renderer/renderer.module'].accessToken = options.dotStencilFile.accessToken;
    pluginsByName['./plugins/renderer/renderer.module'].customLayouts = options.dotStencilFile.customLayouts;
    pluginsByName['./plugins/renderer/renderer.module'].themePath = options.themePath;
    pluginsByName['./plugins/theme-assets/theme-assets.module'].themePath = options.themePath;

    resManifest.register.plugins = _.reduce(
        pluginsByName,
        (pluginsArr, options, plugin) => [...pluginsArr, { plugin, options }],
        [],
    );

    return resManifest;
}

async function create (options) {
    const serverManifest = buildManifest(manifest.get('/'), options);

    const server = await Glue.compose(serverManifest, {relativeTo: __dirname});
    await server.start();

    console.log(logo);

    return server;
}

module.exports = { create };
