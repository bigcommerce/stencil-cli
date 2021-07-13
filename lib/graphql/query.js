/**
 * @param {string} pageType
 * @returns {string}>}
 */

const renderedRegionsByPageTypeQuery = (pageType) =>
    `query {
          site {
            content {
              renderedRegionsByPageType(pageType: ${pageType}) {
                regions {
                  name
                  html
                }
              }
            }
          }
    }`;

/**
 * @param {string} pageType
 * @param {number} entityId
 * @returns {string}>}
 */
const renderedRegionsByPageTypeAndEntityIdQuery = (pageType, entityId) =>
    `query {
          site {
            content {
              renderedRegionsByPageTypeAndEntityId(entityPageType: ${pageType}, entityId: ${entityId}) {
                regions {
                  name
                  html
                }
              }
            }
          }
    }`;

module.exports = {
    renderedRegionsByPageTypeQuery,
    renderedRegionsByPageTypeAndEntityIdQuery,
};
