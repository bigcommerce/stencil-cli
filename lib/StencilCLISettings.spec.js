const stencilCLISettings = require('./StencilCLISettings');

describe('StencilCLISettings', () => {
    afterEach(() => {
        // setting to default
        stencilCLISettings.setVerbose(false);
    });

    it('should set network logging to non-verbose by default', () => {
        expect(stencilCLISettings.isVerbose()).toBeFalsy();
    });

    it('should set network logging to verbose', () => {
        stencilCLISettings.setVerbose(true);
        expect(stencilCLISettings.isVerbose()).toBeTruthy();
    });
});
