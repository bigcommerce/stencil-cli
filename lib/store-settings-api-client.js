import 'colors';
import NetworkUtils from './utils/NetworkUtils.js';

const networkUtils = new NetworkUtils();

async function getStoreSettingsLocaleWithChannel({ apiHost, storeHash, accessToken, channelId }) {
    let url = `${apiHost}/stores/${storeHash}/v3/settings/store/locale`;
    if (channelId) {
        url += `?channel_id=${channelId}`;
    }
    const response = await networkUtils.sendApiRequest({
        url,
        accessToken,
    });

    return response.data.data;
}

async function getStoreSettingsLocale({ apiHost, storeHash, accessToken, channelId }) {
    try {
        let data = await getStoreSettingsLocaleWithChannel({
            apiHost,
            storeHash,
            accessToken,
            channelId,
        });
        // if no data available for the channel provided, default to global setting.
        if (!data) {
            data = await getStoreSettingsLocaleWithChannel({ apiHost, storeHash, accessToken });
        }
        if (!data) {
            throw new Error('Received empty store locale in the server response'.red);
        } else if (!data.default_shopper_language) {
            throw new Error(
                'Received empty default_shopper_language field in the server response'.red,
            );
        } else if (!data.shopper_language_selection_method) {
            throw new Error(
                'Received empty shopper_language_selection_method field in the server response'.red,
            );
        }
        return data;
    } catch (err) {
        err.name = 'StoreSettingsLocaleError';
        throw err;
    }
}

export { getStoreSettingsLocale };
export default {
    getStoreSettingsLocale,
};
