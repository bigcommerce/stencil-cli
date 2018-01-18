// Globals
import _ from 'lodash';
import Channel from  'jschannel';

window._ = _;
window.Channel = Channel;

// ng-stencil-editor dependencies
import 'es6-micro-loader/dist/system-polyfill.min';
import 'angular';
import 'angular-cookies';
import 'angular-animate';
import 'angular-sanitize';
import "@uirouter/angularjs";
import 'angular-gettext';
import 'angular-cache';

import 'ng-common/dist/js/ng-common.min';

// pattern lab js
import 'script-loader!bcapp-pattern-lab/dist/js/bcapp-pattern-lab.min';

// main app
import 'script-loader!ng-stencil-editor/dist/js/ng-stencil-editor.min';
