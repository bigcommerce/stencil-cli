'use strict';

const Code = require('code');
const Sinon = require('sinon');
const Lab = require('lab');
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const Inquirer = require('inquirer');
const expect = Code.expect;
const it = lab.it;
const StencilInit = require('../lib/stencil-init');

describe('stencil init', () => {
    let sandbox;

    lab.beforeEach(done => {
        sandbox = Sinon.createSandbox();
        sandbox.stub(console, 'log');
        sandbox.stub(console, 'error');
        done();
    });

    lab.afterEach(done => {
        sandbox.restore();
        done();
    });

    var inquirer = Sinon.spy(Inquirer, 'prompt');

    it('should call prompt', done => {
        const dotStencilFile = '../_mocks/bin/dotStencilFile.json';
        const jspmAssembler = Sinon.stub();
        const themeConfig = Sinon.spy();

        StencilInit(jspmAssembler, themeConfig, dotStencilFile);

        expect(inquirer.calledOnce).to.be.true();

        done();
    });

    it('should not call prompt with bad JSON from dotStencilFile', done => {
        const dotStencilFile = '../_mocks/malformedSchema.json';
        const jspmAssembler = Sinon.stub();
        const themeConfig = Sinon.spy();

        StencilInit(jspmAssembler, themeConfig, dotStencilFile);

        expect(inquirer.calledOnce).to.be.false();

        done();
    });
});
