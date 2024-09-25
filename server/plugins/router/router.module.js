import { defaultsDeep } from 'lodash-es';
import ThemeConfig from '../../../lib/theme-config.js';

const internals = {
    options: {
        storeUrl: '',
        apiKey: '',
        port: '',
        channelId: null,
    },
    paths: {
        renderer: '/{url*}',
        staticAssets: '/assets/{path*}',
        internalApi: '/internalapi/{path*}',
        storefrontAPI: '/api/storefront/{path*}',
        cdnAssets: '/stencil/{versionId}/{fileName*}',
        cssFiles: '/stencil/{versionId}/css/{fileName}.css',
        favicon: '/favicon.ico',
        graphQL: '/graphql',
    },
};
function mapUri(req) {
    const host = `https://${internals.options.storeUrl.replace(/http[s]?:\/\//, '')}`;
    const urlParams = req.url.search || '';
    const uri = `${host}${req.path}${urlParams}`;
    const headers = {
        'stencil-cli': internals.options.stencilCliVersion,
        'x-auth-token': internals.options.accessToken,
    };
    return { uri, headers };
}
function register(server, options) {
    internals.options = defaultsDeep(options, internals.options);
    server.ext('onRequest', (request, h) => {
        request.app.storeUrl = internals.options.storeUrl;
        request.app.normalStoreUrl = internals.options.normalStoreUrl;
        request.app.apiKey = internals.options.apiKey;
        request.app.themeConfig = ThemeConfig.getInstance();
        return h.continue;
    });
    server.dependency(
        ['@hapi/inert', '@hapi/h2o2', 'Renderer', 'ThemeAssets'],
        internals.registerRoutes,
    );
}
internals.registerRoutes = (server) => {
    server.route([
        {
            method: 'GET',
            path: internals.paths.renderer,
            options: {
                cors: true,
                state: {
                    failAction: 'log',
                },
            },
            handler: server.plugins.Renderer.implementation,
        },
        {
            method: ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            path: internals.paths.renderer,
            options: {
                cors: true,
                payload: {
                    output: 'stream',
                    parse: false,
                    maxBytes: 20971520, // 20MB
                },
                state: {
                    failAction: 'log',
                },
            },
            handler: server.plugins.Renderer.implementation,
        },
        {
            method: 'GET',
            path: internals.paths.cdnAssets,
            handler: server.plugins.ThemeAssets.assetHandler,
            options: {
                state: {
                    failAction: 'log',
                },
            },
        },
        {
            method: 'GET',
            path: internals.paths.staticAssets,
            handler: {
                directory: {
                    path: './assets',
                },
            },
            options: {
                state: {
                    failAction: 'log',
                },
            },
        },
        {
            method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            path: internals.paths.internalApi,
            handler: {
                proxy: {
                    mapUri,
                    rejectUnauthorized: false,
                    passThrough: true,
                },
            },
            options: {
                state: {
                    failAction: 'log',
                },
            },
        },
        {
            method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            path: internals.paths.storefrontAPI,
            handler: {
                proxy: {
                    mapUri,
                    rejectUnauthorized: false,
                    passThrough: true,
                },
            },
            options: {
                state: {
                    failAction: 'log',
                },
            },
        },
        {
            method: 'GET',
            path: internals.paths.favicon,
            handler: {
                file: './assets/favicon.ico',
            },
            options: {
                state: {
                    failAction: 'log',
                },
            },
        },
        {
            method: 'GET',
            path: internals.paths.cssFiles,
            handler: server.plugins.ThemeAssets.cssHandler,
            options: {
                state: {
                    failAction: 'log',
                },
            },
        },
        {
            method: ['GET', 'POST'],
            path: internals.paths.graphQL,
            handler: {
                proxy: {
                    mapUri: (req) => ({
                        uri: `${internals.options.storeUrl}${req.path}`,
                        // Note, that we should modify the original req.headers to make it work
                        headers: Object.assign(
                            // Add 'origin' and 'host' headers to request before proxying
                            req.headers,
                            {
                                origin: internals.options.storeUrl,
                                host: internals.options.storeUrl.replace(/http[s]?:\/\//, ''),
                                'stencil-cli': internals.options.stencilCliVersion,
                                'x-auth-token': internals.options.accessToken,
                            },
                        ),
                    }),
                    rejectUnauthorized: false,
                    passThrough: true,
                },
            },
            options: {
                state: {
                    failAction: 'log',
                },
            },
        },
    ]);
};
export const name = 'Router';
export const version = '0.0.1';
export { register };
export default {
    register,
    name,
    version,
};
