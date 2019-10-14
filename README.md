# Stencil CLI

[![npm (scoped)](https://img.shields.io/npm/v/@bigcommerce/stencil-cli.svg)](https://www.npmjs.com/package/@bigcommerce/stencil-cli) [![Travis](https://travis-ci.org/bigcommerce/stencil-cli.svg?branch=master)](https://travis-ci.org/bigcommerce/stencil-cli) [![AppVeyor](https://ci.appveyor.com/api/projects/status/jejnlajci3dslwfx?svg=true)](https://ci.appveyor.com/project/BigCommerceEngineering/stencil-cli)


The BigCommerce server emulator for local theme development.

## Install
_Note: Stencil requires the Node.js runtime environment, version 8.x or 10.x We do not yet have support for Node 12 or greater._

Run `npm install -g @bigcommerce/stencil-cli`.

Visit the [installation guide](https://developer.bigcommerce.com/stencil-docs/getting-started/installing-stencil) for more details.

## Usage

```text
Usage: stencil [options] [command]

Commands:

  init        Interactively create a .stencil file which configures how to run a BigCommerce store locally.
  start       Starts up BigCommerce store using theme files in the current directory.
  bundle      Bundles up the theme into a zip file which can be uploaded to BigCommerce.
  release     Create a new release in the theme's github repository.
  push        Bundles up the theme into a zip file and uploads it to your store.
  help [cmd]  display help for [cmd]

Options:

  -h, --help     output usage information
  -V, --version  output the version number
```

Run `stencil init` at the top level of your Stencil Theme. It will ask you a few questions to get your started.

Run `stencil start` to run a local server so you can start developing your theme.

Run with `-o` or `--open` to automatically open up a browser.

- While stencil is running, you can type "rs" and then hit enter to auto-reload all browsers. This is similar to Nodemon's rs option.
- Run with `-e` to load a local Theme Editor.

Run `stencil bundle` to validate your code and create a zip bundle file that can be uploaded to BigCommerce.

Run `stencil release` to tag a new version of your theme, create a [GitHub release](https://help.github.com/articles/about-releases/) in your theme repository, and upload the zip bundle file to the release assets. This is useful for tracking your changes in your Theme, and is the tool we use to create new releases in BigCommerce [Cornerstone](https://github.com/bigcommerce/stencil) theme.

## BrowserSync

Stencil CLI comes packaged with BrowserSync so you can take advantage of all of those amazing goodies! Have a look at their [web site](http://www.browsersync.io/) for more information.

## Sass compiling

You can compile Sass (node-sass) scss files in assets/scss into CSS. For example, add an scss file named theme.scss to assets/scss and `{{{stylesheet 'assets/css/theme.css'}}}` to your theme HTML template. Stencil-CLI will compile assets/scss/theme.scss to CSS on the fly.

## Autoprefixer

Stencil CLI comes packaged with [Autoprefixer](https://github.com/postcss/autoprefixer). You can set which browsers should be targeted, as well as if it should cascade the generated rules in the theme's config.json file with these options:

- `autoprefixer_cascade` - Defaults to `true`.
- `autoprefixer_browsers` - Defaults to `["> 1%", "last 2 versions", "Firefox ESR"]`.

## How to get help or report a bug

If you need any help or experience any bugs, please create a GitHub issue in this repository.

## Release stencil-cli
In order to release stencil-cli you should first use the `Squash and merge` option on GitHub, This step is important for generating the `CHANGELOG.md` file with the pr link attached (if not using `Squash and merge`, the changes will be logged only with links to the commits). After the changes are merged to master, pull the latest to your local environment, run `gulp release` and follow the prompts. NOTE: It is required that all commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0-beta.2/) structure.

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
