System.config({
  "baseURL": "/public/",
  "transpiler": "babel",
  "babelOptions": {
    "optional": [
      "runtime"
    ]
  },
  "paths": {
    "*": "*.js",
    "github:*": "jspm_packages/github/*.js",
    "npm:*": "jspm_packages/npm/*.js"
  },
  "shim": {
    "bigcommerce-labs/bcapp-pattern-lab": {
      "format": "global"
    }
  }
});

System.config({
  "map": {
    "angular": "github:angular/bower-angular@1.3.7",
    "angular-animate": "github:angular/bower-angular-animate@1.3.7",
    "angular-cookies": "github:angular/bower-angular-cookies@1.3.7",
    "angular-formly": "github:formly-js/angular-formly@7.3.3",
    "angular-sanitize": "github:angular/bower-angular-sanitize@1.3.7",
    "angular-ui-router": "github:angular-ui/ui-router@0.2.13",
    "api-check": "github:kentcdodds/api-check@7.5.3",
    "babel": "npm:babel-core@5.6.7",
    "babel-runtime": "npm:babel-runtime@5.6.7",
    "bigcommerce-labs/bcapp-pattern-lab": "github:bigcommerce-labs/bcapp-pattern-lab@1.14.4",
    "bigcommerce-labs/ng-common": "github:bigcommerce-labs/ng-common@2.5.1",
    "bigcommerce-labs/ng-stencil-editor": "github:bigcommerce-labs/ng-stencil-editor@1.2.3",
    "core-js": "npm:core-js@0.9.18",
    "jmdobry/angular-cache": "github:jmdobry/angular-cache@3.2.4",
    "js-cookie": "github:js-cookie/js-cookie@2.0.3",
    "kentcdodds/api-check": "github:kentcdodds/api-check@7.5.3",
    "lodash": "npm:lodash@2.4.1",
    "meenie/jschannel": "github:meenie/jschannel@0.0.5",
    "rubenv/angular-gettext": "github:rubenv/angular-gettext@1.1.4",
    "github:angular-ui/ui-router@0.2.13": {
      "angular": "github:angular/bower-angular@1.3.7"
    },
    "github:angular/bower-angular-animate@1.3.7": {
      "angular": "github:angular/bower-angular@1.3.7"
    },
    "github:angular/bower-angular-cookies@1.3.7": {
      "angular": "github:angular/bower-angular@1.3.7"
    },
    "github:angular/bower-angular-sanitize@1.3.7": {
      "angular": "github:angular/bower-angular@1.3.7"
    },
    "github:jspm/nodelibs-assert@0.1.0": {
      "assert": "npm:assert@1.3.0"
    },
    "github:jspm/nodelibs-process@0.1.2": {
      "process": "npm:process@0.11.2"
    },
    "github:jspm/nodelibs-util@0.1.0": {
      "util": "npm:util@0.10.3"
    },
    "npm:assert@1.3.0": {
      "util": "npm:util@0.10.3"
    },
    "npm:babel-runtime@5.6.7": {
      "process": "github:jspm/nodelibs-process@0.1.2"
    },
    "npm:core-js@0.9.18": {
      "fs": "github:jspm/nodelibs-fs@0.1.2",
      "process": "github:jspm/nodelibs-process@0.1.2",
      "systemjs-json": "github:systemjs/plugin-json@0.1.0"
    },
    "npm:inherits@2.0.1": {
      "util": "github:jspm/nodelibs-util@0.1.0"
    },
    "npm:lodash@2.4.1": {
      "process": "github:jspm/nodelibs-process@0.1.2"
    },
    "npm:process@0.11.2": {
      "assert": "github:jspm/nodelibs-assert@0.1.0"
    },
    "npm:util@0.10.3": {
      "inherits": "npm:inherits@2.0.1",
      "process": "github:jspm/nodelibs-process@0.1.2"
    }
  }
});

