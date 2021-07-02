/**
 * Recursively build a template with all include partials
 * @param {Object} templates
 * @param {string} currentPartial
 * @param {Object} [visited={}]
 * @returns {string}
 */
function buildTemplateIncludes(templates, currentPartial, visited = {}) {
    const includeRegex = /{{2}>\s*([_|\-|a-zA-Z0-9/]+)[^{]*?}{2}/g;

    // eslint-disable-next-line no-param-reassign
    visited[currentPartial] = true;

    return templates[currentPartial].replace(includeRegex, (_, partial) => {
        if (visited[partial]) {
            return '';
        }

        return buildTemplateIncludes(templates, partial, visited);
    });
}

/**
 * Insert all #partial blocks in the corresponding #block block
 * @param {string} template
 * @returns {string}
 */
function parsePartialBlocks(template) {
    const partialRegex = /{{2}\s*#partial\s+.*?["|']([\w-]+)["|'].*?}{2}([\s\S]*?){{2}\/partial}{2}?/g;
    const blockRegex = /{{2}\s*#block\s+.*?["|']([\w-]+)["|'].*?}{2}([\s\S]*?){{2}\/block}{2}?/g;
    const partials = {};

    const output = template.replace(partialRegex, (_, name, content) => {
        partials[name] = content;
        return '';
    });

    return output.replace(blockRegex, (_, name, content) => {
        return content + (partials[name] || '');
    });
}

/**
 * Replace all occurrences of dynamicComponent with the content of the partials
 * @param {Object} templates
 * @param {string} template
 * @returns {string}
 */
function parseDynamicComponents(templates, template) {
    const dynamicComponentRegex = /{{\s*?dynamicComponent\s*(?:'|")([_|\-|a-zA-Z0-9/]+)(?:'|").*?}}/g;

    return template.replace(dynamicComponentRegex, (_, path) => {
        // insert dynamic components in the template
        return Object.keys(templates)
            .sort()
            .reduce((acc, partial) => {
                return partial.startsWith(path) ? acc + templates[partial] : acc;
            }, '');
    });
}

/**
 * Builds a template with all include partials and include all dynamic components
 * @param {Object} templates
 * @param {string} page
 * @returns {string}
 */
function buildPageTemplate(templates, page) {
    let pageTemplate = buildTemplateIncludes(templates, page);
    pageTemplate = parsePartialBlocks(pageTemplate);
    pageTemplate = parseDynamicComponents(templates, pageTemplate);

    return pageTemplate;
}

/**
 * Returns a boolean if there are two regions with the same name
 * @param {Object} regions
 * @param {Object} regionData
 * @returns {boolean}
 */
function checkDuplicateRegionName(regions, regionData) {
    let result = false;
    const regionsArray = Array.from(regions);
    for (let i = 0; i < regionsArray.length; i += 1) {
        if (regionsArray[i].name === regionData.name) {
            result = true;
            break;
        }
    }

    return result;
}

/**
 * Parse a template content and return an array of unique region objects
 * @param {string} content
 * @returns {Array}
 */
function parseRegions(content) {
    const regionRegex = /{{3}\s*region\s+.*?name=["|']([\w-]+)["|'].*?}{3}?/g;
    const translationRegex = /{{3}.*?\stranslation=["|'](i18n.RegionName.([\w-])+)["|'].*?}{3}?/g;
    const regions = new Set();
    let regionMatch;
    const translationMatch = translationRegex.exec(content);

    // eslint-disable-next-line
    while ((regionMatch = regionRegex.exec(content))) {
        const regionData = {};
        // eslint-disable-next-line prefer-destructuring
        regionData.name = regionMatch[1];

        // If there is a translation match and regionName match is valid, add data to region
        if (translationMatch && regionMatch[1]) {
            // eslint-disable-next-line prefer-destructuring
            regionData.translation = translationMatch[1];
        }

        if (!checkDuplicateRegionName(regions, regionData)) {
            regions.add(regionData);
        }
    }
    const regionArray = Array.from(regions);

    return regionArray.map(({ name, translation }) => ({ name, translation }));
}

/**
 * Returns an object of regions for the manifest file
 * @param {Object} templates
 * @param {string} partials
 * @returns {Object}
 */
function fetchRegions(templates, partials) {
    const pages = partials.filter((partial) => partial.match(/^pages\//));
    const regions = {};

    pages.forEach((page) => {
        const template = buildPageTemplate(templates[page], page);

        regions[page] = parseRegions(template);
    });

    return regions;
}

module.exports = {
    fetchRegions,
    parseRegions,
};
