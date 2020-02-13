/**
 * Watch options for the core watcher
 * @type {{files: string[], ignored: string[]}}
 */
var watchOptions = {
    // If files in these directories change, reload the page.
    files: [
        '/templates',
        '/lang',
    ],

    //Do not watch files in these directories
    ignored: [
        '/assets/scss',
        '/assets/css',
        '/assets/dist',
    ],
};

/**
 * Watch any custom files and trigger a rebuild
 */
function development(Bs) {
    // Rebuild the bundle once at bootup
    setTimeout(() => {
        Bs.reload();
    });
}

/**
 * Hook into the `stencil bundle` command and build your files before they are packaged as a .zip
 */
function production(done) {
    // Rebuild the bundle once at bootup
    setTimeout(() => {
        done();
    });
}

module.exports = { watchOptions, development, production };
