'use strict';
const async = require('async');
let stencilPushUtils = require('./stencil-push.utils');
let stencilPullUtils = require('./stencil-pull.utils');
let stencilDownloadUtil = require('./stencil-download.utils');

module.exports = stencilDownload;

function stencilDownload(options, callback) {
    async.waterfall(
        [
            async.constant(options),
            stencilPushUtils.readStencilConfigFile,
            stencilPushUtils.getStoreHash,
            stencilPushUtils.getThemes,
            stencilPullUtils.selectActiveTheme,
            stencilPullUtils.startThemeDownloadJob,
            stencilPushUtils.pollForJobCompletion(({download_url: downloadUrl}) => ({downloadUrl})),
            stencilDownloadUtil.downloadThemeFiles,
        ], callback);
}
