var ChildProcess = require('child_process'),
    Code = require('code'),
    Lab = require('lab'),
    Sinon = require('sinon'),
    Shell = require('../../../lib/utils/shell');

var lab = exports.lab = Lab.script(),
    afterEach = lab.afterEach,
    beforeEach = lab.beforeEach,
    describe = lab.describe,
    expect = Code.expect,
    it = lab.it;

describe('shell', function() {
    describe('exec', function() {
        var childProcess;

        beforeEach(function(done) {
            childProcess = {};

            Sinon.stub(ChildProcess, 'spawn').returns(childProcess);

            done();
        });

        afterEach(function(done) {
            ChildProcess.spawn.restore();

            done();
        });

        it('should spawn a child process and inherit parent\'s stdio', function(done) {
            Shell.exec('node -h');

            expect(ChildProcess.spawn.calledWith('sh', ['-c', 'node -h'], { stdio: 'inherit' })).to.be.true();

            done();
        });

        it('should return a child process', function(done) {
            var output = Shell.exec('node -h');

            expect(output).to.equal(childProcess);

            done();
        });
    });

    describe('execSync', function() {
        var results;

        beforeEach(function(done) {
            results = {};

            Sinon.stub(ChildProcess, 'spawnSync').returns(results);

            done();
        });

        afterEach(function(done) {
            ChildProcess.spawnSync.restore();

            done();
        });

        it('should spawn a child process synchronously and inherit parent\'s stdio', function(done) {
            Shell.execSync('node -h');

            expect(ChildProcess.spawnSync.calledWith('sh', ['-c', 'node -h'], { stdio: 'inherit' })).to.be.true();

            done();
        });

        it('should return the results of the process', function(done) {
            var output = Shell.execSync('node -h');

            expect(output).to.equal(results);

            done();
        });
    });
});
