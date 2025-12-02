import { readFileSync } from 'fs';
/// ////////////////////////////////////////   Themes   /////////////////////////////////////// ///
const THEME_PATH = process.cwd();
const DEFAULT_CUSTOM_LAYOUTS_CONFIG = {
    brand: {},
    category: {},
    page: {},
    product: {},
};
/// /////////////////////////////////////////   Other   //////////////////////////////////////// ///
const API_HOST = 'https://api.bigcommerce.com';

const packageConfigUrl = new URL('./package.json', import.meta.url);
const PACKAGE_INFO = JSON.parse(readFileSync(packageConfigUrl));

export { PACKAGE_INFO };
export { THEME_PATH };
export { DEFAULT_CUSTOM_LAYOUTS_CONFIG };
export { API_HOST };
export default {
    PACKAGE_INFO,
    THEME_PATH,
    DEFAULT_CUSTOM_LAYOUTS_CONFIG,
    API_HOST,
};
