var Code = require('code');
var Fs = require('fs');
var Sinon = require('sinon');
var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var Inquirer = require('inquirer');
var expect = Code.expect;
var it = lab.it;
var StencilInit = require('../lib/stencil-init');

/**
 * Gets jspm assembler stub
 *
 * @returns Sinon
 */
function getJspmAssemblerStub() {
    var jspmAssembler = Sinon.stub();
    return jspmAssembler;
}

/**
 * Gets theme config spy
 *
 * @returns Sinon
 */
function getThemeConfigStub() {
    var themeConfig = Sinon.spy();
    return themeConfig;
}

describe('stencil init', function() {
    var inquirer = Sinon.spy(Inquirer, 'prompt');

    it('should call prompt', function(done) {
        var dotStencilFile = '../_mocks/bin/dotStencilFile.json';
        var jspmAssembler = getJspmAssemblerStub();
        var themeConfig = getThemeConfigStub();

        StencilInit(jspmAssembler, themeConfig, dotStencilFile);

        expect(inquirer.calledOnce).to.be.true();

        done();
    });

    it('should not call prompt with bad JSON from dotStencilFile', function(done) {
        var dotStencilFile = '../_mocks/malformedSchema.json';
        var jspmAssembler = getJspmAssemblerStub();
        var themeConfig = getThemeConfigStub();

        StencilInit(jspmAssembler, themeConfig, dotStencilFile);

        expect(inquirer.calledOnce).to.be.false();

        done();
    });
});
