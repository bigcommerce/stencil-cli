# Stencil CLI - Stencil Server emulator for local theme development

### Install

`$ npm install -g bigcommerce/stencil-cli`

### Usage

`$ stencil init` - Run this at the top level of your Stencil Theme.  It will ask you a few questions to get your started.  
`$ stencil start` - Run this to start developing your theme.

### BrowserSync

Stencil CLI comes packaged with BrowserSync so you can take advantage of all of those amazing goodies!  Have a look at their website for more information: http://www.browsersync.io/

### SASS/LESS Compiling

You are able to compile your CSS using either SASS (`node-sass`), LESS, or plain ol' css.  The theme developer can pick which compiler they want to use by editing the theme's `config.json` file and updating the `css_compiler` option to either `scss`, `less`, or `css`.  
There is only one convention you need to follow when choosing the compiler: Place your files in a folder under `./assets` with the same name as your extension.  For example, if you are using `scss`, you would place your `.scss` files in `./assets/scss`.  Stencil CLI will grab each **top level** file, compile it to CSS with an inline SourceMap and then place it in a directory called `./assets/css-artifacts` (this directory should be ignored by Git).  There is a route in the server which serves these CSS Artifacts via `/assets/css/*`.

### How To Get Help or Report A Bug

If you need any help or experience any bugs, please create a GitHub issue in this repo.
