import async from 'async';
import utils from './stencil-push.utils.js';

function stencilPush(options = {}, callback) {
    async.waterfall(
        [
            async.constant(options),
            utils.readStencilConfigFile,
            utils.getStoreHash,
            utils.getThemes,
            utils.generateBundle,
            utils.uploadBundle,
            utils.notifyUserOfThemeLimitReachedIfNecessary,
            utils.promptUserToDeleteThemesIfNecessary,
            utils.deleteThemesIfNecessary,
            utils.checkIfDeletionIsComplete(),
            utils.uploadBundleAgainIfNecessary,
            utils.notifyUserOfThemeUploadCompletion,
            utils.pollForJobCompletion((data) => ({ themeId: data.theme_id })),
            utils.promptUserWhetherToApplyTheme,
            utils.getChannels,
            utils.promptUserForChannels,
            utils.getVariations,
            utils.promptUserForVariation,
            utils.requestToApplyVariationWithRetrys(),
            utils.notifyUserOfCompletion,
        ],
        callback,
    );
}
export default stencilPush;
