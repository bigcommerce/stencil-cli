var Code = require('code');
var Fs = require('fs');
var Lab = require('lab');
var Path = require('path');
var Sinon = require('sinon');
var lab = exports.lab = Lab.script();
var validator = new (require('jsonschema').Validator)();
var ThemeConfig = require('../../../../lib/theme-config');
var GetVariations = require('./getVariations');
var responseSchema = require('../../../../test/_mocks/api/getVariations.schema');

lab.describe('GET /variations/{id} api endpoint', function() {
    var requestStub = {
        log: function () {},
        params: {}
    };
    var options = {
        themeEditorHost: 'http://localhost:8181'
    };

    var themeConfig = new ThemeConfig.getInstance();

    lab.it('should reply with the right schema and include all variations', function(done) {
        requestStub.params.variationId = 2;

        themeConfig.setThemePath(Path.join(process.cwd(), 'test/_mocks/themes/valid'));

        GetVariations(options, themeConfig)(requestStub, function(response) {
            // Validate the response schema against the theme-registry schema
            Code.expect(validator.validate(response, responseSchema).errors)
                .to.be.empty();

            Code.expect(response.data.screenshot.smallThumb)
                .to.be.equal('http://localhost:8181/meta/desktop_bold.jpg');

            Code.expect(response.data.relatedVariations)
                .to.have.length(3);

            Code.expect(response.data.variationName)
                .to.be.equal('Second');

            Code.expect(response.data.relatedVariations[0].variationName)
                .to.be.equal('First');

            Code.expect(response.data.relatedVariations[1].variationName)
                .to.be.equal('Second');

            Code.expect(response.data.relatedVariations[2].variationName)
                .to.be.equal('Third');

            done();
        });
    });

    lab.it('should reply with a 404 error if the variationId does not exists', function(done) {
        requestStub.params.variationId = 44;

        themeConfig.setThemePath(Path.join(process.cwd(), 'test/_mocks/themes/valid'));

        GetVariations(options, themeConfig)(requestStub, function(response) {
            Code.expect(response.data)
                .to.be.undefined();

            Code.expect(response.errors)
                .to.be.an.array();

            return {
                code: function (code) {
                    Code.expect(code)
                        .to.be.equal(404);

                    done();
                }
            };
        });
    });
});
