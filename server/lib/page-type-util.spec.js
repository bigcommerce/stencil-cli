const { getPageType } = require('./page-type-util');

describe('page-type-util', () => {
    describe('getPageType', () => {
        it('should return a string pageType value', () => {
            expect(getPageType('pages/page')).toEqual('PAGE');
            expect(getPageType('pages/brand')).toEqual('BRAND');
        });

        it('should should return a null value', () => {
            expect(getPageType('pages/something')).toBeUndefined();
        });
    });
});
