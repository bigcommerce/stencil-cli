const schemaTranslations = require('../schemas/schemaTranslations.json');

class ValidatorSchemaTranslations {
    constructor() {
        this.trackedKeys = ['name', 'content', 'label', 'settings', 'options', 'group'];
        this.validationSchema = schemaTranslations;
        this.translations = {};
        this.schemaKeys = [];
        this.translationsKeys = [];
    }

    /**
     * Set schema.json
     * @param {array} schema
     */
    setSchema(schema) {
        this.getTranslatableStrings(schema);
    }

    /**
     * Set schemaTranslations.json
     * @param {object} translations
     */
    setTranslations(translations) {
        this.translations = translations;

        this.getTranslationsKeys();
    }

    /**
     * Set i18n key from a schema into keys array
     * @param {string} value
     */
    setSchemaKeys(value) {
        if (value && !this.schemaKeys.includes(value) && /^i18n\./.test(value)) {
            this.schemaKeys.push(value);
        }
    }

    /**
     * Get validation schema
     * @returns {object}
     */
    getValidationSchema() {
        return this.validationSchema;
    }

    /**
     * Get translations
     * @returns {array}
     */
    getTranslations() {
        return this.translations;
    }

    /**
     * Get i18n keys from translations
     * @returns {array}
     */
    getTranslationsKeys() {
        this.translationsKeys = Object.keys(this.translations);
    }

    /**
     * Get i18n keys from schema
     * @returns {array}
     */
    getSchemaKeys() {
        return this.schemaKeys;
    }

    /**
     * Get translatable strings
     * @param {object[]} schema
     */
    getTranslatableStrings(schema) {
        for (const element of schema) {
            for (const [key, value] of Object.entries(element)) {
                if (!this.trackedKeys.includes(key)) {
                    continue;
                }

                if (Array.isArray(value)) {
                    this.getTranslatableStrings(value);
                }

                this.setSchemaKeys(value);
            }
        }
    }

    /**
     * Find unused i18n keys in schemaTranslations
     * @returns {array}
     */
    findUnusedKeys() {
        return this.translationsKeys.filter((key) => {
            const translationRegex = /^i18n.RegionName.*?/g;
            const translationMatch = translationRegex.exec(key);
            if (translationMatch) {
                return false;
            }

            return !this.schemaKeys.includes(key);
        });
    }

    /**
     * Find missed i18n keys in schemaTranslations
     * @returns {array}
     */
    findMissedKeys() {
        return this.schemaKeys.filter((key) => !this.translationsKeys.includes(key));
    }
}

module.exports = ValidatorSchemaTranslations;
