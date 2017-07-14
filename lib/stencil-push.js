'use strict';
const async = require('async');
let utils = require('./stencil-push.utils');

module.exports = stencilPush;

function stencilPush(options, callback) {
    options = options || {};
    async.waterfall([
        async.constant(options),
        utils.readStencilConfigFile,
        utils.getStoreHash,
        utils.getThemes,
        utils.generateBundle,
        utils.uploadBundle,
        utils.notifyUserOfThemeLimitReachedIfNecessary,
        utils.promptUserToDeleteThemesIfNecessary,
        utils.deleteThemesIfNecessary,
        utils.uploadBundleAgainIfNecessary,
        utils.notifyUserOfThemeUploadCompletion,
        utils.pollForJobCompletion(),
        utils.promptUserWhetherToApplyTheme,
        utils.getVariations,
        utils.promptUserForVariation,
        utils.requestToApplyVariationWithRetrys(),
        utils.notifyUserOfCompletion,
    ], callback);
}
