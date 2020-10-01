const utils = require('./utils');

describe('utils', () => {
    describe('uuid2int', () => {
        it('should return an int value presentation', () => {
            expect(utils.uuid2int('00000000-0000-0000-0000-000000000001')).toEqual(1);
            expect(utils.uuid2int('00000000-0000-0000-0000-000000000102')).toEqual(102);
        });

        it('should throw an error if an invalid uuid is used', () => {
            expect(() => utils.uuid2int('00002')).toThrow(Error);
        });
    });

    describe('int2uuid', () => {
        it('should return an uuid value presentation', () => {
            expect(utils.int2uuid(1)).toEqual('00000000-0000-0000-0000-000000000001');
            expect(utils.int2uuid(505)).toEqual('00000000-0000-0000-0000-000000000505');
        });
    });
});
