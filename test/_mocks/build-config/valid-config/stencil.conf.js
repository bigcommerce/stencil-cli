/**
 * Watch options for the core watcher
 * @type {{files: string[], ignored: string[]}}
 */
const watchOptions = {
    // If files in these directories change, reload the page.
    files: [
        '/templates',
        '/lang',
    ],

    // Do not watch files in these directories
    ignored: [
        '/assets/scss',
        '/assets/css',
        '/assets/dist',
    ],
};

/**
 * Watch any custom files and trigger a rebuild
 */
function development() {
    // Rebuild the bundle once at bootup
    setTimeout(() => process.send('reload'), 10);
}

/**
 * Hook into the `stencil bundle` command and build your files before they are packaged as a .zip
 */
function production() {
    // Rebuild the bundle once at bootup
    setTimeout(() => process.send('done'), 10);
}

if (process.send) {
    // running as a forked worker
    process.on('message', message => {
        if (message === 'development') {
            development();
        }

        if (message === 'production') {
            production();
        }
    });

    process.send('ready');
}

module.exports = { watchOptions };
