const Paths = require('path');
const Code = require('code');
const Lab = require('lab');
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
    it('should return translations', function (done) {
        const instance = validatorSchemaTranslations();

        instance.setTranslations(schemaTranslations);

        expect(instance.getTranslations()).equals(schemaTranslations);

        done();
    });

    it('should return translations keys', function (done) {
        const instance = validatorSchemaTranslations();

        instance.setSchema(schema);

        expect(instance.getSchemaKeys()).equals(['i18n.Test']);

        done();
    });

    it('should return validation schema', function (done) {
        const instance = validatorSchemaTranslations();

        expect(instance.getValidationSchema()).equals(validationsTranslations);

        done();
    });

    it('should return i18n keys array without duplicates', function (done) {
        const instance = validatorSchemaTranslations();

        instance.setSchemaKeys('i18n.Global');
        instance.setSchemaKeys('i18n.Global');

        expect(instance.getSchemaKeys()).equals(['i18n.Global']);

        done();
    });

    it('should return empty i18n keys array if specify empty string', function (done) {
        const instance = validatorSchemaTranslations();

        instance.setSchemaKeys('');

        expect(instance.getSchemaKeys()).equals([]);

        done();
    });
});
