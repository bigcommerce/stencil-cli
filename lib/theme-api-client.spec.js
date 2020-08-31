'use strict';

require('colors');
const themeApiClient = require('./theme-api-client');

describe('theme-api-client', () => {
	describe('printErrorMessages', () => {
        let consoleLogStub;

        beforeAll(() => {
            consoleLogStub = jest.spyOn(console, 'log').mockImplementation(jest.fn());
    	});

        afterEach(() => {
            jest.clearAllMocks();
        });

        afterAll(() => {
            jest.restoreAllMocks();
        });

	    it('should log unknown error and return if input is not an array, but string', () => {
            themeApiClient.printErrorMessages('string');

	        expect(consoleLogStub).toHaveBeenCalledTimes(1);
	        expect(consoleLogStub).toHaveBeenCalledWith('unknown error'.red);
        });

        it('should log unknown error and return if input is not an array, but object', () => {
            themeApiClient.printErrorMessages({ 'key': 'value' });

            expect(consoleLogStub).toHaveBeenCalledTimes(1);
            expect(consoleLogStub).toHaveBeenCalledWith('unknown error'.red);
        });

        it('should log unknown error and return if input is not an array, but null', () => {
            themeApiClient.printErrorMessages(null);

            expect(consoleLogStub).toHaveBeenCalledTimes(1);
            expect(consoleLogStub).toHaveBeenCalledWith('unknown error'.red);
        });

	    it('should log error message for each error in the array', () => {
            const arrayInput = [{'message': 'first_error'}, {'message': '2nd_error'}];

            themeApiClient.printErrorMessages(arrayInput);

            expect(consoleLogStub).toHaveBeenCalledTimes(3);
            expect(consoleLogStub.mock.calls).toEqual([
                ['first_error'.red  + '\n'],
                ['2nd_error'.red  + '\n'],
                ['Please visit the troubleshooting page https://developer.bigcommerce.com/stencil-docs/deploying-a-theme/troubleshooting-theme-uploads'],
            ]);
	    });

	    it('should skip non object elements in the input array', () => {
            const arrayInput = [{'message': 'first_error'}, 'string', {'message': '2nd_error'}];

            themeApiClient.printErrorMessages(arrayInput);

            expect(consoleLogStub).toHaveBeenCalledTimes(3);
            expect(consoleLogStub.mock.calls).toEqual([
                ['first_error'.red  + '\n'],
                ['2nd_error'.red  + '\n'],
                ['Please visit the troubleshooting page https://developer.bigcommerce.com/stencil-docs/deploying-a-theme/troubleshooting-theme-uploads'],
            ]);
	    });
    });
 });
