const Code = require('code');
const Lab = require('lab');
const Sinon = require('sinon');
const lab = exports.lab = Lab.script();
const validator = new (require('jsonschema').Validator)();
const Utils = require('../../../lib/utils');
const PostConfigurations = require('./postConfigurations');
const responseSchema = require('../../../../test/_mocks/api/postConfigurations.schema');

lab.describe('POST /configurations/{id} api endpoint', function () {

    lab.it('should reply with POST configurations schema and not save to file', function (done) {
        var themeConfig = {
            setVariation: Sinon.spy(),
            updateConfig: Sinon.spy(),
        };
        var requestStub = {
            payload: {
                variationId: Utils.int2uuid(1),
                preview: true,
                settings: {
                    a: 1,
                },
            },
        };

        PostConfigurations({}, themeConfig)(requestStub, function (response) {

            // Validate the response schema against the theme-registry schema
            Code.expect(validator.validate(response, responseSchema).errors)
                .to.be.empty();

            Code.expect(themeConfig.updateConfig.calledWith(requestStub.payload.settings, false))
                .to.be.true();

            Code.expect(themeConfig.setVariation.calledWith(0))
                .to.be.true();

            done();
        });
    });

    lab.it('should reply with the POST configurations schema and save settings to file', function (done) {
        var themeConfig = {
            setVariation: Sinon.spy(),
            updateConfig: Sinon.spy(),
        };
        var requestStub = {
            payload: {
                variationId: Utils.int2uuid(2),
                settings: {
                    b: 1,
                },
            },
        };

        PostConfigurations({}, themeConfig)(requestStub, function (response) {

            // Validate the response schema against the theme-registry schema
            Code.expect(validator.validate(response, responseSchema).errors)
                .to.be.empty();

            Code.expect(themeConfig.updateConfig.calledWith(requestStub.payload.settings, true))
                .to.be.true();

            Code.expect(themeConfig.setVariation.calledWith(1))
                .to.be.true();

            done();
        });
    });

    lab.it('should respond with an error if reset flag is passed', function(done) {
        var themeConfig = {
            setVariation: Sinon.spy(),
            updateConfig: Sinon.spy(),
        };
        var requestStub = {
            payload: {
                reset: true,
                variationId: Utils.int2uuid(1),
                settings: {
                    b: 1,
                },
            },
        };

        PostConfigurations({}, themeConfig)(requestStub, function(response) {

            Code.expect(response.data)
                .to.be.undefined();

            Code.expect(response.errors)
                .to.be.an.array();


            Code.expect(response.errors[0].type)
                .to.equal('not_available');

            Code.expect(themeConfig.setVariation.notCalled)
                .to.be.true();

            Code.expect(themeConfig.updateConfig.notCalled)
                .to.be.true();

            return {
                code: function (code) {
                    Code.expect(code).to.be.equal(405);

                    done();
                },
            };
        });
    });
});
