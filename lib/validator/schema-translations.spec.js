const Paths = require('path');
const Code = require('code');
const Lab = require('@hapi/lab');
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;

const ValidatorSchemaTranslations = require('./schema-translations');
const schema = require(Paths.join(process.cwd(), 'test/_mocks/themes/valid/schema.json'));
const schemaTranslations = require(Paths.join(process.cwd(), 'test/_mocks/themes/valid/schemaTranslations.json'));
const validationsTranslations = require('../schemas/schemaTranslations');

const validatorSchemaTranslations = () => {
    return new ValidatorSchemaTranslations();
};

describe('ValidatorSchemaTranslations', () => {
    it('should return translations', () => {
        const instance = validatorSchemaTranslations();

        instance.setTranslations(schemaTranslations);

        expect(instance.getTranslations()).equals(schemaTranslations);
    });

    it('should return translations keys', () => {
        const instance = validatorSchemaTranslations();

        instance.setSchema(schema);

        expect(instance.getSchemaKeys()).equals(['i18n.Test']);
    });

    it('should return validation schema', () => {
        const instance = validatorSchemaTranslations();

        expect(instance.getValidationSchema()).equals(validationsTranslations);
    });

    it('should return i18n keys array without duplicates', () => {
        const instance = validatorSchemaTranslations();

        instance.setSchemaKeys('i18n.Global');
        instance.setSchemaKeys('i18n.Global');

        expect(instance.getSchemaKeys()).equals(['i18n.Global']);
    });

    it('should return empty i18n keys array if specify empty string', () => {
        const instance = validatorSchemaTranslations();

        instance.setSchemaKeys('');

        expect(instance.getSchemaKeys()).equals([]);
    });
});
