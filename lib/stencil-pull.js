'use strict';
const async = require('async');
let stencilPushUtils = require('./stencil-push.utils');
let stencilPullUtils = require('./stencil-pull.utils');

module.exports = stencilPull;

function stencilPull(options, callback) {
    options = options || {};
    async.waterfall([
        async.constant(options),
        stencilPushUtils.readStencilConfigFile,
        stencilPushUtils.getStoreHash,
        stencilPushUtils.getThemes,
        stencilPullUtils.selectActiveTheme,
        stencilPullUtils.startThemeDownloadJob,
        stencilPushUtils.pollForJobCompletion(({ download_url: downloadUrl }) => ({ downloadUrl })),
        stencilPullUtils.downloadThemeConfig,
    ], callback);
}
