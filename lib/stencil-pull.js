import async from 'async';
import stencilPushUtils from './stencil-push.utils.js';
import stencilPullUtils from './stencil-pull.utils.js';

function stencilPull(options = {}, callback) {
    async.waterfall(
        [
            async.constant(options),
            stencilPushUtils.readStencilConfigFile,
            stencilPushUtils.getStoreHash,
            stencilPushUtils.getChannels,
            stencilPushUtils.promptUserForChannel,
            stencilPullUtils.getChannelActiveTheme,
            stencilPullUtils.getThemeConfiguration,
            stencilPullUtils.getCurrentVariation,
            stencilPullUtils.mergeThemeConfiguration,
        ],
        callback,
    );
}
export default stencilPull;
