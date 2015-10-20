#!/usr/bin/env node

var Program = require('commander');
var _ = require('lodash');
var Fs = require('fs');
var Archiver = require('archiver');
var UnZip = require('decompress-zip');
var Path = require('path');
var paths = {
    jspmPackages: Path.join(__dirname, 'public/jspm_packages'),
    jspmZip: Path.join(__dirname, 'public/jspm_packages.zip'),
};

require('colors');

Program
  .version('0.0.1')
  .option('-c, --clean', 'Clean jspm directory')
  .option('-i, --install', 'Install jspm dependencies from the zip file')
  .option('-b, --bundle', 'Bundle jspm dependencies into a zip file for distribution')
  .parse(process.argv);

if (Program.clean) {
    clean();
}

if (Program.bundle) {
    bundle();
}

if (Program.install) {
    install();
}

function fileExist(path) {
    try {
        return Fs.statSync(path);
    }
    catch (e) {
        return false;
    }
}

function removeDirectory(path) {
    var files = [];

    if (Fs.existsSync(path)) {
        files = Fs.readdirSync(path);

        files.forEach(function(file,index) {
            var curPath = Path.join(path, file);

            if (Fs.lstatSync(curPath).isDirectory()) {
                removeDirectory(curPath);
            } else {
                Fs.unlinkSync(curPath);
            }
        });
        Fs.rmdirSync(path);
    }
};

function clean() {
    if (fileExist(paths.jspmPackages)) {
        removeDirectory(paths.jspmPackages);
        console.log('Deleted:'.green, paths.jspmPackages);
    }
}

function bundle() {
    var output,
        archive;

    if (!fileExist(paths.jspmPackages)) {
        console.error('ERROR: No jspm_packagesd directory, run "jspm install" first'.cyan);
        return;
    }

    if (fileExist(paths.jspmZip)) {
        Fs.unlinkSync(paths.jspmZip);
    }

    console.log('Packaging public/jspm_packages to'.green, paths.jspmZip);

    output = Fs.createWriteStream(paths.jspmZip);
    archive = Archiver('zip');

    output.on('close', function () {
        console.log('Complete.'.green);
    });

    archive.on('error', function (err) {
        throw err;
    });

    archive.pipe(output);

    archive.bulk([{
        expand: true,
        cwd: paths.jspmPackages,
        src: ['**/*.{js,css,svg}']
    }]).finalize();
}

function install() {
    var archive;

    if (!fileExist(paths.jspmZip)) {
        console.error('ERROR: No jspm bundle file, run "jspm install && jspm clean && ./make --bundle"'.cyan);
        return;
    }

    clean();

    archive = new UnZip(paths.jspmZip);

    archive.on('error', function (err) {
        throw err;
    });

    archive.on('extract', function (log) {
        console.log('Extracting complete.'.green);
    });

    archive.extract({
        path: paths.jspmPackages
    });
}
