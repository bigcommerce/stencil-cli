import path from 'path';
import ScssValidator from './ScssValidator.js';
import ThemeConfig from './theme-config.js';

describe('ScssValidator integration tests', () => {
    it('should throw an error when scss fail has conditional import issue on latest node sass', async () => {
        const themePath = path.join(
            process.cwd(),
            'test/_mocks/themes/invalid-scss-latest-node-sass',
        );
        const themeConfig = ThemeConfig.getInstance(themePath);
        const validator = new ScssValidator(themePath, themeConfig);
        await expect(validator.run()).rejects.toThrow(
            'Import directives may not be used within control directives or mixins.',
        );
    });
    it('should successfully compile on latest node sass', async () => {
        const themePath = path.join(process.cwd(), 'test/_mocks/themes/valid');
        const themeConfig = ThemeConfig.getInstance(themePath);
        const validator = new ScssValidator(themePath, themeConfig);
        await expect(validator.run()).resolves.not.toThrow(Error);
    });
});
