import async from 'async';
import stencilPushUtils from './stencil-push.utils.js';
import stencilPullUtils from './stencil-pull.utils.js';
import stencilDownloadUtil from './stencil-download.utils.js';

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
export default stencilDownload;
