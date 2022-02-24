require('colors');
const NetworkUtils = require('./utils/NetworkUtils');
const {
    renderedRegionsByPageTypeQuery,
    renderedRegionsByPageTypeAndEntityIdQuery,
} = require('./graphql/query');

const networkUtils = new NetworkUtils();

/**
 * @param {object} options
 * @param {string} options.accessToken
 * @param {string} options.storeUrl
 * @param {string} pageType
 * @returns {Promise<renderedRegions: array}>}
 */
async function getRenderedRegionsByPageType({ accessToken, storeUrl, pageType }) {
    try {
        const query = renderedRegionsByPageTypeQuery(pageType);

        const response = await networkUtils.sendApiRequest({
            url: `${storeUrl}/graphql`,
            headers: {
                'cache-control': 'no-cache',
                'content-type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            method: 'POST',
            data: JSON.stringify({
                query,
            }),
        });

        if (!response.data.data) {
            return { renderedRegions: [] };
        }
        const {
            site: {
                content: {
                    renderedRegionsByPageType: { regions },
                },
            },
        } = response.data.data;

        return { renderedRegions: regions };
    } catch (err) {
        throw new Error(`Could not fetch the rendered regions for this page type: ${err.message}`);
    }
}

/**
 * @param {object} options
 * @param {string} options.accessToken
 * @param {string} options.storeUrl
 * @param {string} pageType
 * @param {number} entityId
 * @returns {Promise<renderedRegions: array}>}
 */
async function getRenderedRegionsByPageTypeAndEntityId({
    accessToken,
    storeUrl,
    pageType,
    entityId,
}) {
    try {
        const query = renderedRegionsByPageTypeAndEntityIdQuery(pageType, entityId);

        const response = await networkUtils.sendApiRequest({
            url: `${storeUrl}/graphql`,
            headers: {
                'cache-control': 'no-cache',
                'content-type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            method: 'POST',
            data: JSON.stringify({
                query,
            }),
        });

        if (!response.data.data) {
            return { renderedRegions: [] };
        }
        const {
            site: {
                content: {
                    renderedRegionsByPageTypeAndEntityId: { regions },
                },
            },
        } = response.data.data;

        return {
            renderedRegions: regions,
        };
    } catch (err) {
        throw new Error(`Could not fetch the rendered regions for this page type: ${err.message}`);
    }
}

module.exports = {
    getRenderedRegionsByPageType,
    getRenderedRegionsByPageTypeAndEntityId,
};
