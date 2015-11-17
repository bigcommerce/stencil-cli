var Code = require('code');
var Fs = require('fs');
var Lab = require('lab');
var Path = require('path');
var Sinon = require('sinon');
var lab = exports.lab = Lab.script();
var validator = new (require('jsonschema').Validator)();
var themePath = Path.join(process.cwd(), 'test/_mocks/themes/valid');
var ThemeConfig = require('../../../../../lib/themeConfig');
var GetConfigurations = require('../../../../../server/plugins/StencilEditor/api/getConfigurations');
var responseSchema = require('./getConfigurations.schema');

lab.describe('GET /configurations/{id} api endpoint', function () {

    lab.it('should reply with the right schema and include the first variation settings', function (done) {
        var originalConfig = require(Path.join(themePath, 'config.json'));
        var request = {
            params: {
                configurationId: 1
            }
        };

        var themeConfig = ThemeConfig.getInstance(themePath);

        GetConfigurations({}, themeConfig)(request, function (response) {

            // Validate the response schema against the theme-registry schema
            Code.expect(validator.validate(response, responseSchema).errors)
                .to.be.empty();

            Code.expect(response.data.settings.select)
                .to.be.equal('first');

            Code.expect(response.data.variationId)
                .to.be.equal(1);

            done();
        });
    });

    lab.it('should reply with the right schema and include the second variation settings', function (done) {
        var originalConfig = require(Path.join(themePath, 'config.json'));
        var request = {
            params: {
                configurationId: 2
            }
        };

        var themeConfig = ThemeConfig.getInstance(themePath);

        GetConfigurations({}, themeConfig)(request, function (response) {
            // Validate the response schema against the theme-registry schema
            Code.expect(validator.validate(response, responseSchema).errors)
                .to.be.empty();

            Code.expect(response.data.settings.select)
                .to.be.equal('second');

            Code.expect(response.data.variationId)
                .to.be.equal(2);

            done();
        });
    });
});
