const stencilCLISettings = require('./StencilCLISettings');

describe('StencilCLISettings', () => {
    afterEach(() => {
        // setting to default
        stencilCLISettings.setVerbose(true);
    });

    it('should set network logging to verbose by default', () => {
        expect(stencilCLISettings.isVerbose()).toBeTruthy();
    });

    it('should set network logging to NOT verbose', () => {
        stencilCLISettings.setVerbose(false);
        expect(stencilCLISettings.isVerbose()).toBeFalsy();
    });
});
