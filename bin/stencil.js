#!/usr/bin/env node
import program from '../lib/commander.js';
import { PACKAGE_INFO } from '../constants.js';

program
    .version(PACKAGE_INFO.version)
    .command(
        'init',
        'Interactively create a .stencil file which configures how to run a BigCommerce store locally.',
    )
    .command('start', 'Starts up BigCommerce store using theme files in the current directory.')
    .command('bundle', 'Bundles up the theme into a zip file which can be uploaded to BigCommerce.')
    .command('release', "Create a new release in the theme's github repository.")
    .command('push', 'Bundles up the theme into a zip file and uploads it to your store.')
    .command('pull', 'Pulls currently active theme config files and overwrites local copy')
    .command('download', 'Downloads all the theme files')
    .command('debug', 'Prints environment and theme settings for debug purposes')
    .command('scss-autofix', 'Autofix SCSS files in the current directory')
    .command('attributes-analyzer', 'Generates a report of all attributes used in the theme')
    .parse(process.argv);
