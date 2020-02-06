const path = require('path');
const packagePath = path.join(process.cwd(), 'package.json');
const packageInfo = require(packagePath);

module.exports =  { packageInfo };
