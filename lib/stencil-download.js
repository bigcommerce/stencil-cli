const async = require('async');
const stencilPushUtils = require('./stencil-push.utils');
const stencilPullUtils = require('./stencil-pull.utils');
const stencilDownloadUtil = require('./stencil-download.utils');

function stencilDownload(options) {
    return async.waterfall([
        async.constant(options),
        stencilPushUtils.readStencilConfigFile,
        stencilPushUtils.getStoreHash,
        stencilPushUtils.getChannels,
        stencilPushUtils.promptUserForChannel,
        stencilPullUtils.getChannelActiveTheme,
        stencilDownloadUtil.startThemeDownloadJob,
        stencilPushUtils.pollForJobCompletion(({ download_url: downloadUrl }) => ({ downloadUrl })),
        stencilDownloadUtil.downloadThemeFiles,
    ]);
}

module.exports = stencilDownload;
