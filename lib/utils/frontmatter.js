const frontmatterRegex = /---[\s\S]+?---/g;

/**
 *
 * @param {String} file
 * @returns {String|null}
 */
function getFrontmatterContent(file) {
    const frontmatterMatch = file.match(frontmatterRegex);
    return frontmatterMatch !== null ? frontmatterMatch[0] : null;
}

/**
 *
 * @param {String} frontmatter
 * @param {Object} settings
 * @returns {String}
 */
function interpolateThemeSettings(frontmatter, settings) {
    for (const [key, val] of Object.entries(settings)) {
        const regex = `{{\\s*?theme_settings\\.${key}\\s*?}}`;
        // eslint-disable-next-line no-param-reassign
        frontmatter = frontmatter.replace(new RegExp(regex, 'g'), val);
    }

    return frontmatter;
}

module.exports = {
    frontmatterRegex,
    getFrontmatterContent,
    interpolateThemeSettings,
};
