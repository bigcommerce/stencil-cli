const Code = require('code');
const Lab = require('@hapi/lab');

const Utils = require('./utils');

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const expect = Code.expect;
const it = lab.it;

describe('Utils', () => {
    describe('uuid2int', () => {
        it('should return an int value presentation', () => {
            expect(Utils.uuid2int('00000000-0000-0000-0000-000000000001')).to.equal(1);
            expect(Utils.uuid2int('00000000-0000-0000-0000-000000000102')).to.equal(102);
        });

        it('should throw an error if an invalid uuid is used', () => {
            expect(() => Utils.uuid2int('00002')).to.throw(Error);
        });
    });

    describe('int2uuid', () => {
        it('should return an uuid value presentation', () => {
            expect(Utils.int2uuid(1)).to.equal('00000000-0000-0000-0000-000000000001');
            expect(Utils.int2uuid(505)).to.equal('00000000-0000-0000-0000-000000000505');
        });
    });
});
