import NetworkUtils from './utils/NetworkUtils.js';

const defaultNetworkUtils = new NetworkUtils();
const HEALTH_PATH = '/api/makeswift/proxy-health';
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Checks if the storefront host is routed through the Makeswift proxy worker.
 *
 * @param {object} options
 * @param {string} options.storeUrl
 * @param {object} [deps]
 * @returns {Promise<boolean>}
 */
async function isMakeswiftProxyActive({ storeUrl }, { networkUtils = defaultNetworkUtils } = {}) {
    try {
        const response = await networkUtils.sendApiRequest({
            url: new URL(HEALTH_PATH, storeUrl).toString(),
            timeout: REQUEST_TIMEOUT_MS,
            // The preview session uses this host, so a redirect to another host does not count.
            maxRedirects: 0,
            responseType: 'text',
        });
        return response?.status === 200 && String(response.data).trim() === 'OK';
    } catch {
        return false;
    }
}

export { isMakeswiftProxyActive };
export default {
    isMakeswiftProxyActive,
};
