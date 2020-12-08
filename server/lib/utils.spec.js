const { uuid2int, int2uuid, normalizeRedirectUrl } = require('./utils');

describe('utils', () => {
    describe('uuid2int', () => {
        it('should return an int value presentation', () => {
            expect(uuid2int('00000000-0000-0000-0000-000000000001')).toEqual(1);
            expect(uuid2int('00000000-0000-0000-0000-000000000102')).toEqual(102);
        });

        it('should throw an error if an invalid uuid is used', () => {
            expect(() => uuid2int('00002')).toThrow(Error);
        });
    });

    describe('int2uuid', () => {
        it('should return an uuid value presentation', () => {
            expect(int2uuid(1)).toEqual('00000000-0000-0000-0000-000000000001');
            expect(int2uuid(505)).toEqual('00000000-0000-0000-0000-000000000505');
        });
    });

    describe('normalizeRedirectUrl', () => {
        it('should return the original value if the redirectUrl is already striped', () => {
            const redirectUrl = '/products?filter=name#3';
            expect(normalizeRedirectUrl(redirectUrl, {})).toEqual(redirectUrl);
        });

        it('should return the original value if the redirectUrl has a host different from hosts in config', () => {
            const redirectUrl = 'https://google.com/search?q=this-product';
            const config = {
                normalStoreUrl: 'https://store-12345678.mybigcommerce.com',
                storeUrl: 'https://my-awesome-store.com',
            };

            expect(normalizeRedirectUrl(redirectUrl, config)).toEqual(redirectUrl);
        });

        it('should return the url without host if the redirectUrl has a host = to normalStoreUrl', () => {
            const redirectUrl = 'https://store-12345678.mybigcommerce.com/products?filter=name#3';
            const config = {
                normalStoreUrl: 'https://store-12345678.mybigcommerce.com',
                storeUrl: 'https://my-awesome-store.com',
            };

            expect(normalizeRedirectUrl(redirectUrl, config)).toEqual('/products?filter=name#3');
        });

        it('should return the url without host if the redirectUrl has a host = to storeUrl', () => {
            const redirectUrl = 'https://my-awesome-store.com/products?filter=name#3';
            const config = {
                normalStoreUrl: 'https://store-12345678.mybigcommerce.com',
                storeUrl: 'https://my-awesome-store.com',
            };

            expect(normalizeRedirectUrl(redirectUrl, config)).toEqual('/products?filter=name#3');
        });
    });
});
