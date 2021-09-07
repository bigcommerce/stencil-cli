/// //////////////////////////////////////   Stencil CLI   ///////////////////////////////////// ///

const PACKAGE_INFO = require('./package.json');

/// ////////////////////////////////////////   Themes   /////////////////////////////////////// ///

const THEME_PATH = process.cwd();

const DEFAULT_CUSTOM_LAYOUTS_CONFIG = {
    brand: {},
    category: {},
    page: {},
    product: {},
};

/// /////////////////////////////////////////   Other   //////////////////////////////////////// ///

const DEV_API_HOST = 'https://api.service.bcdev';
const INTG_API_HOST = 'https://api.integration.zone';
const STG_API_HOST = 'https://api.staging.zone';
const API_HOST = 'https://api.bigcommerce.com';

module.exports = {
    PACKAGE_INFO,
    THEME_PATH,
    DEFAULT_CUSTOM_LAYOUTS_CONFIG,
    DEV_API_HOST,
    INTG_API_HOST,
    STG_API_HOST,
    API_HOST,
};
