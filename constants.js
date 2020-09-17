const path = require('path');

/////////////////////////////////////////   Stencil CLI   /////////////////////////////////////////

const PACKAGE_INFO = require('./package.json');

///////////////////////////////////////////   Themes   ///////////////////////////////////////////

const THEME_PATH = process.cwd();

const DOT_STENCIL_FILE_PATH = path.join(THEME_PATH, '.stencil');

const DEFAULT_CUSTOM_LAYOUTS_CONFIG = {
    'brand': {},
    'category': {},
    'page': {},
    'product': {},
};

////////////////////////////////////////////   Other   ////////////////////////////////////////////

const API_HOST = 'https://api.bigcommerce.com';

module.exports =  {
    PACKAGE_INFO,
    THEME_PATH,
    DOT_STENCIL_FILE_PATH,
    DEFAULT_CUSTOM_LAYOUTS_CONFIG,
    API_HOST,
};
