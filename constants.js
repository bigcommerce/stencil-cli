const path = require('path');
const packagePath = path.join(process.cwd(), 'package.json');
const packageInfo = require(packagePath);

const DEFAULT_CUSTOM_LAYOUTS_CONFIG = {
    'brand': {},
    'category': {},
    'page': {},
    'product': {},
};

module.exports =  {
    packageInfo,
    DEFAULT_CUSTOM_LAYOUTS_CONFIG,
};
