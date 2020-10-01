# Stencil CLI

[![npm (scoped)](https://img.shields.io/npm/v/@bigcommerce/stencil-cli.svg)](https://www.npmjs.com/package/@bigcommerce/stencil-cli)
![tests](https://github.com/bigcommerce/stencil-cli/workflows/Tests/badge.svg?branch=master)

The BigCommerce server emulator for local theme development.

## Install

_Note: Stencil requires the Node.js runtime environment,
version 10.x and 12.x (Recommended) are supported.
We do not yet have support for versions greater than Node 12._

Run `npm install -g @bigcommerce/stencil-cli`.

Visit the [installation guide](https://developer.bigcommerce.com/stencil-docs/getting-started/installing-stencil)
for more details.

## Usage

```text
Usage: stencil [options] [command]

Commands:

  init        Interactively create a .stencil file which configures how to run a BigCommerce store locally.
  start       Starts up the BigCommerce storefront local development environment, using theme files in the current directory and data from the live store.
  bundle      Bundles up the theme into a zip file which can be uploaded to BigCommerce.
  release     Create a new release in the theme's github repository.
  push        Bundles up the theme into a zip file and uploads it to your store.
  pull        Pulls the configuration from the active theme on your live store and updates your local configuration.
  download    Downloads the theme files from the active theme on your live store.
  help [cmd]  display help for [cmd]

Options:

  -h, --help     output usage information
  -V, --version  output the version number
```

Run `stencil init` at the top level of your Stencil Theme. It will ask you a few questions to get your started.

Run `stencil start` to run a local server so you can start developing your theme.

Run with `-o` or `--open` to automatically open up a browser.

-   While stencil is running, you can type "rs" and then hit enter to auto-reload all browsers. This is similar to
    Nodemon's rs option.

Run `stencil bundle` to validate your code and create a zip bundle file that can be uploaded to BigCommerce.

Run `stencil release` to tag a new version of your theme, create a [GitHub release](https://help.github.com/articles/about-releases/)
in your theme repository, and upload the zip bundle file to the release assets.
This is useful for tracking your changes in your Theme, and is the tool we use to create new releases in BigCommerce
[Cornerstone](https://github.com/bigcommerce/stencil) theme.

Run `stencil push` to bundle the local theme and upload it to your store, so it will be available in My Themes.
To push the theme and also activate it, use `stencil push -a`. To automatically delete the oldest theme if you are at
your theme limit, use `stencil push -d`. These can be used together, as `stencil push -a -d`.

Run `stencil pull` to sync changes to your theme configuration from your live store. For example, if Page Builder has
been used to change certain theme settings, this will update those settings in config.json in your theme files so you
don't overwrite them on your next upload.

## Features

### BrowserSync

Stencil CLI comes packaged with BrowserSync so you can take advantage of all of those amazing goodies!
Have a look at their [web site](http://www.browsersync.io/) for more information.

### Sass compiling

You can compile Sass (node-sass) scss files in assets/scss into CSS. For example, add an scss file named theme.scss
to assets/scss and `{{{stylesheet 'assets/css/theme.css'}}}` to your theme HTML template. Stencil-CLI will compile
assets/scss/theme.scss to CSS on the fly.

### Autoprefixer

Stencil CLI comes packaged with [Autoprefixer](https://github.com/postcss/autoprefixer). You can set which browsers
should be targeted, as well as if it should cascade the generated rules in the theme's config.json file with these
options:

-   `autoprefixer_cascade` - Defaults to `true`.
-   `autoprefixer_browsers` - Defaults to `["> 1%", "last 2 versions", "Firefox ESR"]`.

## How to get help or report a bug

If you need any help or experience any bugs, please create a GitHub issue in this repository.

## Development

If you would like to improve this project check out the [Contributing Guide](./CONTRIBUTING.md). Also, you can find
the implementation details there.

## License

Copyright (c) 2015-present, BigCommerce Inc.
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
