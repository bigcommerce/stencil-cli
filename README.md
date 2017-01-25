# Stencil CLI
[![npm (scoped)](https://img.shields.io/npm/v/@bigcommerce/stencil-cli.svg)](https://www.npmjs.com/package/@bigcommerce/stencil-cli) [![Build Status](https://travis-ci.org/bigcommerce/stencil-cli.svg?branch=master)](https://travis-ci.org/bigcommerce/stencil-cli)
## BigCommerce server emulator for local theme development

### Install
```
$ npm install -g @bigcommerce/stencil-cli
```

For more details visit the [Installation Guide](https://stencil.bigcommerce.com/docs/installing-stencil-cli-1)

### Usage
```

  Usage: stencil [options] [command]


  Commands:

    init        Interactively create a .stencil file which configures how to run a BigCommerce store locally.
    start       Starts up BigCommerce store using theme files in the current directory.
    bundle      Bundles up the theme into a zip file which can be uploaded to BigCommerce.
    release     Create a new release in the theme's github repository.
    help [cmd]  display help for [cmd]

  Options:

    -h, --help     output usage information
    -V, --version  output the version number
```

`$ stencil init` - Run this at the top level of your Stencil Theme.  It will ask you a few questions to get your started.  

`$ stencil start` - This will run a local server so you can start developing your theme.
 - Run with `-o` or `--open` to automatically open up a browser.
 - While stencil is running, you can type `rs` and then hit enter to auto-reload all browsers. This is similar to Nodemon's `rs` option.
 - Run with `-e` to load a local Theme Editor

`$ stencil bundle` - This command will run some validations and then it will create a bundle zip file which can be uploaded to BigCommerce.

`$ stencil release` - This command will tag a new version of your theme, create a [GitHub Release](https://help.github.com/articles/about-releases/) in your theme repository and upload the bundle file to the release assets. This is useful for tracking your changes in your Theme, and is the tool we use to create new releases in BigCommerce [Cornerstone](https://github.com/bigcommerce/stencil) theme

### BrowserSync

Stencil CLI comes packaged with BrowserSync so you can take advantage of all of those amazing goodies!  Have a look at their website for more information: http://www.browsersync.io/

### SASS Compiling

You are able to compile your CSS using SASS (`node-sass`) by placing  your `.scss` files in `assets/scss/`. For example, add a scss file named `theme.scss` to `assets/scss/` and in your theme add `{{{stylesheet 'assets/css/theme.css'}}}` to your html template. Stencil-CLI will compile `theme.scss` to `css` on the fly.

### Autoprefixer ###

Stencil CLI comes packaged with [Autoprefixer](https://github.com/postcss/autoprefixer).  You can set which browsers that should be targeted as well as if it should cascade the generated rules in the theme's `config.json` file with these options:
 - `autoprefixer_cascade` - Defaults to `true`
 - `autoprefixer_browsers` - Defaults to `["> 5% in US"]`

### How To Get Help or Report A Bug

If you need any help or experience any bugs, please create a GitHub issue in this repo.

### License

Copyright (c) 2015-2016, BigCommerce Inc.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.
3. All advertising materials mentioning features or use of this software
   must display the following acknowledgement:
   This product includes software developed by BigCommerce Inc.
4. Neither the name of BigCommerce Inc. nor the
   names of its contributors may be used to endorse or promote products
   derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY BIGCOMMERCE INC ''AS IS'' AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL BIGCOMMERCE INC BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
