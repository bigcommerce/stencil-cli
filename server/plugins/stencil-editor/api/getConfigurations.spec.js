const Code = require('code');
const Lab = require('lab');
const Path = require('path');
const lab = exports.lab = Lab.script();
const validator = new (require('ajv'))();
const Utils = require('../../../lib/utils');
const themePath = Path.join(process.cwd(), 'test/_mocks/themes/valid');
const ThemeConfig = require('../../../../lib/theme-config');
const GetConfigurations = require('./getConfigurations');
const responseSchema = require('../../../../test/_mocks/api/getConfigurations.schema');

lab.describe('GET /configurations/{id} api endpoint', function () {

    lab.it('should reply with the right schema and include the first variation settings', function (done) {
        var request = {
            params: {
                configurationId: Utils.int2uuid(1),
            },
        };

        var themeConfig = ThemeConfig.getInstance(themePath);

        GetConfigurations({}, themeConfig)(request, function (response) {

            // Validate the response schema against the theme-registry schema
            validator.validate(responseSchema, response);
            Code.expect(validator.errors).to.be.null();

            Code.expect(response.data.settings.select)
                .to.be.equal('first');

            Code.expect(response.data.variationId)
                .to.be.equal(Utils.int2uuid(1));

            done();
        });
    });

    lab.it('should reply with the right schema and include the second variation settings', function (done) {
        var request = {
            params: {
                configurationId: Utils.int2uuid(2),
            },
        };

        var themeConfig = ThemeConfig.getInstance(themePath);

        GetConfigurations({}, themeConfig)(request, function (response) {
            // Validate the response schema against the theme-registry schema
            validator.validate(responseSchema, response);
            Code.expect(validator.errors).to.be.null();

            Code.expect(response.data.settings.select)
                .to.be.equal('second');

            Code.expect(response.data.variationId)
                .to.be.equal(Utils.int2uuid(2));

            done();
        });
    });
});
