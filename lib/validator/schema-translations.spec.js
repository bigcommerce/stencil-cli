const ValidatorSchemaTranslations = require('./schema-translations');
const schema = require('../../test/_mocks/themes/valid/schema.json');
const schemaTranslations = require('../../test/_mocks/themes/valid/schemaTranslations.json');
const validationsTranslations = require('../schemas/schemaTranslations.json');

const validatorSchemaTranslations = () => {
    return new ValidatorSchemaTranslations();
};

describe('ValidatorSchemaTranslations', () => {
    it('should return translations', () => {
        const instance = validatorSchemaTranslations();

        instance.setTranslations(schemaTranslations);

        expect(instance.getTranslations()).toEqual(schemaTranslations);
    });

    it('should return translations keys', () => {
        const instance = validatorSchemaTranslations();

        instance.setSchema(schema);

        expect(instance.getSchemaKeys()).toEqual(['i18n.Test']);
    });

    it('should return validation schema', () => {
        const instance = validatorSchemaTranslations();

        expect(instance.getValidationSchema()).toEqual(validationsTranslations);
    });

    it('should return i18n keys array without duplicates', () => {
        const instance = validatorSchemaTranslations();

        instance.setSchemaKeys('i18n.Global');
        instance.setSchemaKeys('i18n.Global');

        expect(instance.getSchemaKeys()).toEqual(['i18n.Global']);
    });

    it('should return empty i18n keys array if specify empty string', () => {
        const instance = validatorSchemaTranslations();

        instance.setSchemaKeys('');

        expect(instance.getSchemaKeys()).toEqual([]);
    });
});
