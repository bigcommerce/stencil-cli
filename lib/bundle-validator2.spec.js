const path = require('path');
const { promisify } = require('util');

const ThemeConfig = require('./theme-config');
const BundleValidator = require('./bundle-validator');
const stencilCLISettings = require('./StencilCLISettings');

// NOTE:
// Since stencil styles can't change node sass engine in runtime, tests are divided into 2 files
// Jest runs tests in parallel, so the node sass binaries are not conflicting and we are able to test both scenarios
//
// Skipping this test until multiple core are supported no Github Actions
describe.skip('BundleValidator', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        stencilCLISettings.useOldNodeSassFork(false);
    });

    it('should compile successfully with old node sass fork', async () => {
        const themePath = path.join(
            process.cwd(),
            'test/_mocks/themes/invalid-scss-latest-node-sass',
        );
        const themeConfig = ThemeConfig.getInstance(themePath);
        stencilCLISettings.useOldNodeSassFork(true);

        const validator = new BundleValidator(themePath, themeConfig, false);

        const result = await promisify(validator.validateTheme.bind(validator))();
        expect(result).not.toBeNull();
    });
});
