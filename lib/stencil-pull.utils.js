const themeApiClient = require('./theme-api-client');

const utils = {};

utils.getChannelActiveTheme = async (options) => {
    const {
        config: { accessToken },
        apiHost,
        storeHash,
        channelId,
    } = options;

    const activeTheme = await themeApiClient.getChannelActiveTheme({
        accessToken,
        apiHost,
        storeHash,
        channelId,
    });

    console.log('ok'.green + ` -- Fetched theme details for channel ${channelId}`);

    return { ...options, activeTheme };
};

module.exports = utils;
