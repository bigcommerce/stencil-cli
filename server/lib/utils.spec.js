const Code = require('code');
const Lab = require('lab');
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const expect = Code.expect;
const it = lab.it;

describe('Utils', () => {
    const Utils = require('./utils');

    describe('uuid2int', () => {
        it('should return an int value presentation', done => {
            expect(Utils.uuid2int('00000000-0000-0000-0000-000000000001')).to.equal(1);
            expect(Utils.uuid2int('00000000-0000-0000-0000-000000000102')).to.equal(102);
            done();
        });

        it('should throw an error if an invalid uuid is used', done => {
            expect(() => Utils.uuid2int('00002')).to.throw(Error);
            done();
        });
    });

    describe('int2uuid', () => {
        it('should return an uuid value presentation', done => {
            expect(Utils.int2uuid(1)).to.equal('00000000-0000-0000-0000-000000000001');
            expect(Utils.int2uuid(505)).to.equal('00000000-0000-0000-0000-000000000505');
            done();
        });
    });
});
