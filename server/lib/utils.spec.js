const Utils = require('./utils');

describe('Utils', () => {
    describe('uuid2int', () => {
        it('should return an int value presentation', () => {
            expect(Utils.uuid2int('00000000-0000-0000-0000-000000000001')).toEqual(1);
            expect(Utils.uuid2int('00000000-0000-0000-0000-000000000102')).toEqual(102);
        });

        it('should throw an error if an invalid uuid is used', () => {
            expect(() => Utils.uuid2int('00002')).toThrow(Error);
        });
    });

    describe('int2uuid', () => {
        it('should return an uuid value presentation', () => {
            expect(Utils.int2uuid(1)).toEqual('00000000-0000-0000-0000-000000000001');
            expect(Utils.int2uuid(505)).toEqual('00000000-0000-0000-0000-000000000505');
        });
    });
});
