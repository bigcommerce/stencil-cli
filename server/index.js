import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Glue from '@hapi/glue';
import * as _ from 'lodash-es';
import * as manifest from './manifest.js';
import logo from './lib/show-logo.js';
import 'colors';

const getDirname = dirname(fileURLToPath(import.meta.url));

function buildManifest(srcManifest, options) {
    const resManifest = _.cloneDeep(srcManifest);
    const pluginsByName = resManifest.register.plugins;
    const parsedSecureUrl = new URL(options.dotStencilFile.storeUrl); // The url to a secure page (prompted as login page)
    const parsedNormalUrl = new URL(options.dotStencilFile.normalStoreUrl); // The host url of the homepage;
    const storeUrl = parsedSecureUrl.protocol + '//' + parsedSecureUrl.host;
    resManifest.server.port = parseInt(options.dotStencilFile.port, 10) + 1;
    pluginsByName['./plugins/router/router.module.js'].storeUrl = storeUrl;
    pluginsByName['./plugins/router/router.module.js'].normalStoreUrl =
        parsedNormalUrl.protocol + '//' + parsedNormalUrl.host;
    pluginsByName['./plugins/router/router.module.js'].apiKey = options.dotStencilFile.apiKey;
    pluginsByName['./plugins/router/router.module.js'].port = options.dotStencilFile.port;
    pluginsByName['./plugins/router/router.module.js'].stencilCliVersion =
        options.stencilCliVersion;
    pluginsByName['./plugins/router/router.module.js'].accessToken =
        options.dotStencilFile.accessToken;
    pluginsByName['./plugins/renderer/renderer.module.js'].useCache = options.useCache;
    pluginsByName['./plugins/renderer/renderer.module.js'].username =
        options.dotStencilFile.username;
    pluginsByName['./plugins/renderer/renderer.module.js'].token = options.dotStencilFile.token;
    pluginsByName['./plugins/renderer/renderer.module.js'].accessToken =
        options.dotStencilFile.accessToken;
    pluginsByName['./plugins/renderer/renderer.module.js'].customLayouts =
        options.dotStencilFile.customLayouts;
    pluginsByName['./plugins/renderer/renderer.module.js'].themePath = options.themePath;
    pluginsByName['./plugins/renderer/renderer.module.js'].storeUrl = storeUrl;
    pluginsByName['./plugins/renderer/renderer.module.js'].storeSettingsLocale =
        options.storeSettingsLocale;
    pluginsByName['./plugins/theme-assets/theme-assets.module.js'].themePath = options.themePath;
    resManifest.register.plugins = _.reduce(
        pluginsByName,
        (pluginsArr, opts, plugin) => [...pluginsArr, { plugin, options: opts }],
        [],
    );
    return resManifest;
}
async function create(options) {
    const serverManifest = buildManifest(manifest.get('/'), options);
    const server = await Glue.compose(serverManifest, { relativeTo: getDirname });
    await server.start();

    console.log(logo);

    return server;
}
export default {
    create,
};
