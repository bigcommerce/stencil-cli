require('colors');
const NetworkUtils = require('./utils/NetworkUtils');

const networkUtils = new NetworkUtils();

async function getStoreSettingsLocale({ apiHost, storeHash, accessToken }) {
    try {
        const response = await networkUtils.sendApiRequest({
            url: `${apiHost}/stores/${storeHash}/v3/settings/store/locale`,
            accessToken,
        });

        if (!response.data.data) {
            throw new Error('Received empty store locale in the server response'.red);
        } else if (!response.data.data.default_shopper_language) {
            throw new Error(
                'Received empty default_shopper_language field in the server response'.red,
            );
        } else if (!response.data.data.shopper_language_selection_method) {
            throw new Error(
                'Received empty shopper_language_selection_method field in the server response'.red,
            );
        }

        return response.data.data;
    } catch (err) {
        err.name = 'StoreSettingsLocaleError';
        throw err;
    }
}

module.exports = {
    getStoreSettingsLocale,
};
