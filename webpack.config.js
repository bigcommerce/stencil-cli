var LiveReloadPlugin = require('webpack-livereload-plugin');
var CopyWebpackPlugin = require('copy-webpack-plugin');
var CleanWebpackPlugin = require('clean-webpack-plugin');
var Path = require('path');
var distPath = Path.join(__dirname, 'server/plugins/stencil-editor/public/dist');

// Icons used from pattern lab
var icons = [
    'ic-add',
    'ic-arrow-drop-up',
    'ic-arrow-drop-down',
    'ic-chevron-left',
    'ic-chevron-right',
    'ic-delete',
    'ic-remove',
    'ic-phone-iphone',
    'ic-tablet-mac',
    'ic-desktop-windows',
    'ic-check-circle',
    'ic-close',
    'ic-refresh',
].join(',');

var config = {
    devtool: 'inline-source-map',
    watch: true,
    entry: {
        app: './server/plugins/stencil-editor/js/app.js',
    },
    output: {
        filename: '[name].js',
        path: distPath,
    },
    module: {
        loaders: [{
            test: /\.js$/,
            exclude: /(node_modules|ng-stencil-editor)/,
            loader: 'babel?presets[]=es2015',
        }],
    },
    plugins: [

        new CleanWebpackPlugin(['*'], {
            root: distPath,
        }),

        new LiveReloadPlugin({
            appendScriptTag: true,
            host: 'localhost',
        }),

        new CopyWebpackPlugin([{
                context: 'node_modules/bcapp-pattern-lab/dist',
                from: 'svg/icons/{' + icons + '}.svg',
                to: Path.join(distPath, 'bcapp-pattern-lab'),
            },
            {
                context: 'node_modules/bcapp-pattern-lab/dist',
                from: 'css/**/*.css',
                to: Path.join(distPath, 'bcapp-pattern-lab'),
            },
            {
                context: 'node_modules/ng-stencil-editor/dist',
                from: '**/*.{css,svg}',
                to: Path.join(distPath, 'ng-stencil-editor'),
            },
            {
                context: 'node_modules/stencil-preview-sdk/dist',
                from: 'js/stencil-preview-sdk.js',
                to: distPath,
            },
        ]),
    ],
};

if (process.argv.indexOf('--deploy') > 0) {
    config.devtool = null;
    config.watch = false;
}

module.exports = config;
