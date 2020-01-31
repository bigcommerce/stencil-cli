class ValidatorSchemaTranslations {
    constructor() {
        this.trackedKeys = ['name', 'content', 'label', 'settings', 'options', 'group'];
        this.validationSchema = require('../schemas/schemaTranslations.json');
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
     * @return {object}
     */
    getValidationSchema() {
        return this.validationSchema;
    }

    /**
     * Get translations
     * @return {array}
     */
    getTranslations() {
        return this.translations;
    }

    /**
     * Get i18n keys from translations
     * @return {array}
     */
    getTranslationsKeys() {
        this.translationsKeys = Object.keys(this.translations);
    }

    /**
     * Get i18n keys from schema
     * @return {array}
     */
    getSchemaKeys() {
        return this.schemaKeys;
    }

    /**
     * Get translatable strings
     * @param {array} schema
     */
    getTranslatableStrings(schema) {
        const context = this;

        schema.forEach(element => {
            Object.entries(element).forEach(function (item) {
                const key = item[0];
                const value = item[1];

                if (!context.trackedKeys.includes(key)) {
                    return;
                }

                if (Array.isArray(value)) {
                    return context.getTranslatableStrings(value);
                }

                context.setSchemaKeys(value);
            });
        });
    }

    /**
     * Find unused i18n keys in schemaTranslations
     * @return {array}
     */
    findUnusedKeys() {
        return this.translationsKeys.filter(key => !this.schemaKeys.includes(key));
    }

    /**
     * Find missed i18n keys in schemaTranslations
     * @return {array}
     */
    findMissedKeys() {
        return this.schemaKeys.filter(key => !this.translationsKeys.includes(key));
    }
}

module.exports = ValidatorSchemaTranslations;
