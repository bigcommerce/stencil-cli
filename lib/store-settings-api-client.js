require('colors');
const NetworkUtils = require('./utils/NetworkUtils');

const networkUtils = new NetworkUtils();

async function getDefaultShopperLanguage({ apiHost, storeHash, accessToken }) {
    try {
        const response = await networkUtils.sendApiRequest({
            url: `${apiHost}/stores/${storeHash}/v3/settings/store/locale`,
            accessToken,
        });
        if (!response.data.data || !response.data.data.default_shopper_language) {
            throw new Error(
                'Received empty default_shopper_language value in the server response'.red,
            );
        }
        return response.data.data.default_shopper_language;
    } catch (err) {
        err.name = 'DefaultShopperLanguageError';
        throw err;
    }
}

module.exports = {
    getDefaultShopperLanguage,
};
