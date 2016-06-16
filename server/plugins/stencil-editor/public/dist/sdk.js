/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/ 	// webpack-livereload-plugin
/******/ 	(function() {
/******/ 	  if (typeof window === "undefined") { return };
/******/ 	  var id = "webpack-livereload-plugin-script";
/******/ 	  if (document.getElementById(id)) { return; }
/******/ 	  var el = document.createElement("script");
/******/ 	  el.id = id;
/******/ 	  el.async = true;
/******/ 	  el.src = "http://localhost:35729/livereload.js";
/******/ 	  document.head.appendChild(el);
/******/ 	}());
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ({

/***/ 0:
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	window.Channel = __webpack_require__(3);
	window.Cookies = __webpack_require__(17);
	
	__webpack_require__(18);

/***/ },

/***/ 3:
/***/ function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_RESULT__;/*
	 * js_channel is a very lightweight abstraction on top of
	 * postMessage which defines message formats and semantics
	 * to support interactions more rich than just message passing
	 * js_channel supports:
	 *  + query/response - traditional rpc
	 *  + query/update/response - incremental async return of results
	 *    to a query
	 *  + notifications - fire and forget
	 *  + error handling
	 *
	 * js_channel is based heavily on json-rpc, but is focused at the
	 * problem of inter-iframe RPC.
	 *
	 * Message types:
	 *  There are 5 types of messages that can flow over this channel,
	 *  and you may determine what type of message an object is by
	 *  examining its parameters:
	 *  1. Requests
	 *    + integer id
	 *    + string method
	 *    + (optional) any params
	 *  2. Callback Invocations (or just "Callbacks")
	 *    + integer id
	 *    + string callback
	 *    + (optional) params
	 *  3. Error Responses (or just "Errors)
	 *    + integer id
	 *    + string error
	 *    + (optional) string message
	 *  4. Responses
	 *    + integer id
	 *    + (optional) any result
	 *  5. Notifications
	 *    + string method
	 *    + (optional) any params
	 */
	
	;var Channel = (function() {
	    "use strict";
	
	    // current transaction id, start out at a random *odd* number between 1 and a million
	    // There is one current transaction counter id per page, and it's shared between
	    // channel instances.  That means of all messages posted from a single javascript
	    // evaluation context, we'll never have two with the same id.
	    var s_curTranId = Math.floor(Math.random()*1000001);
	
	    // no two bound channels in the same javascript evaluation context may have the same origin, scope, and window.
	    // futher if two bound channels have the same window and scope, they may not have *overlapping* origins
	    // (either one or both support '*').  This restriction allows a single onMessage handler to efficiently
	    // route messages based on origin and scope.  The s_boundChans maps origins to scopes, to message
	    // handlers.  Request and Notification messages are routed using this table.
	    // Finally, channels are inserted into this table when built, and removed when destroyed.
	    var s_boundChans = { };
	
	    // add a channel to s_boundChans, throwing if a dup exists
	    function s_addBoundChan(win, origin, scope, handler) {
	        function hasWin(arr) {
	            for (var i = 0; i < arr.length; i++) if (arr[i].win === win) return true;
	            return false;
	        }
	
	        // does she exist?
	        var exists = false;
	
	
	        if (origin === '*') {
	            // we must check all other origins, sadly.
	            for (var k in s_boundChans) {
	                if (!s_boundChans.hasOwnProperty(k)) continue;
	                if (k === '*') continue;
	                if (typeof s_boundChans[k][scope] === 'object') {
	                    exists = hasWin(s_boundChans[k][scope]);
	                    if (exists) break;
	                }
	            }
	        } else {
	            // we must check only '*'
	            if ((s_boundChans['*'] && s_boundChans['*'][scope])) {
	                exists = hasWin(s_boundChans['*'][scope]);
	            }
	            if (!exists && s_boundChans[origin] && s_boundChans[origin][scope])
	            {
	                exists = hasWin(s_boundChans[origin][scope]);
	            }
	        }
	        if (exists) throw "A channel is already bound to the same window which overlaps with origin '"+ origin +"' and has scope '"+scope+"'";
	
	        if (typeof s_boundChans[origin] != 'object') s_boundChans[origin] = { };
	        if (typeof s_boundChans[origin][scope] != 'object') s_boundChans[origin][scope] = [ ];
	        s_boundChans[origin][scope].push({win: win, handler: handler});
	    }
	
	    function s_removeBoundChan(win, origin, scope) {
	        var arr = s_boundChans[origin][scope];
	        for (var i = 0; i < arr.length; i++) {
	            if (arr[i].win === win) {
	                arr.splice(i,1);
	            }
	        }
	        if (s_boundChans[origin][scope].length === 0) {
	            delete s_boundChans[origin][scope];
	        }
	    }
	
	    function s_isArray(obj) {
	        if (Array.isArray) return Array.isArray(obj);
	        else {
	            return (obj.constructor.toString().indexOf("Array") != -1);
	        }
	    }
	
	    // No two outstanding outbound messages may have the same id, period.  Given that, a single table
	    // mapping "transaction ids" to message handlers, allows efficient routing of Callback, Error, and
	    // Response messages.  Entries are added to this table when requests are sent, and removed when
	    // responses are received.
	    var s_transIds = { };
	
	    // class singleton onMessage handler
	    // this function is registered once and all incoming messages route through here.  This
	    // arrangement allows certain efficiencies, message data is only parsed once and dispatch
	    // is more efficient, especially for large numbers of simultaneous channels.
	    var s_onMessage = function(e) {
	        try {
	          var m = JSON.parse(e.data);
	          if (typeof m !== 'object' || m === null) throw "malformed";
	        } catch(e) {
	          // just ignore any posted messages that do not consist of valid JSON
	          return;
	        }
	
	        var w = e.source;
	        var o = e.origin;
	        var s, i, meth;
	
	        if (typeof m.method === 'string') {
	            var ar = m.method.split('::');
	            if (ar.length == 2) {
	                s = ar[0];
	                meth = ar[1];
	            } else {
	                meth = m.method;
	            }
	        }
	
	        if (typeof m.id !== 'undefined') i = m.id;
	
	        // w is message source window
	        // o is message origin
	        // m is parsed message
	        // s is message scope
	        // i is message id (or undefined)
	        // meth is unscoped method name
	        // ^^ based on these factors we can route the message
	
	        // if it has a method it's either a notification or a request,
	        // route using s_boundChans
	        if (typeof meth === 'string') {
	            var delivered = false;
	            if (s_boundChans[o] && s_boundChans[o][s]) {
	                for (var j = 0; j < s_boundChans[o][s].length; j++) {
	                    if (s_boundChans[o][s][j].win === w) {
	                        s_boundChans[o][s][j].handler(o, meth, m);
	                        delivered = true;
	                        break;
	                    }
	                }
	            }
	
	            if (!delivered && s_boundChans['*'] && s_boundChans['*'][s]) {
	                for (var j = 0; j < s_boundChans['*'][s].length; j++) {
	                    if (s_boundChans['*'][s][j].win === w) {
	                        s_boundChans['*'][s][j].handler(o, meth, m);
	                        break;
	                    }
	                }
	            }
	        }
	        // otherwise it must have an id (or be poorly formed
	        else if (typeof i != 'undefined') {
	            if (s_transIds[i]) s_transIds[i](o, meth, m);
	        }
	    };
	
	    // Setup postMessage event listeners
	    if (window.addEventListener) window.addEventListener('message', s_onMessage, false);
	    else if(window.attachEvent) window.attachEvent('onmessage', s_onMessage);
	
	    /* a messaging channel is constructed from a window and an origin.
	     * the channel will assert that all messages received over the
	     * channel match the origin
	     *
	     * Arguments to Channel.build(cfg):
	     *
	     *   cfg.window - the remote window with which we'll communicate
	     *   cfg.origin - the expected origin of the remote window, may be '*'
	     *                which matches any origin
	     *   cfg.scope  - the 'scope' of messages.  a scope string that is
	     *                prepended to message names.  local and remote endpoints
	     *                of a single channel must agree upon scope. Scope may
	     *                not contain double colons ('::').
	     *   cfg.debugOutput - A boolean value.  If true and window.console.log is
	     *                a function, then debug strings will be emitted to that
	     *                function.
	     *   cfg.debugOutput - A boolean value.  If true and window.console.log is
	     *                a function, then debug strings will be emitted to that
	     *                function.
	     *   cfg.postMessageObserver - A function that will be passed two arguments,
	     *                an origin and a message.  It will be passed these immediately
	     *                before messages are posted.
	     *   cfg.gotMessageObserver - A function that will be passed two arguments,
	     *                an origin and a message.  It will be passed these arguments
	     *                immediately after they pass scope and origin checks, but before
	     *                they are processed.
	     *   cfg.onReady - A function that will be invoked when a channel becomes "ready",
	     *                this occurs once both sides of the channel have been
	     *                instantiated and an application level handshake is exchanged.
	     *                the onReady function will be passed a single argument which is
	     *                the channel object that was returned from build().
	     *   cfg.reconnect - A boolean value - if true, the channel allows reconnection
	     *                useful when the page in a child frame is reloaded and wants
	     *                to re-establish connection with parent window using the same
	     *                origin, scope and bindings.
	     *
	     */
	    return {
	        build: function(cfg) {
	            var debug = function(m) {
	                if (cfg.debugOutput && window.console && window.console.log) {
	                    // try to stringify, if it doesn't work we'll let javascript's built in toString do its magic
	                    try { if (typeof m !== 'string') m = JSON.stringify(m); } catch(e) { }
	                    window.console.log("["+chanId+"] " + m);
	                }
	            };
	
	            /* browser capabilities check */
	            if (!window.postMessage) throw("jschannel cannot run this browser, no postMessage");
	            if (!window.JSON || !window.JSON.stringify || ! window.JSON.parse) {
	                throw("jschannel cannot run this browser, no JSON parsing/serialization");
	            }
	
	            /* basic argument validation */
	            if (typeof cfg != 'object') throw("Channel build invoked without a proper object argument");
	
	            if (!cfg.window || !cfg.window.postMessage) throw("Channel.build() called without a valid window argument");
	
	            /* we'd have to do a little more work to be able to run multiple channels that intercommunicate the same
	             * window...  Not sure if we care to support that */
	            if (window === cfg.window) throw("target window is same as present window -- not allowed");
	
	            // let's require that the client specify an origin.  if we just assume '*' we'll be
	            // propagating unsafe practices.  that would be lame.
	            var validOrigin = false;
	            if (typeof cfg.origin === 'string') {
	                var oMatch;
	                if (cfg.origin === "*") validOrigin = true;
	                // allow valid domains under http and https.  Also, trim paths off otherwise valid origins.
	                else if (null !== (oMatch = cfg.origin.match(/^https?:\/\/(?:[-a-zA-Z0-9_\.])+(?::\d+)?/))) {
	                    cfg.origin = oMatch[0].toLowerCase();
	                    validOrigin = true;
	                }
	            }
	
	            if (!validOrigin) throw ("Channel.build() called with an invalid origin");
	
	            if (typeof cfg.scope !== 'undefined') {
	                if (typeof cfg.scope !== 'string') throw 'scope, when specified, must be a string';
	                if (cfg.scope.split('::').length > 1) throw "scope may not contain double colons: '::'";
	            }
	
	            /* private variables */
	            // generate a random and psuedo unique id for this channel
	            var chanId = (function () {
	                var text = "";
	                var alpha = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	                for(var i=0; i < 5; i++) text += alpha.charAt(Math.floor(Math.random() * alpha.length));
	                return text;
	            })();
	
	            // registrations: mapping method names to call objects
	            var regTbl = { };
	            // current oustanding sent requests
	            var outTbl = { };
	            // current oustanding received requests
	            var inTbl = { };
	            // are we ready yet?  when false we will block outbound messages.
	            var ready = false;
	            var pendingQueue = [ ];
	
	            var createTransaction = function(id,origin,callbacks) {
	                var shouldDelayReturn = false;
	                var completed = false;
	
	                return {
	                    origin: origin,
	                    invoke: function(cbName, v) {
	                        // verify in table
	                        if (!inTbl[id]) throw "attempting to invoke a callback of a nonexistent transaction: " + id;
	                        // verify that the callback name is valid
	                        var valid = false;
	                        for (var i = 0; i < callbacks.length; i++) if (cbName === callbacks[i]) { valid = true; break; }
	                        if (!valid) throw "request supports no such callback '" + cbName + "'";
	
	                        // send callback invocation
	                        postMessage({ id: id, callback: cbName, params: v});
	                    },
	                    error: function(error, message) {
	                        completed = true;
	                        // verify in table
	                        if (!inTbl[id]) throw "error called for nonexistent message: " + id;
	
	                        // remove transaction from table
	                        delete inTbl[id];
	
	                        // send error
	                        postMessage({ id: id, error: error, message: message });
	                    },
	                    complete: function(v) {
	                        completed = true;
	                        // verify in table
	                        if (!inTbl[id]) throw "complete called for nonexistent message: " + id;
	                        // remove transaction from table
	                        delete inTbl[id];
	                        // send complete
	                        postMessage({ id: id, result: v });
	                    },
	                    delayReturn: function(delay) {
	                        if (typeof delay === 'boolean') {
	                            shouldDelayReturn = (delay === true);
	                        }
	                        return shouldDelayReturn;
	                    },
	                    completed: function() {
	                        return completed;
	                    }
	                };
	            };
	
	            var setTransactionTimeout = function(transId, timeout, method) {
	              return window.setTimeout(function() {
	                if (outTbl[transId]) {
	                  // XXX: what if client code raises an exception here?
	                  var msg = "timeout (" + timeout + "ms) exceeded on method '" + method + "'";
	                  (1,outTbl[transId].error)("timeout_error", msg);
	                  delete outTbl[transId];
	                  delete s_transIds[transId];
	                }
	              }, timeout);
	            };
	
	            var onMessage = function(origin, method, m) {
	                // if an observer was specified at allocation time, invoke it
	                if (typeof cfg.gotMessageObserver === 'function') {
	                    // pass observer a clone of the object so that our
	                    // manipulations are not visible (i.e. method unscoping).
	                    // This is not particularly efficient, but then we expect
	                    // that message observers are primarily for debugging anyway.
	                    try {
	                        cfg.gotMessageObserver(origin, m);
	                    } catch (e) {
	                        debug("gotMessageObserver() raised an exception: " + e.toString());
	                    }
	                }
	
	                // now, what type of message is this?
	                if (m.id && method) {
	                    // a request!  do we have a registered handler for this request?
	                    if (regTbl[method]) {
	                        var trans = createTransaction(m.id, origin, m.callbacks ? m.callbacks : [ ]);
	                        inTbl[m.id] = { };
	                        try {
	                            // callback handling.  we'll magically create functions inside the parameter list for each
	                            // callback
	                            if (m.callbacks && s_isArray(m.callbacks) && m.callbacks.length > 0) {
	                                for (var i = 0; i < m.callbacks.length; i++) {
	                                    var path = m.callbacks[i];
	                                    var obj = m.params;
	                                    var pathItems = path.split('/');
	                                    for (var j = 0; j < pathItems.length - 1; j++) {
	                                        var cp = pathItems[j];
	                                        if (typeof obj[cp] !== 'object') obj[cp] = { };
	                                        obj = obj[cp];
	                                    }
	                                    obj[pathItems[pathItems.length - 1]] = (function() {
	                                        var cbName = path;
	                                        return function(params) {
	                                            return trans.invoke(cbName, params);
	                                        };
	                                    })();
	                                }
	                            }
	                            var resp = regTbl[method](trans, m.params);
	                            if (!trans.delayReturn() && !trans.completed()) trans.complete(resp);
	                        } catch(e) {
	                            // automagic handling of exceptions:
	                            var error = "runtime_error";
	                            var message = null;
	                            // * if it's a string then it gets an error code of 'runtime_error' and string is the message
	                            if (typeof e === 'string') {
	                                message = e;
	                            } else if (typeof e === 'object') {
	                                // either an array or an object
	                                // * if it's an array of length two, then  array[0] is the code, array[1] is the error message
	                                if (e && s_isArray(e) && e.length == 2) {
	                                    error = e[0];
	                                    message = e[1];
	                                }
	                                // * if it's an object then we'll look form error and message parameters
	                                else if (typeof e.error === 'string') {
	                                    error = e.error;
	                                    if (!e.message) message = "";
	                                    else if (typeof e.message === 'string') message = e.message;
	                                    else e = e.message; // let the stringify/toString message give us a reasonable verbose error string
	                                }
	                            }
	
	                            // message is *still* null, let's try harder
	                            if (message === null) {
	                                try {
	                                    message = JSON.stringify(e);
	                                    /* On MSIE8, this can result in 'out of memory', which
	                                     * leaves message undefined. */
	                                    if (typeof(message) == 'undefined')
	                                      message = e.toString();
	                                } catch (e2) {
	                                    message = e.toString();
	                                }
	                            }
	
	                            trans.error(error,message);
	                        }
	                    }
	                } else if (m.id && m.callback) {
	                    if (!outTbl[m.id] ||!outTbl[m.id].callbacks || !outTbl[m.id].callbacks[m.callback])
	                    {
	                        debug("ignoring invalid callback, id:"+m.id+ " (" + m.callback +")");
	                    } else {
	                        // XXX: what if client code raises an exception here?
	                        outTbl[m.id].callbacks[m.callback](m.params);
	                    }
	                } else if (m.id) {
	                    if (!outTbl[m.id]) {
	                        debug("ignoring invalid response: " + m.id);
	                    } else {
	                        // XXX: what if client code raises an exception here?
	                        if (m.error) {
	                            (1,outTbl[m.id].error)(m.error, m.message);
	                        } else {
	                            if (m.result !== undefined) (1,outTbl[m.id].success)(m.result);
	                            else (1,outTbl[m.id].success)();
	                        }
	                        delete outTbl[m.id];
	                        delete s_transIds[m.id];
	                    }
	                } else if (method) {
	                    // tis a notification.
	                    if (regTbl[method]) {
	                        // yep, there's a handler for that.
	                        // transaction has only origin for notifications.
	                        regTbl[method]({ origin: origin }, m.params);
	                        // if the client throws, we'll just let it bubble out
	                        // what can we do?  Also, here we'll ignore return values
	                    }
	                }
	            };
	
	            // now register our bound channel for msg routing
	            s_addBoundChan(cfg.window, cfg.origin, ((typeof cfg.scope === 'string') ? cfg.scope : ''), onMessage);
	
	            // scope method names based on cfg.scope specified when the Channel was instantiated
	            var scopeMethod = function(m) {
	                if (typeof cfg.scope === 'string' && cfg.scope.length) m = [cfg.scope, m].join("::");
	                return m;
	            };
	
	            // a small wrapper around postmessage whose primary function is to handle the
	            // case that clients start sending messages before the other end is "ready"
	            var postMessage = function(msg, force) {
	                if (!msg) throw "postMessage called with null message";
	
	                // delay posting if we're not ready yet.
	                var verb = (ready ? "post  " : "queue ");
	                debug(verb + " message: " + JSON.stringify(msg));
	                if (!force && !ready) {
	                    pendingQueue.push(msg);
	                } else {
	                    if (typeof cfg.postMessageObserver === 'function') {
	                        try {
	                            cfg.postMessageObserver(cfg.origin, msg);
	                        } catch (e) {
	                            debug("postMessageObserver() raised an exception: " + e.toString());
	                        }
	                    }
	
	                    cfg.window.postMessage(JSON.stringify(msg), cfg.origin);
	                }
	            };
	
	            var onReady = function(trans, type) {
	                debug('ready msg received');
	                if (ready && !cfg.reconnect) {
	                    throw "received ready message while in ready state.  help!";
	                } else {
	                    ready = false;
	                }
	
	                // only append suffix to chanId once:
	                if (chanId.length < 6){
	                    chanId += (type === 'ping') ? '-R' : '-L';
	                }
	
	                //unbind ready handler unless we allow reconnecting:
	                if (!cfg.reconnect) {
	                    obj.unbind('__ready');
	                }
	
	                ready = true;
	                debug('ready msg accepted.');
	
	                if (type === 'ping') {
	                    obj.notify({ method: '__ready', params: 'pong' });
	                }
	
	                // flush queue
	                while (pendingQueue.length) {
	                    postMessage(pendingQueue.pop());
	                }
	
	                // invoke onReady observer if provided
	                if (typeof cfg.onReady === 'function') cfg.onReady(obj);
	            };
	
	            var obj = {
	                // tries to unbind a bound message handler.  returns false if not possible
	                unbind: function (method) {
	                    if (regTbl[method]) {
	                        if (!(delete regTbl[method])) throw ("can't delete method: " + method);
	                        return true;
	                    }
	                    return false;
	                },
	                bind: function (method, cb) {
	                    if (!method || typeof method !== 'string') throw "'method' argument to bind must be string";
	                    if (!cb || typeof cb !== 'function') throw "callback missing from bind params";
	
	                    if (regTbl[method]) throw "method '"+method+"' is already bound!";
	                    regTbl[method] = cb;
	                    return this;
	                },
	                call: function(m) {
	                    if (!m) throw 'missing arguments to call function';
	                    if (!m.method || typeof m.method !== 'string') throw "'method' argument to call must be string";
	                    if (!m.success || typeof m.success !== 'function') throw "'success' callback missing from call";
	
	                    // now it's time to support the 'callback' feature of jschannel.  We'll traverse the argument
	                    // object and pick out all of the functions that were passed as arguments.
	                    var callbacks = { };
	                    var callbackNames = [ ];
	                    var seen = [ ];
	
	                    var pruneFunctions = function (path, obj) {
	                        if (seen.indexOf(obj) >= 0) {
	                            throw "params cannot be a recursive data structure"
	                        }
	                        seen.push(obj);
	                       
	                        if (typeof obj === 'object') {
	                            for (var k in obj) {
	                                if (!obj.hasOwnProperty(k)) continue;
	                                var np = path + (path.length ? '/' : '') + k;
	                                if (typeof obj[k] === 'function') {
	                                    callbacks[np] = obj[k];
	                                    callbackNames.push(np);
	                                    delete obj[k];
	                                } else if (typeof obj[k] === 'object') {
	                                    pruneFunctions(np, obj[k]);
	                                }
	                            }
	                        }
	                    };
	                    pruneFunctions("", m.params);
	
	                    // build a 'request' message and send it
	                    var msg = { id: s_curTranId, method: scopeMethod(m.method), params: m.params };
	                    if (callbackNames.length) msg.callbacks = callbackNames;
	
	                    if (m.timeout)
	                      // XXX: This function returns a timeout ID, but we don't do anything with it.
	                      // We might want to keep track of it so we can cancel it using clearTimeout()
	                      // when the transaction completes.
	                      setTransactionTimeout(s_curTranId, m.timeout, scopeMethod(m.method));
	
	                    // insert into the transaction table
	                    outTbl[s_curTranId] = { callbacks: callbacks, error: m.error, success: m.success };
	                    s_transIds[s_curTranId] = onMessage;
	
	                    // increment current id
	                    s_curTranId++;
	
	                    postMessage(msg);
	                },
	                notify: function(m) {
	                    if (!m) throw 'missing arguments to notify function';
	                    if (!m.method || typeof m.method !== 'string') throw "'method' argument to notify must be string";
	
	                    // no need to go into any transaction table
	                    postMessage({ method: scopeMethod(m.method), params: m.params });
	                },
	                destroy: function () {
	                    s_removeBoundChan(cfg.window, cfg.origin, ((typeof cfg.scope === 'string') ? cfg.scope : ''));
	                    if (window.removeEventListener) window.removeEventListener('message', onMessage, false);
	                    else if(window.detachEvent) window.detachEvent('onmessage', onMessage);
	                    ready = false;
	                    regTbl = { };
	                    inTbl = { };
	                    outTbl = { };
	                    cfg.origin = null;
	                    pendingQueue = [ ];
	                    debug("channel destroyed");
	                    chanId = "";
	                }
	            };
	
	            obj.bind('__ready', onReady);
	            setTimeout(function() {
	                postMessage({ method: scopeMethod('__ready'), params: "ping" }, true);
	            }, 0);
	
	            return obj;
	        }
	    };
	})();
	
	//enable loading via AMD
	if (true) {
	    !(__WEBPACK_AMD_DEFINE_RESULT__ = function() {
	        return Channel;
	    }.call(exports, __webpack_require__, exports, module), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
	}
	
	// enable Node.JS requiring
	if (typeof module !== 'undefined' && module.exports !== undefined) {
	    module.exports = Channel;
	}


/***/ },

/***/ 17:
/***/ function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_RESULT__;/*!
	 * JavaScript Cookie v2.1.2
	 * https://github.com/js-cookie/js-cookie
	 *
	 * Copyright 2006, 2015 Klaus Hartl & Fagner Brack
	 * Released under the MIT license
	 */
	;(function (factory) {
		if (true) {
			!(__WEBPACK_AMD_DEFINE_FACTORY__ = (factory), __WEBPACK_AMD_DEFINE_RESULT__ = (typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ? (__WEBPACK_AMD_DEFINE_FACTORY__.call(exports, __webpack_require__, exports, module)) : __WEBPACK_AMD_DEFINE_FACTORY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
		} else if (typeof exports === 'object') {
			module.exports = factory();
		} else {
			var OldCookies = window.Cookies;
			var api = window.Cookies = factory();
			api.noConflict = function () {
				window.Cookies = OldCookies;
				return api;
			};
		}
	}(function () {
		function extend () {
			var i = 0;
			var result = {};
			for (; i < arguments.length; i++) {
				var attributes = arguments[ i ];
				for (var key in attributes) {
					result[key] = attributes[key];
				}
			}
			return result;
		}
	
		function init (converter) {
			function api (key, value, attributes) {
				var result;
				if (typeof document === 'undefined') {
					return;
				}
	
				// Write
	
				if (arguments.length > 1) {
					attributes = extend({
						path: '/'
					}, api.defaults, attributes);
	
					if (typeof attributes.expires === 'number') {
						var expires = new Date();
						expires.setMilliseconds(expires.getMilliseconds() + attributes.expires * 864e+5);
						attributes.expires = expires;
					}
	
					try {
						result = JSON.stringify(value);
						if (/^[\{\[]/.test(result)) {
							value = result;
						}
					} catch (e) {}
	
					if (!converter.write) {
						value = encodeURIComponent(String(value))
							.replace(/%(23|24|26|2B|3A|3C|3E|3D|2F|3F|40|5B|5D|5E|60|7B|7D|7C)/g, decodeURIComponent);
					} else {
						value = converter.write(value, key);
					}
	
					key = encodeURIComponent(String(key));
					key = key.replace(/%(23|24|26|2B|5E|60|7C)/g, decodeURIComponent);
					key = key.replace(/[\(\)]/g, escape);
	
					return (document.cookie = [
						key, '=', value,
						attributes.expires && '; expires=' + attributes.expires.toUTCString(), // use expires attribute, max-age is not supported by IE
						attributes.path    && '; path=' + attributes.path,
						attributes.domain  && '; domain=' + attributes.domain,
						attributes.secure ? '; secure' : ''
					].join(''));
				}
	
				// Read
	
				if (!key) {
					result = {};
				}
	
				// To prevent the for loop in the first place assign an empty array
				// in case there are no cookies at all. Also prevents odd result when
				// calling "get()"
				var cookies = document.cookie ? document.cookie.split('; ') : [];
				var rdecode = /(%[0-9A-Z]{2})+/g;
				var i = 0;
	
				for (; i < cookies.length; i++) {
					var parts = cookies[i].split('=');
					var cookie = parts.slice(1).join('=');
	
					if (cookie.charAt(0) === '"') {
						cookie = cookie.slice(1, -1);
					}
	
					try {
						var name = parts[0].replace(rdecode, decodeURIComponent);
						cookie = converter.read ?
							converter.read(cookie, name) : converter(cookie, name) ||
							cookie.replace(rdecode, decodeURIComponent);
	
						if (this.json) {
							try {
								cookie = JSON.parse(cookie);
							} catch (e) {}
						}
	
						if (key === name) {
							result = cookie;
							break;
						}
	
						if (!key) {
							result[name] = cookie;
						}
					} catch (e) {}
				}
	
				return result;
			}
	
			api.set = api;
			api.get = function (key) {
				return api(key);
			};
			api.getJSON = function () {
				return api.apply({
					json: true
				}, [].slice.call(arguments));
			};
			api.defaults = {};
	
			api.remove = function (key, attributes) {
				api(key, '', extend(attributes, {
					expires: -1
				}));
			};
	
			api.withConverter = init;
	
			return api;
		}
	
		return init(function () {});
	}));


/***/ },

/***/ 18:
/***/ function(module, exports) {

	'use strict';
	
	(function stencilEditorSDK(window, Channel, Cookies) {
	    var _configurationId = '',
	        // Adding a dot because cookie set by bcapp also adds a dot
	        _cookieDomain = (window.location.hostname === 'localhost' ? '' : '.') + window.location.hostname,
	        _cookieName = 'stencil_preview',
	        _noop = function() {},
	        _versionId = '';
	
	    init();
	
	    function init() {
	        if (runningInIframe()) {
	            registerEvents();
	        } else {
	            closePreview();
	        }
	    }
	
	    /**
	     * Adds a link element with the passed font url
	     * @param {string} fontUrl
	     * @param {object} options
	     */
	    function addFont(fontUrl, options) {
	        var link = document.createElement('link'),
	            linkLoadHandler;
	
	        options = options || {};
	        options.error = options.error || _noop;
	        options.success = options.success || _noop;
	
	        link.setAttribute('rel', 'stylesheet');
	        link.setAttribute('href', fontUrl);
	
	        linkLoadHandler = link.addEventListener('load', function newFontLoaded() {
	            options.success(fontUrl);
	
	            link.removeEventListener('load', linkLoadHandler);
	
	            focusBody();
	        });
	
	        document.head.appendChild(link);
	
	        return true;
	    }
	
	    /**
	     * Removes the cookie and reloads the page
	     */
	    function closePreview() {
	        Cookies.remove(_cookieName, {
	            domain: _cookieDomain
	        });
	
	        reloadPage();
	    }
	
	    /**
	     * Force the browser to repaint the page after a stylesheet update
	     */
	    function focusBody() {
	        document.body.focus();
	    }
	
	    /**
	     * Rewrite the cdn url to a relative path that includes the storeHash
	     * @param  {string} url
	     * @return {string}
	     */
	    function rewriteStylesheetUrl(url) {
	        var cdnUrlRegex = /[-|\/](\w+)\/stencil\/(.*)/i,
	            match = url.match(cdnUrlRegex),
	            storeHash,
	            cssPath;
	
	        if (match) {
	            storeHash = match[1];
	            cssPath = match[2];
	
	            return '/stencil/s-' + storeHash + '/' + cssPath;
	        }
	
	        return url;
	    }
	
	    /**
	     * Generate a stylesheet url replacing the configId
	     * and adding a query parameter with a timestamp
	     * @param  {string} url
	     * @param  {string} configurationId
	     * @return {string}
	     */
	    function generateStylesheetUrl(url, configurationId) {
	        var queryIndex = url.indexOf('?'),
	            stylesheetUrlRegex = /^(\/stencil\/.*\/).+?(\/css\/.*)/i,
	            match,
	            baseUrl,
	            cssPath;
	
	        if (queryIndex !== -1) {
	            url = url.substring(0, queryIndex);
	        }
	
	        url = rewriteStylesheetUrl(url);
	
	        match = url.match(stylesheetUrlRegex);
	
	        if (!match) {
	            throw new Error('Supplied url is not a valid stylesheet url');
	        }
	
	        baseUrl = match[1];
	        cssPath = match[2];
	
	        return baseUrl + configurationId + cssPath + '?preview=' + Date.now();
	    }
	
	    /**
	     * Return an array of stylesheet link elements
	     * @return {array}
	     */
	    function getStylesheets() {
	        var stylesheets = document.head.querySelectorAll('link[data-stencil-stylesheet]');
	
	        return Array.prototype.slice.call(stylesheets);
	    }
	
	    /*
	     * Registers JsChannel subscriptions
	     */
	    function registerEvents() {
	        var cookie = Cookies.get(_cookieName).split('@'),
	            chan = Channel.build({
	                window: window.parent,
	                origin: '*',
	                onReady: emitReady,
	                scope: 'stencilEditor'
	            });
	
	        // the version id & config id will already be set by the server
	        // when the iframe is loaded for the first time
	        _versionId = cookie[0];
	        _configurationId = cookie[1];
	
	        // Register jsChannel events
	        chan.bind('add-font', addFontHandler);
	        chan.bind('reload-stylesheets', reloadStylesheetsHandler);
	        chan.bind('reload-page', reloadPageHandler);
	        chan.bind('set-cookie', setCookieHandler);
	
	        // Listen on fucus event and reset the preview cookie
	        window.addEventListener('focus', onFocusHandler);
	
	        window.onbeforeunload = function emitOnUnload() {
	            emitNotReady();
	        };
	
	        /**
	         * Emit the 'sdk-ready' event.
	         * @return channel
	         */
	        function emitReady() {
	            chan.call({
	                method: 'sdk-ready',
	                success: _noop,
	                error: _noop
	            });
	
	            return chan;
	        }
	
	        function emitNotReady() {
	            chan.call({
	                method: 'sdk-not-ready',
	                success: _noop,
	                error: _noop
	            });
	
	            return chan;
	        }
	
	        function addFontHandler(trans, data) {
	            var fontUrl = JSON.parse(data).fontUrl,
	                options = {
	                    error: function(message) {
	                        trans.error(message);
	                    },
	                    success: function(message) {
	                        trans.complete(message);
	                    }
	                };
	
	            trans.delayReturn(true);
	
	            return addFont(fontUrl, options);
	        }
	
	        function reloadStylesheetsHandler(trans, data) {
	            var configurationId = JSON.parse(data).configurationId,
	                loadedStylesheetsCount = getLoadedStylesheets().length,
	                options = {
	                    error: callOnce(onError),
	                    // call trans.complete once after all stylesheets have been reloaded
	                    success: callAfterNTimes(loadedStylesheetsCount, onSuccess)
	                };
	
	            function onError(message) {
	                return trans.error(message);
	            }
	            function onSuccess(message) {
	                return trans.complete(message);
	            }
	
	            trans.delayReturn(true);
	
	            setCookie(configurationId);
	
	            return reloadStylesheets(configurationId, options);
	
	        }
	
	        /**
	         * Get the stylesheets on the page and filter for ones that are loaded.
	         * @return {Array} Array of stylesheet nodes
	         */
	        function getLoadedStylesheets() {
	            return getStylesheets().filter(function(link) {
	                return !link.hasAttribute('data-is-loading');
	            });
	        }
	
	        /**
	         * Invoke the callback after the nth time this function has been called. See _.after in underscore or lodash.
	         * @param  {Number} n The number of calls before func is invoked.
	         * @param  {Function} func The callback function to invoke.
	         * @return {Function} The new restricted function.
	         */
	        function callAfterNTimes(n, func) {
	            return function callAfterFunc() {
	                if (--n < 1) {
	                  return func.apply(this, arguments);
	                }
	            };
	        }
	
	        /**
	         * Creates a function that is restricted to invoking func once. Repeat calls to the function returns the value of the first invocation.
	         * @param  {Function} func The callback function to invoke.
	         * @return {Function} The new restricted function.
	         */
	        function callOnce(func) {
	            var called = false,
	                result;
	
	            return function onceFunc() {
	                if (!called) {
	                    called = true;
	                    result = func.apply(this, arguments);
	                }
	
	                return result;
	            }
	        }
	
	        function reloadPageHandler() {
	            return reloadPage();
	        }
	
	        function setCookieHandler(trans, jsonData) {
	            var data = JSON.parse(jsonData);
	            var configurationId = data.configurationId;
	            var versionId = data.versionId;
	
	            return setCookie(configurationId, versionId);
	        }
	
	        function onFocusHandler() {
	            setCookie(_configurationId, _versionId);
	        }
	    }
	
	    /**
	     * Reloads the current page
	     * @returns {boolean}
	     */
	    function reloadPage() {
	        document.location.reload(true);
	
	        return true;
	    }
	
	    /**
	     * Reloads stylesheets by appending Date.now() to their href
	     * @returns {boolean}
	     */
	    function reloadStylesheets(configurationId, options) {
	        options = options || {};
	        options.error = options.error || _noop;
	        options.success = options.success || _noop;
	
	        getStylesheets().forEach(updateStylesheet.bind(null, configurationId, options));
	
	        return true;
	    }
	
	    function updateStylesheet(configurationId, options, currentLink) {
	        var url = currentLink.getAttribute('href'),
	            newLink;
	
	        if (!url) {
	            return;
	        }
	
	        if (currentLink.hasAttribute('data-is-loading')) {
	            document.head.removeChild(currentLink);
	        } else {
	            newLink = currentLink.cloneNode(false);
	
	            newLink.setAttribute('href', generateStylesheetUrl(url, configurationId));
	            newLink.setAttribute('data-is-loading', true);
	
	            newLink.addEventListener('load', stylesheetLoad);
	            newLink.addEventListener('error', stylesheetError);
	
	            // Insert the new stylesheet before the old one to avoid any flash of un-styled content. The load
	            // and error events only work for the initial load, which is why we replace the link on each update.
	            document.head.insertBefore(newLink, currentLink);
	        }
	
	        function stylesheetLoad() {
	            newLink.removeAttribute('data-is-loading');
	
	            // Destroy any existing handlers to save memory on subsequent stylesheet changes
	            newLink.removeEventListener('error', stylesheetError);
	            newLink.removeEventListener('load', stylesheetLoad);
	
	
	            // Remove the old stylesheet to allow the new one to take over
	            document.head.removeChild(currentLink);
	
	            options.success(url);
	
	            focusBody();
	        }
	
	        function stylesheetError() {
	            options.error(url);
	
	            // Something went wrong with our new stylesheet, so destroy it and keep the old one
	            newLink.removeEventListener('error', stylesheetError);
	            newLink.removeEventListener('load', stylesheetLoad);
	
	            document.head.removeChild(newLink);
	        }
	    }
	
	    /**
	     * Checks if the current window is being run inside an iframe
	     * @returns {boolean}
	     */
	    function runningInIframe() {
	        try {
	            return window.self !== window.top;
	        } catch(e) {
	            return true;
	        }
	    }
	
	    /**
	     * Sets the cookie
	     * @param {string} configurationId
	     * @param {string} versionId
	     */
	    function setCookie(configurationId, versionId) {
	        if (configurationId) {
	            _configurationId = configurationId;
	        }
	
	        if (versionId) {
	            _versionId = versionId;
	        }
	
	        // Adding a dot because cookie set by bcapp also adds a dot
	        Cookies.set(_cookieName, _versionId + '@' + _configurationId, {
	            domain: _cookieDomain
	        });
	    }
	
	})(window, window.Channel, window.Cookies);


/***/ }

/******/ });
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAgYzE3ODgxMjhiODYzYjZmMWZmMTA/MGVjYSIsIndlYnBhY2s6Ly8vLi9zZXJ2ZXIvcGx1Z2lucy9zdGVuY2lsLWVkaXRvci9qcy9zZGsuanMiLCJ3ZWJwYWNrOi8vLy4vfi9qc2NoYW5uZWwvc3JjL2pzY2hhbm5lbC5qcz9mMTJiIiwid2VicGFjazovLy8uL34vanMtY29va2llL3NyYy9qcy5jb29raWUuanMiLCJ3ZWJwYWNrOi8vLy4uL2JpZ2NvbW1lcmNlLWFwcC12bS9jb2RlYmFzZXMvbmctc3RlbmNpbC1lZGl0b3Ivc3JjL3N0YXRpYy9zZGsvc2RrLXN0ZW5jaWwtZWRpdG9yLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSx1QkFBZTtBQUNmO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOzs7QUFHQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxnREFBd0M7QUFDeEM7QUFDQSw4Q0FBc0MsUUFBUTtBQUM5QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsV0FBRzs7QUFFSDtBQUNBOzs7Ozs7Ozs7O0FDakRBLFFBQU8sT0FBUCxHQUFpQixvQkFBUSxDQUFSLENBQWpCO0FBQ0EsUUFBTyxPQUFQLEdBQWlCLG9CQUFRLEVBQVIsQ0FBakI7O0FBRUEscUJBQVEsRUFBUixFOzs7Ozs7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsRUFBQztB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QUM3QixxQkFBb0IsU0FBUztBQUM3QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxxQkFBb0IsU0FBUztBQUM3QixxQkFBb0IsU0FBUztBQUM3QjtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0Esa0JBQWlCO0FBQ2pCO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxrQkFBaUI7QUFDakI7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLFVBQVM7QUFDVDs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7OztBQUdBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLGtCQUFpQjtBQUNqQjtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVM7QUFDVDtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLGdCQUFlLE9BQU87QUFDdEIsZ0JBQWUsT0FBTztBQUN0QjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxVQUFTO0FBQ1Q7O0FBRUEsRUFBQyIsImZpbGUiOiJzZGsuanMiLCJzb3VyY2VzQ29udGVudCI6WyIgXHQvLyBUaGUgbW9kdWxlIGNhY2hlXG4gXHR2YXIgaW5zdGFsbGVkTW9kdWxlcyA9IHt9O1xuXG4gXHQvLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuIFx0ZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXG4gXHRcdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuIFx0XHRpZihpbnN0YWxsZWRNb2R1bGVzW21vZHVsZUlkXSlcbiBcdFx0XHRyZXR1cm4gaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0uZXhwb3J0cztcblxuIFx0XHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuIFx0XHR2YXIgbW9kdWxlID0gaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0gPSB7XG4gXHRcdFx0ZXhwb3J0czoge30sXG4gXHRcdFx0aWQ6IG1vZHVsZUlkLFxuIFx0XHRcdGxvYWRlZDogZmFsc2VcbiBcdFx0fTtcblxuIFx0XHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cbiBcdFx0bW9kdWxlc1ttb2R1bGVJZF0uY2FsbChtb2R1bGUuZXhwb3J0cywgbW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cbiBcdFx0Ly8gRmxhZyB0aGUgbW9kdWxlIGFzIGxvYWRlZFxuIFx0XHRtb2R1bGUubG9hZGVkID0gdHJ1ZTtcblxuIFx0XHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuIFx0XHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG4gXHR9XG5cblxuIFx0Ly8gZXhwb3NlIHRoZSBtb2R1bGVzIG9iamVjdCAoX193ZWJwYWNrX21vZHVsZXNfXylcbiBcdF9fd2VicGFja19yZXF1aXJlX18ubSA9IG1vZHVsZXM7XG5cbiBcdC8vIGV4cG9zZSB0aGUgbW9kdWxlIGNhY2hlXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLmMgPSBpbnN0YWxsZWRNb2R1bGVzO1xuXG4gXHQvLyBfX3dlYnBhY2tfcHVibGljX3BhdGhfX1xuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5wID0gXCJcIjtcbiBcdC8vIHdlYnBhY2stbGl2ZXJlbG9hZC1wbHVnaW5cbiBcdChmdW5jdGlvbigpIHtcbiBcdCAgaWYgKHR5cGVvZiB3aW5kb3cgPT09IFwidW5kZWZpbmVkXCIpIHsgcmV0dXJuIH07XG4gXHQgIHZhciBpZCA9IFwid2VicGFjay1saXZlcmVsb2FkLXBsdWdpbi1zY3JpcHRcIjtcbiBcdCAgaWYgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlkKSkgeyByZXR1cm47IH1cbiBcdCAgdmFyIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNjcmlwdFwiKTtcbiBcdCAgZWwuaWQgPSBpZDtcbiBcdCAgZWwuYXN5bmMgPSB0cnVlO1xuIFx0ICBlbC5zcmMgPSBcImh0dHA6Ly9sb2NhbGhvc3Q6MzU3MjkvbGl2ZXJlbG9hZC5qc1wiO1xuIFx0ICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKGVsKTtcbiBcdH0oKSk7XG5cbiBcdC8vIExvYWQgZW50cnkgbW9kdWxlIGFuZCByZXR1cm4gZXhwb3J0c1xuIFx0cmV0dXJuIF9fd2VicGFja19yZXF1aXJlX18oMCk7XG5cblxuXG4vKiogV0VCUEFDSyBGT09URVIgKipcbiAqKiB3ZWJwYWNrL2Jvb3RzdHJhcCBjMTc4ODEyOGI4NjNiNmYxZmYxMFxuICoqLyIsIndpbmRvdy5DaGFubmVsID0gcmVxdWlyZSgnanNjaGFubmVsJyk7XG53aW5kb3cuQ29va2llcyA9IHJlcXVpcmUoJ2pzLWNvb2tpZScpO1xuXG5yZXF1aXJlKCduZy1zdGVuY2lsLWVkaXRvci9zcmMvc3RhdGljL3Nkay9zZGstc3RlbmNpbC1lZGl0b3InKTtcblxuXG5cbi8qKiBXRUJQQUNLIEZPT1RFUiAqKlxuICoqIC4vc2VydmVyL3BsdWdpbnMvc3RlbmNpbC1lZGl0b3IvanMvc2RrLmpzXG4gKiovIiwiLypcbiAqIGpzX2NoYW5uZWwgaXMgYSB2ZXJ5IGxpZ2h0d2VpZ2h0IGFic3RyYWN0aW9uIG9uIHRvcCBvZlxuICogcG9zdE1lc3NhZ2Ugd2hpY2ggZGVmaW5lcyBtZXNzYWdlIGZvcm1hdHMgYW5kIHNlbWFudGljc1xuICogdG8gc3VwcG9ydCBpbnRlcmFjdGlvbnMgbW9yZSByaWNoIHRoYW4ganVzdCBtZXNzYWdlIHBhc3NpbmdcbiAqIGpzX2NoYW5uZWwgc3VwcG9ydHM6XG4gKiAgKyBxdWVyeS9yZXNwb25zZSAtIHRyYWRpdGlvbmFsIHJwY1xuICogICsgcXVlcnkvdXBkYXRlL3Jlc3BvbnNlIC0gaW5jcmVtZW50YWwgYXN5bmMgcmV0dXJuIG9mIHJlc3VsdHNcbiAqICAgIHRvIGEgcXVlcnlcbiAqICArIG5vdGlmaWNhdGlvbnMgLSBmaXJlIGFuZCBmb3JnZXRcbiAqICArIGVycm9yIGhhbmRsaW5nXG4gKlxuICoganNfY2hhbm5lbCBpcyBiYXNlZCBoZWF2aWx5IG9uIGpzb24tcnBjLCBidXQgaXMgZm9jdXNlZCBhdCB0aGVcbiAqIHByb2JsZW0gb2YgaW50ZXItaWZyYW1lIFJQQy5cbiAqXG4gKiBNZXNzYWdlIHR5cGVzOlxuICogIFRoZXJlIGFyZSA1IHR5cGVzIG9mIG1lc3NhZ2VzIHRoYXQgY2FuIGZsb3cgb3ZlciB0aGlzIGNoYW5uZWwsXG4gKiAgYW5kIHlvdSBtYXkgZGV0ZXJtaW5lIHdoYXQgdHlwZSBvZiBtZXNzYWdlIGFuIG9iamVjdCBpcyBieVxuICogIGV4YW1pbmluZyBpdHMgcGFyYW1ldGVyczpcbiAqICAxLiBSZXF1ZXN0c1xuICogICAgKyBpbnRlZ2VyIGlkXG4gKiAgICArIHN0cmluZyBtZXRob2RcbiAqICAgICsgKG9wdGlvbmFsKSBhbnkgcGFyYW1zXG4gKiAgMi4gQ2FsbGJhY2sgSW52b2NhdGlvbnMgKG9yIGp1c3QgXCJDYWxsYmFja3NcIilcbiAqICAgICsgaW50ZWdlciBpZFxuICogICAgKyBzdHJpbmcgY2FsbGJhY2tcbiAqICAgICsgKG9wdGlvbmFsKSBwYXJhbXNcbiAqICAzLiBFcnJvciBSZXNwb25zZXMgKG9yIGp1c3QgXCJFcnJvcnMpXG4gKiAgICArIGludGVnZXIgaWRcbiAqICAgICsgc3RyaW5nIGVycm9yXG4gKiAgICArIChvcHRpb25hbCkgc3RyaW5nIG1lc3NhZ2VcbiAqICA0LiBSZXNwb25zZXNcbiAqICAgICsgaW50ZWdlciBpZFxuICogICAgKyAob3B0aW9uYWwpIGFueSByZXN1bHRcbiAqICA1LiBOb3RpZmljYXRpb25zXG4gKiAgICArIHN0cmluZyBtZXRob2RcbiAqICAgICsgKG9wdGlvbmFsKSBhbnkgcGFyYW1zXG4gKi9cblxuO3ZhciBDaGFubmVsID0gKGZ1bmN0aW9uKCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgLy8gY3VycmVudCB0cmFuc2FjdGlvbiBpZCwgc3RhcnQgb3V0IGF0IGEgcmFuZG9tICpvZGQqIG51bWJlciBiZXR3ZWVuIDEgYW5kIGEgbWlsbGlvblxuICAgIC8vIFRoZXJlIGlzIG9uZSBjdXJyZW50IHRyYW5zYWN0aW9uIGNvdW50ZXIgaWQgcGVyIHBhZ2UsIGFuZCBpdCdzIHNoYXJlZCBiZXR3ZWVuXG4gICAgLy8gY2hhbm5lbCBpbnN0YW5jZXMuICBUaGF0IG1lYW5zIG9mIGFsbCBtZXNzYWdlcyBwb3N0ZWQgZnJvbSBhIHNpbmdsZSBqYXZhc2NyaXB0XG4gICAgLy8gZXZhbHVhdGlvbiBjb250ZXh0LCB3ZSdsbCBuZXZlciBoYXZlIHR3byB3aXRoIHRoZSBzYW1lIGlkLlxuICAgIHZhciBzX2N1clRyYW5JZCA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSoxMDAwMDAxKTtcblxuICAgIC8vIG5vIHR3byBib3VuZCBjaGFubmVscyBpbiB0aGUgc2FtZSBqYXZhc2NyaXB0IGV2YWx1YXRpb24gY29udGV4dCBtYXkgaGF2ZSB0aGUgc2FtZSBvcmlnaW4sIHNjb3BlLCBhbmQgd2luZG93LlxuICAgIC8vIGZ1dGhlciBpZiB0d28gYm91bmQgY2hhbm5lbHMgaGF2ZSB0aGUgc2FtZSB3aW5kb3cgYW5kIHNjb3BlLCB0aGV5IG1heSBub3QgaGF2ZSAqb3ZlcmxhcHBpbmcqIG9yaWdpbnNcbiAgICAvLyAoZWl0aGVyIG9uZSBvciBib3RoIHN1cHBvcnQgJyonKS4gIFRoaXMgcmVzdHJpY3Rpb24gYWxsb3dzIGEgc2luZ2xlIG9uTWVzc2FnZSBoYW5kbGVyIHRvIGVmZmljaWVudGx5XG4gICAgLy8gcm91dGUgbWVzc2FnZXMgYmFzZWQgb24gb3JpZ2luIGFuZCBzY29wZS4gIFRoZSBzX2JvdW5kQ2hhbnMgbWFwcyBvcmlnaW5zIHRvIHNjb3BlcywgdG8gbWVzc2FnZVxuICAgIC8vIGhhbmRsZXJzLiAgUmVxdWVzdCBhbmQgTm90aWZpY2F0aW9uIG1lc3NhZ2VzIGFyZSByb3V0ZWQgdXNpbmcgdGhpcyB0YWJsZS5cbiAgICAvLyBGaW5hbGx5LCBjaGFubmVscyBhcmUgaW5zZXJ0ZWQgaW50byB0aGlzIHRhYmxlIHdoZW4gYnVpbHQsIGFuZCByZW1vdmVkIHdoZW4gZGVzdHJveWVkLlxuICAgIHZhciBzX2JvdW5kQ2hhbnMgPSB7IH07XG5cbiAgICAvLyBhZGQgYSBjaGFubmVsIHRvIHNfYm91bmRDaGFucywgdGhyb3dpbmcgaWYgYSBkdXAgZXhpc3RzXG4gICAgZnVuY3Rpb24gc19hZGRCb3VuZENoYW4od2luLCBvcmlnaW4sIHNjb3BlLCBoYW5kbGVyKSB7XG4gICAgICAgIGZ1bmN0aW9uIGhhc1dpbihhcnIpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSsrKSBpZiAoYXJyW2ldLndpbiA9PT0gd2luKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRvZXMgc2hlIGV4aXN0P1xuICAgICAgICB2YXIgZXhpc3RzID0gZmFsc2U7XG5cblxuICAgICAgICBpZiAob3JpZ2luID09PSAnKicpIHtcbiAgICAgICAgICAgIC8vIHdlIG11c3QgY2hlY2sgYWxsIG90aGVyIG9yaWdpbnMsIHNhZGx5LlxuICAgICAgICAgICAgZm9yICh2YXIgayBpbiBzX2JvdW5kQ2hhbnMpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXNfYm91bmRDaGFucy5oYXNPd25Qcm9wZXJ0eShrKSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgaWYgKGsgPT09ICcqJykgY29udGludWU7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBzX2JvdW5kQ2hhbnNba11bc2NvcGVdID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICBleGlzdHMgPSBoYXNXaW4oc19ib3VuZENoYW5zW2tdW3Njb3BlXSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChleGlzdHMpIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHdlIG11c3QgY2hlY2sgb25seSAnKidcbiAgICAgICAgICAgIGlmICgoc19ib3VuZENoYW5zWycqJ10gJiYgc19ib3VuZENoYW5zWycqJ11bc2NvcGVdKSkge1xuICAgICAgICAgICAgICAgIGV4aXN0cyA9IGhhc1dpbihzX2JvdW5kQ2hhbnNbJyonXVtzY29wZV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFleGlzdHMgJiYgc19ib3VuZENoYW5zW29yaWdpbl0gJiYgc19ib3VuZENoYW5zW29yaWdpbl1bc2NvcGVdKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGV4aXN0cyA9IGhhc1dpbihzX2JvdW5kQ2hhbnNbb3JpZ2luXVtzY29wZV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChleGlzdHMpIHRocm93IFwiQSBjaGFubmVsIGlzIGFscmVhZHkgYm91bmQgdG8gdGhlIHNhbWUgd2luZG93IHdoaWNoIG92ZXJsYXBzIHdpdGggb3JpZ2luICdcIisgb3JpZ2luICtcIicgYW5kIGhhcyBzY29wZSAnXCIrc2NvcGUrXCInXCI7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBzX2JvdW5kQ2hhbnNbb3JpZ2luXSAhPSAnb2JqZWN0Jykgc19ib3VuZENoYW5zW29yaWdpbl0gPSB7IH07XG4gICAgICAgIGlmICh0eXBlb2Ygc19ib3VuZENoYW5zW29yaWdpbl1bc2NvcGVdICE9ICdvYmplY3QnKSBzX2JvdW5kQ2hhbnNbb3JpZ2luXVtzY29wZV0gPSBbIF07XG4gICAgICAgIHNfYm91bmRDaGFuc1tvcmlnaW5dW3Njb3BlXS5wdXNoKHt3aW46IHdpbiwgaGFuZGxlcjogaGFuZGxlcn0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNfcmVtb3ZlQm91bmRDaGFuKHdpbiwgb3JpZ2luLCBzY29wZSkge1xuICAgICAgICB2YXIgYXJyID0gc19ib3VuZENoYW5zW29yaWdpbl1bc2NvcGVdO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGFycltpXS53aW4gPT09IHdpbikge1xuICAgICAgICAgICAgICAgIGFyci5zcGxpY2UoaSwxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoc19ib3VuZENoYW5zW29yaWdpbl1bc2NvcGVdLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgZGVsZXRlIHNfYm91bmRDaGFuc1tvcmlnaW5dW3Njb3BlXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNfaXNBcnJheShvYmopIHtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkpIHJldHVybiBBcnJheS5pc0FycmF5KG9iaik7XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIChvYmouY29uc3RydWN0b3IudG9TdHJpbmcoKS5pbmRleE9mKFwiQXJyYXlcIikgIT0gLTEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gTm8gdHdvIG91dHN0YW5kaW5nIG91dGJvdW5kIG1lc3NhZ2VzIG1heSBoYXZlIHRoZSBzYW1lIGlkLCBwZXJpb2QuICBHaXZlbiB0aGF0LCBhIHNpbmdsZSB0YWJsZVxuICAgIC8vIG1hcHBpbmcgXCJ0cmFuc2FjdGlvbiBpZHNcIiB0byBtZXNzYWdlIGhhbmRsZXJzLCBhbGxvd3MgZWZmaWNpZW50IHJvdXRpbmcgb2YgQ2FsbGJhY2ssIEVycm9yLCBhbmRcbiAgICAvLyBSZXNwb25zZSBtZXNzYWdlcy4gIEVudHJpZXMgYXJlIGFkZGVkIHRvIHRoaXMgdGFibGUgd2hlbiByZXF1ZXN0cyBhcmUgc2VudCwgYW5kIHJlbW92ZWQgd2hlblxuICAgIC8vIHJlc3BvbnNlcyBhcmUgcmVjZWl2ZWQuXG4gICAgdmFyIHNfdHJhbnNJZHMgPSB7IH07XG5cbiAgICAvLyBjbGFzcyBzaW5nbGV0b24gb25NZXNzYWdlIGhhbmRsZXJcbiAgICAvLyB0aGlzIGZ1bmN0aW9uIGlzIHJlZ2lzdGVyZWQgb25jZSBhbmQgYWxsIGluY29taW5nIG1lc3NhZ2VzIHJvdXRlIHRocm91Z2ggaGVyZS4gIFRoaXNcbiAgICAvLyBhcnJhbmdlbWVudCBhbGxvd3MgY2VydGFpbiBlZmZpY2llbmNpZXMsIG1lc3NhZ2UgZGF0YSBpcyBvbmx5IHBhcnNlZCBvbmNlIGFuZCBkaXNwYXRjaFxuICAgIC8vIGlzIG1vcmUgZWZmaWNpZW50LCBlc3BlY2lhbGx5IGZvciBsYXJnZSBudW1iZXJzIG9mIHNpbXVsdGFuZW91cyBjaGFubmVscy5cbiAgICB2YXIgc19vbk1lc3NhZ2UgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdmFyIG0gPSBKU09OLnBhcnNlKGUuZGF0YSk7XG4gICAgICAgICAgaWYgKHR5cGVvZiBtICE9PSAnb2JqZWN0JyB8fCBtID09PSBudWxsKSB0aHJvdyBcIm1hbGZvcm1lZFwiO1xuICAgICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgICAvLyBqdXN0IGlnbm9yZSBhbnkgcG9zdGVkIG1lc3NhZ2VzIHRoYXQgZG8gbm90IGNvbnNpc3Qgb2YgdmFsaWQgSlNPTlxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciB3ID0gZS5zb3VyY2U7XG4gICAgICAgIHZhciBvID0gZS5vcmlnaW47XG4gICAgICAgIHZhciBzLCBpLCBtZXRoO1xuXG4gICAgICAgIGlmICh0eXBlb2YgbS5tZXRob2QgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB2YXIgYXIgPSBtLm1ldGhvZC5zcGxpdCgnOjonKTtcbiAgICAgICAgICAgIGlmIChhci5sZW5ndGggPT0gMikge1xuICAgICAgICAgICAgICAgIHMgPSBhclswXTtcbiAgICAgICAgICAgICAgICBtZXRoID0gYXJbMV07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG1ldGggPSBtLm1ldGhvZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2YgbS5pZCAhPT0gJ3VuZGVmaW5lZCcpIGkgPSBtLmlkO1xuXG4gICAgICAgIC8vIHcgaXMgbWVzc2FnZSBzb3VyY2Ugd2luZG93XG4gICAgICAgIC8vIG8gaXMgbWVzc2FnZSBvcmlnaW5cbiAgICAgICAgLy8gbSBpcyBwYXJzZWQgbWVzc2FnZVxuICAgICAgICAvLyBzIGlzIG1lc3NhZ2Ugc2NvcGVcbiAgICAgICAgLy8gaSBpcyBtZXNzYWdlIGlkIChvciB1bmRlZmluZWQpXG4gICAgICAgIC8vIG1ldGggaXMgdW5zY29wZWQgbWV0aG9kIG5hbWVcbiAgICAgICAgLy8gXl4gYmFzZWQgb24gdGhlc2UgZmFjdG9ycyB3ZSBjYW4gcm91dGUgdGhlIG1lc3NhZ2VcblxuICAgICAgICAvLyBpZiBpdCBoYXMgYSBtZXRob2QgaXQncyBlaXRoZXIgYSBub3RpZmljYXRpb24gb3IgYSByZXF1ZXN0LFxuICAgICAgICAvLyByb3V0ZSB1c2luZyBzX2JvdW5kQ2hhbnNcbiAgICAgICAgaWYgKHR5cGVvZiBtZXRoID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgdmFyIGRlbGl2ZXJlZCA9IGZhbHNlO1xuICAgICAgICAgICAgaWYgKHNfYm91bmRDaGFuc1tvXSAmJiBzX2JvdW5kQ2hhbnNbb11bc10pIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IHNfYm91bmRDaGFuc1tvXVtzXS5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc19ib3VuZENoYW5zW29dW3NdW2pdLndpbiA9PT0gdykge1xuICAgICAgICAgICAgICAgICAgICAgICAgc19ib3VuZENoYW5zW29dW3NdW2pdLmhhbmRsZXIobywgbWV0aCwgbSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxpdmVyZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghZGVsaXZlcmVkICYmIHNfYm91bmRDaGFuc1snKiddICYmIHNfYm91bmRDaGFuc1snKiddW3NdKSB7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBzX2JvdW5kQ2hhbnNbJyonXVtzXS5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc19ib3VuZENoYW5zWycqJ11bc11bal0ud2luID09PSB3KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzX2JvdW5kQ2hhbnNbJyonXVtzXVtqXS5oYW5kbGVyKG8sIG1ldGgsIG0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gb3RoZXJ3aXNlIGl0IG11c3QgaGF2ZSBhbiBpZCAob3IgYmUgcG9vcmx5IGZvcm1lZFxuICAgICAgICBlbHNlIGlmICh0eXBlb2YgaSAhPSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgaWYgKHNfdHJhbnNJZHNbaV0pIHNfdHJhbnNJZHNbaV0obywgbWV0aCwgbSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gU2V0dXAgcG9zdE1lc3NhZ2UgZXZlbnQgbGlzdGVuZXJzXG4gICAgaWYgKHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKSB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIHNfb25NZXNzYWdlLCBmYWxzZSk7XG4gICAgZWxzZSBpZih3aW5kb3cuYXR0YWNoRXZlbnQpIHdpbmRvdy5hdHRhY2hFdmVudCgnb25tZXNzYWdlJywgc19vbk1lc3NhZ2UpO1xuXG4gICAgLyogYSBtZXNzYWdpbmcgY2hhbm5lbCBpcyBjb25zdHJ1Y3RlZCBmcm9tIGEgd2luZG93IGFuZCBhbiBvcmlnaW4uXG4gICAgICogdGhlIGNoYW5uZWwgd2lsbCBhc3NlcnQgdGhhdCBhbGwgbWVzc2FnZXMgcmVjZWl2ZWQgb3ZlciB0aGVcbiAgICAgKiBjaGFubmVsIG1hdGNoIHRoZSBvcmlnaW5cbiAgICAgKlxuICAgICAqIEFyZ3VtZW50cyB0byBDaGFubmVsLmJ1aWxkKGNmZyk6XG4gICAgICpcbiAgICAgKiAgIGNmZy53aW5kb3cgLSB0aGUgcmVtb3RlIHdpbmRvdyB3aXRoIHdoaWNoIHdlJ2xsIGNvbW11bmljYXRlXG4gICAgICogICBjZmcub3JpZ2luIC0gdGhlIGV4cGVjdGVkIG9yaWdpbiBvZiB0aGUgcmVtb3RlIHdpbmRvdywgbWF5IGJlICcqJ1xuICAgICAqICAgICAgICAgICAgICAgIHdoaWNoIG1hdGNoZXMgYW55IG9yaWdpblxuICAgICAqICAgY2ZnLnNjb3BlICAtIHRoZSAnc2NvcGUnIG9mIG1lc3NhZ2VzLiAgYSBzY29wZSBzdHJpbmcgdGhhdCBpc1xuICAgICAqICAgICAgICAgICAgICAgIHByZXBlbmRlZCB0byBtZXNzYWdlIG5hbWVzLiAgbG9jYWwgYW5kIHJlbW90ZSBlbmRwb2ludHNcbiAgICAgKiAgICAgICAgICAgICAgICBvZiBhIHNpbmdsZSBjaGFubmVsIG11c3QgYWdyZWUgdXBvbiBzY29wZS4gU2NvcGUgbWF5XG4gICAgICogICAgICAgICAgICAgICAgbm90IGNvbnRhaW4gZG91YmxlIGNvbG9ucyAoJzo6JykuXG4gICAgICogICBjZmcuZGVidWdPdXRwdXQgLSBBIGJvb2xlYW4gdmFsdWUuICBJZiB0cnVlIGFuZCB3aW5kb3cuY29uc29sZS5sb2cgaXNcbiAgICAgKiAgICAgICAgICAgICAgICBhIGZ1bmN0aW9uLCB0aGVuIGRlYnVnIHN0cmluZ3Mgd2lsbCBiZSBlbWl0dGVkIHRvIHRoYXRcbiAgICAgKiAgICAgICAgICAgICAgICBmdW5jdGlvbi5cbiAgICAgKiAgIGNmZy5kZWJ1Z091dHB1dCAtIEEgYm9vbGVhbiB2YWx1ZS4gIElmIHRydWUgYW5kIHdpbmRvdy5jb25zb2xlLmxvZyBpc1xuICAgICAqICAgICAgICAgICAgICAgIGEgZnVuY3Rpb24sIHRoZW4gZGVidWcgc3RyaW5ncyB3aWxsIGJlIGVtaXR0ZWQgdG8gdGhhdFxuICAgICAqICAgICAgICAgICAgICAgIGZ1bmN0aW9uLlxuICAgICAqICAgY2ZnLnBvc3RNZXNzYWdlT2JzZXJ2ZXIgLSBBIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBwYXNzZWQgdHdvIGFyZ3VtZW50cyxcbiAgICAgKiAgICAgICAgICAgICAgICBhbiBvcmlnaW4gYW5kIGEgbWVzc2FnZS4gIEl0IHdpbGwgYmUgcGFzc2VkIHRoZXNlIGltbWVkaWF0ZWx5XG4gICAgICogICAgICAgICAgICAgICAgYmVmb3JlIG1lc3NhZ2VzIGFyZSBwb3N0ZWQuXG4gICAgICogICBjZmcuZ290TWVzc2FnZU9ic2VydmVyIC0gQSBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgcGFzc2VkIHR3byBhcmd1bWVudHMsXG4gICAgICogICAgICAgICAgICAgICAgYW4gb3JpZ2luIGFuZCBhIG1lc3NhZ2UuICBJdCB3aWxsIGJlIHBhc3NlZCB0aGVzZSBhcmd1bWVudHNcbiAgICAgKiAgICAgICAgICAgICAgICBpbW1lZGlhdGVseSBhZnRlciB0aGV5IHBhc3Mgc2NvcGUgYW5kIG9yaWdpbiBjaGVja3MsIGJ1dCBiZWZvcmVcbiAgICAgKiAgICAgICAgICAgICAgICB0aGV5IGFyZSBwcm9jZXNzZWQuXG4gICAgICogICBjZmcub25SZWFkeSAtIEEgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGludm9rZWQgd2hlbiBhIGNoYW5uZWwgYmVjb21lcyBcInJlYWR5XCIsXG4gICAgICogICAgICAgICAgICAgICAgdGhpcyBvY2N1cnMgb25jZSBib3RoIHNpZGVzIG9mIHRoZSBjaGFubmVsIGhhdmUgYmVlblxuICAgICAqICAgICAgICAgICAgICAgIGluc3RhbnRpYXRlZCBhbmQgYW4gYXBwbGljYXRpb24gbGV2ZWwgaGFuZHNoYWtlIGlzIGV4Y2hhbmdlZC5cbiAgICAgKiAgICAgICAgICAgICAgICB0aGUgb25SZWFkeSBmdW5jdGlvbiB3aWxsIGJlIHBhc3NlZCBhIHNpbmdsZSBhcmd1bWVudCB3aGljaCBpc1xuICAgICAqICAgICAgICAgICAgICAgIHRoZSBjaGFubmVsIG9iamVjdCB0aGF0IHdhcyByZXR1cm5lZCBmcm9tIGJ1aWxkKCkuXG4gICAgICogICBjZmcucmVjb25uZWN0IC0gQSBib29sZWFuIHZhbHVlIC0gaWYgdHJ1ZSwgdGhlIGNoYW5uZWwgYWxsb3dzIHJlY29ubmVjdGlvblxuICAgICAqICAgICAgICAgICAgICAgIHVzZWZ1bCB3aGVuIHRoZSBwYWdlIGluIGEgY2hpbGQgZnJhbWUgaXMgcmVsb2FkZWQgYW5kIHdhbnRzXG4gICAgICogICAgICAgICAgICAgICAgdG8gcmUtZXN0YWJsaXNoIGNvbm5lY3Rpb24gd2l0aCBwYXJlbnQgd2luZG93IHVzaW5nIHRoZSBzYW1lXG4gICAgICogICAgICAgICAgICAgICAgb3JpZ2luLCBzY29wZSBhbmQgYmluZGluZ3MuXG4gICAgICpcbiAgICAgKi9cbiAgICByZXR1cm4ge1xuICAgICAgICBidWlsZDogZnVuY3Rpb24oY2ZnKSB7XG4gICAgICAgICAgICB2YXIgZGVidWcgPSBmdW5jdGlvbihtKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNmZy5kZWJ1Z091dHB1dCAmJiB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gdHJ5IHRvIHN0cmluZ2lmeSwgaWYgaXQgZG9lc24ndCB3b3JrIHdlJ2xsIGxldCBqYXZhc2NyaXB0J3MgYnVpbHQgaW4gdG9TdHJpbmcgZG8gaXRzIG1hZ2ljXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7IGlmICh0eXBlb2YgbSAhPT0gJ3N0cmluZycpIG0gPSBKU09OLnN0cmluZ2lmeShtKTsgfSBjYXRjaChlKSB7IH1cbiAgICAgICAgICAgICAgICAgICAgd2luZG93LmNvbnNvbGUubG9nKFwiW1wiK2NoYW5JZCtcIl0gXCIgKyBtKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvKiBicm93c2VyIGNhcGFiaWxpdGllcyBjaGVjayAqL1xuICAgICAgICAgICAgaWYgKCF3aW5kb3cucG9zdE1lc3NhZ2UpIHRocm93KFwianNjaGFubmVsIGNhbm5vdCBydW4gdGhpcyBicm93c2VyLCBubyBwb3N0TWVzc2FnZVwiKTtcbiAgICAgICAgICAgIGlmICghd2luZG93LkpTT04gfHwgIXdpbmRvdy5KU09OLnN0cmluZ2lmeSB8fCAhIHdpbmRvdy5KU09OLnBhcnNlKSB7XG4gICAgICAgICAgICAgICAgdGhyb3coXCJqc2NoYW5uZWwgY2Fubm90IHJ1biB0aGlzIGJyb3dzZXIsIG5vIEpTT04gcGFyc2luZy9zZXJpYWxpemF0aW9uXCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvKiBiYXNpYyBhcmd1bWVudCB2YWxpZGF0aW9uICovXG4gICAgICAgICAgICBpZiAodHlwZW9mIGNmZyAhPSAnb2JqZWN0JykgdGhyb3coXCJDaGFubmVsIGJ1aWxkIGludm9rZWQgd2l0aG91dCBhIHByb3BlciBvYmplY3QgYXJndW1lbnRcIik7XG5cbiAgICAgICAgICAgIGlmICghY2ZnLndpbmRvdyB8fCAhY2ZnLndpbmRvdy5wb3N0TWVzc2FnZSkgdGhyb3coXCJDaGFubmVsLmJ1aWxkKCkgY2FsbGVkIHdpdGhvdXQgYSB2YWxpZCB3aW5kb3cgYXJndW1lbnRcIik7XG5cbiAgICAgICAgICAgIC8qIHdlJ2QgaGF2ZSB0byBkbyBhIGxpdHRsZSBtb3JlIHdvcmsgdG8gYmUgYWJsZSB0byBydW4gbXVsdGlwbGUgY2hhbm5lbHMgdGhhdCBpbnRlcmNvbW11bmljYXRlIHRoZSBzYW1lXG4gICAgICAgICAgICAgKiB3aW5kb3cuLi4gIE5vdCBzdXJlIGlmIHdlIGNhcmUgdG8gc3VwcG9ydCB0aGF0ICovXG4gICAgICAgICAgICBpZiAod2luZG93ID09PSBjZmcud2luZG93KSB0aHJvdyhcInRhcmdldCB3aW5kb3cgaXMgc2FtZSBhcyBwcmVzZW50IHdpbmRvdyAtLSBub3QgYWxsb3dlZFwiKTtcblxuICAgICAgICAgICAgLy8gbGV0J3MgcmVxdWlyZSB0aGF0IHRoZSBjbGllbnQgc3BlY2lmeSBhbiBvcmlnaW4uICBpZiB3ZSBqdXN0IGFzc3VtZSAnKicgd2UnbGwgYmVcbiAgICAgICAgICAgIC8vIHByb3BhZ2F0aW5nIHVuc2FmZSBwcmFjdGljZXMuICB0aGF0IHdvdWxkIGJlIGxhbWUuXG4gICAgICAgICAgICB2YXIgdmFsaWRPcmlnaW4gPSBmYWxzZTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgY2ZnLm9yaWdpbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICB2YXIgb01hdGNoO1xuICAgICAgICAgICAgICAgIGlmIChjZmcub3JpZ2luID09PSBcIipcIikgdmFsaWRPcmlnaW4gPSB0cnVlO1xuICAgICAgICAgICAgICAgIC8vIGFsbG93IHZhbGlkIGRvbWFpbnMgdW5kZXIgaHR0cCBhbmQgaHR0cHMuICBBbHNvLCB0cmltIHBhdGhzIG9mZiBvdGhlcndpc2UgdmFsaWQgb3JpZ2lucy5cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChudWxsICE9PSAob01hdGNoID0gY2ZnLm9yaWdpbi5tYXRjaCgvXmh0dHBzPzpcXC9cXC8oPzpbLWEtekEtWjAtOV9cXC5dKSsoPzo6XFxkKyk/LykpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNmZy5vcmlnaW4gPSBvTWF0Y2hbMF0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgdmFsaWRPcmlnaW4gPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCF2YWxpZE9yaWdpbikgdGhyb3cgKFwiQ2hhbm5lbC5idWlsZCgpIGNhbGxlZCB3aXRoIGFuIGludmFsaWQgb3JpZ2luXCIpO1xuXG4gICAgICAgICAgICBpZiAodHlwZW9mIGNmZy5zY29wZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNmZy5zY29wZSAhPT0gJ3N0cmluZycpIHRocm93ICdzY29wZSwgd2hlbiBzcGVjaWZpZWQsIG11c3QgYmUgYSBzdHJpbmcnO1xuICAgICAgICAgICAgICAgIGlmIChjZmcuc2NvcGUuc3BsaXQoJzo6JykubGVuZ3RoID4gMSkgdGhyb3cgXCJzY29wZSBtYXkgbm90IGNvbnRhaW4gZG91YmxlIGNvbG9uczogJzo6J1wiO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvKiBwcml2YXRlIHZhcmlhYmxlcyAqL1xuICAgICAgICAgICAgLy8gZ2VuZXJhdGUgYSByYW5kb20gYW5kIHBzdWVkbyB1bmlxdWUgaWQgZm9yIHRoaXMgY2hhbm5lbFxuICAgICAgICAgICAgdmFyIGNoYW5JZCA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdmFyIHRleHQgPSBcIlwiO1xuICAgICAgICAgICAgICAgIHZhciBhbHBoYSA9IFwiYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXpBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWjAxMjM0NTY3ODlcIjtcbiAgICAgICAgICAgICAgICBmb3IodmFyIGk9MDsgaSA8IDU7IGkrKykgdGV4dCArPSBhbHBoYS5jaGFyQXQoTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogYWxwaGEubGVuZ3RoKSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRleHQ7XG4gICAgICAgICAgICB9KSgpO1xuXG4gICAgICAgICAgICAvLyByZWdpc3RyYXRpb25zOiBtYXBwaW5nIG1ldGhvZCBuYW1lcyB0byBjYWxsIG9iamVjdHNcbiAgICAgICAgICAgIHZhciByZWdUYmwgPSB7IH07XG4gICAgICAgICAgICAvLyBjdXJyZW50IG91c3RhbmRpbmcgc2VudCByZXF1ZXN0c1xuICAgICAgICAgICAgdmFyIG91dFRibCA9IHsgfTtcbiAgICAgICAgICAgIC8vIGN1cnJlbnQgb3VzdGFuZGluZyByZWNlaXZlZCByZXF1ZXN0c1xuICAgICAgICAgICAgdmFyIGluVGJsID0geyB9O1xuICAgICAgICAgICAgLy8gYXJlIHdlIHJlYWR5IHlldD8gIHdoZW4gZmFsc2Ugd2Ugd2lsbCBibG9jayBvdXRib3VuZCBtZXNzYWdlcy5cbiAgICAgICAgICAgIHZhciByZWFkeSA9IGZhbHNlO1xuICAgICAgICAgICAgdmFyIHBlbmRpbmdRdWV1ZSA9IFsgXTtcblxuICAgICAgICAgICAgdmFyIGNyZWF0ZVRyYW5zYWN0aW9uID0gZnVuY3Rpb24oaWQsb3JpZ2luLGNhbGxiYWNrcykge1xuICAgICAgICAgICAgICAgIHZhciBzaG91bGREZWxheVJldHVybiA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHZhciBjb21wbGV0ZWQgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIG9yaWdpbjogb3JpZ2luLFxuICAgICAgICAgICAgICAgICAgICBpbnZva2U6IGZ1bmN0aW9uKGNiTmFtZSwgdikge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdmVyaWZ5IGluIHRhYmxlXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWluVGJsW2lkXSkgdGhyb3cgXCJhdHRlbXB0aW5nIHRvIGludm9rZSBhIGNhbGxiYWNrIG9mIGEgbm9uZXhpc3RlbnQgdHJhbnNhY3Rpb246IFwiICsgaWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB2ZXJpZnkgdGhhdCB0aGUgY2FsbGJhY2sgbmFtZSBpcyB2YWxpZFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHZhbGlkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNhbGxiYWNrcy5sZW5ndGg7IGkrKykgaWYgKGNiTmFtZSA9PT0gY2FsbGJhY2tzW2ldKSB7IHZhbGlkID0gdHJ1ZTsgYnJlYWs7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdmFsaWQpIHRocm93IFwicmVxdWVzdCBzdXBwb3J0cyBubyBzdWNoIGNhbGxiYWNrICdcIiArIGNiTmFtZSArIFwiJ1wiO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzZW5kIGNhbGxiYWNrIGludm9jYXRpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc3RNZXNzYWdlKHsgaWQ6IGlkLCBjYWxsYmFjazogY2JOYW1lLCBwYXJhbXM6IHZ9KTtcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGVycm9yLCBtZXNzYWdlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wbGV0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdmVyaWZ5IGluIHRhYmxlXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWluVGJsW2lkXSkgdGhyb3cgXCJlcnJvciBjYWxsZWQgZm9yIG5vbmV4aXN0ZW50IG1lc3NhZ2U6IFwiICsgaWQ7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJlbW92ZSB0cmFuc2FjdGlvbiBmcm9tIHRhYmxlXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgaW5UYmxbaWRdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzZW5kIGVycm9yXG4gICAgICAgICAgICAgICAgICAgICAgICBwb3N0TWVzc2FnZSh7IGlkOiBpZCwgZXJyb3I6IGVycm9yLCBtZXNzYWdlOiBtZXNzYWdlIH0pO1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBjb21wbGV0ZTogZnVuY3Rpb24odikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29tcGxldGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHZlcmlmeSBpbiB0YWJsZVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpblRibFtpZF0pIHRocm93IFwiY29tcGxldGUgY2FsbGVkIGZvciBub25leGlzdGVudCBtZXNzYWdlOiBcIiArIGlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gcmVtb3ZlIHRyYW5zYWN0aW9uIGZyb20gdGFibGVcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBpblRibFtpZF07XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzZW5kIGNvbXBsZXRlXG4gICAgICAgICAgICAgICAgICAgICAgICBwb3N0TWVzc2FnZSh7IGlkOiBpZCwgcmVzdWx0OiB2IH0pO1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBkZWxheVJldHVybjogZnVuY3Rpb24oZGVsYXkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZGVsYXkgPT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNob3VsZERlbGF5UmV0dXJuID0gKGRlbGF5ID09PSB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzaG91bGREZWxheVJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgY29tcGxldGVkOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjb21wbGV0ZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdmFyIHNldFRyYW5zYWN0aW9uVGltZW91dCA9IGZ1bmN0aW9uKHRyYW5zSWQsIHRpbWVvdXQsIG1ldGhvZCkge1xuICAgICAgICAgICAgICByZXR1cm4gd2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgaWYgKG91dFRibFt0cmFuc0lkXSkge1xuICAgICAgICAgICAgICAgICAgLy8gWFhYOiB3aGF0IGlmIGNsaWVudCBjb2RlIHJhaXNlcyBhbiBleGNlcHRpb24gaGVyZT9cbiAgICAgICAgICAgICAgICAgIHZhciBtc2cgPSBcInRpbWVvdXQgKFwiICsgdGltZW91dCArIFwibXMpIGV4Y2VlZGVkIG9uIG1ldGhvZCAnXCIgKyBtZXRob2QgKyBcIidcIjtcbiAgICAgICAgICAgICAgICAgICgxLG91dFRibFt0cmFuc0lkXS5lcnJvcikoXCJ0aW1lb3V0X2Vycm9yXCIsIG1zZyk7XG4gICAgICAgICAgICAgICAgICBkZWxldGUgb3V0VGJsW3RyYW5zSWRdO1xuICAgICAgICAgICAgICAgICAgZGVsZXRlIHNfdHJhbnNJZHNbdHJhbnNJZF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9LCB0aW1lb3V0KTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHZhciBvbk1lc3NhZ2UgPSBmdW5jdGlvbihvcmlnaW4sIG1ldGhvZCwgbSkge1xuICAgICAgICAgICAgICAgIC8vIGlmIGFuIG9ic2VydmVyIHdhcyBzcGVjaWZpZWQgYXQgYWxsb2NhdGlvbiB0aW1lLCBpbnZva2UgaXRcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNmZy5nb3RNZXNzYWdlT2JzZXJ2ZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcGFzcyBvYnNlcnZlciBhIGNsb25lIG9mIHRoZSBvYmplY3Qgc28gdGhhdCBvdXJcbiAgICAgICAgICAgICAgICAgICAgLy8gbWFuaXB1bGF0aW9ucyBhcmUgbm90IHZpc2libGUgKGkuZS4gbWV0aG9kIHVuc2NvcGluZykuXG4gICAgICAgICAgICAgICAgICAgIC8vIFRoaXMgaXMgbm90IHBhcnRpY3VsYXJseSBlZmZpY2llbnQsIGJ1dCB0aGVuIHdlIGV4cGVjdFxuICAgICAgICAgICAgICAgICAgICAvLyB0aGF0IG1lc3NhZ2Ugb2JzZXJ2ZXJzIGFyZSBwcmltYXJpbHkgZm9yIGRlYnVnZ2luZyBhbnl3YXkuXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjZmcuZ290TWVzc2FnZU9ic2VydmVyKG9yaWdpbiwgbSk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlYnVnKFwiZ290TWVzc2FnZU9ic2VydmVyKCkgcmFpc2VkIGFuIGV4Y2VwdGlvbjogXCIgKyBlLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gbm93LCB3aGF0IHR5cGUgb2YgbWVzc2FnZSBpcyB0aGlzP1xuICAgICAgICAgICAgICAgIGlmIChtLmlkICYmIG1ldGhvZCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBhIHJlcXVlc3QhICBkbyB3ZSBoYXZlIGEgcmVnaXN0ZXJlZCBoYW5kbGVyIGZvciB0aGlzIHJlcXVlc3Q/XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWdUYmxbbWV0aG9kXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHRyYW5zID0gY3JlYXRlVHJhbnNhY3Rpb24obS5pZCwgb3JpZ2luLCBtLmNhbGxiYWNrcyA/IG0uY2FsbGJhY2tzIDogWyBdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluVGJsW20uaWRdID0geyB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjYWxsYmFjayBoYW5kbGluZy4gIHdlJ2xsIG1hZ2ljYWxseSBjcmVhdGUgZnVuY3Rpb25zIGluc2lkZSB0aGUgcGFyYW1ldGVyIGxpc3QgZm9yIGVhY2hcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjYWxsYmFja1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtLmNhbGxiYWNrcyAmJiBzX2lzQXJyYXkobS5jYWxsYmFja3MpICYmIG0uY2FsbGJhY2tzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtLmNhbGxiYWNrcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHBhdGggPSBtLmNhbGxiYWNrc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBvYmogPSBtLnBhcmFtcztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBwYXRoSXRlbXMgPSBwYXRoLnNwbGl0KCcvJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IHBhdGhJdGVtcy5sZW5ndGggLSAxOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY3AgPSBwYXRoSXRlbXNbal07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBvYmpbY3BdICE9PSAnb2JqZWN0Jykgb2JqW2NwXSA9IHsgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmogPSBvYmpbY3BdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqW3BhdGhJdGVtc1twYXRoSXRlbXMubGVuZ3RoIC0gMV1dID0gKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjYk5hbWUgPSBwYXRoO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihwYXJhbXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRyYW5zLmludm9rZShjYk5hbWUsIHBhcmFtcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3AgPSByZWdUYmxbbWV0aG9kXSh0cmFucywgbS5wYXJhbXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdHJhbnMuZGVsYXlSZXR1cm4oKSAmJiAhdHJhbnMuY29tcGxldGVkKCkpIHRyYW5zLmNvbXBsZXRlKHJlc3ApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYXV0b21hZ2ljIGhhbmRsaW5nIG9mIGV4Y2VwdGlvbnM6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGVycm9yID0gXCJydW50aW1lX2Vycm9yXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG1lc3NhZ2UgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vICogaWYgaXQncyBhIHN0cmluZyB0aGVuIGl0IGdldHMgYW4gZXJyb3IgY29kZSBvZiAncnVudGltZV9lcnJvcicgYW5kIHN0cmluZyBpcyB0aGUgbWVzc2FnZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZSA9IGU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZWl0aGVyIGFuIGFycmF5IG9yIGFuIG9iamVjdFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyAqIGlmIGl0J3MgYW4gYXJyYXkgb2YgbGVuZ3RoIHR3bywgdGhlbiAgYXJyYXlbMF0gaXMgdGhlIGNvZGUsIGFycmF5WzFdIGlzIHRoZSBlcnJvciBtZXNzYWdlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlICYmIHNfaXNBcnJheShlKSAmJiBlLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvciA9IGVbMF07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlID0gZVsxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyAqIGlmIGl0J3MgYW4gb2JqZWN0IHRoZW4gd2UnbGwgbG9vayBmb3JtIGVycm9yIGFuZCBtZXNzYWdlIHBhcmFtZXRlcnNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAodHlwZW9mIGUuZXJyb3IgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvciA9IGUuZXJyb3I7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWUubWVzc2FnZSkgbWVzc2FnZSA9IFwiXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICh0eXBlb2YgZS5tZXNzYWdlID09PSAnc3RyaW5nJykgbWVzc2FnZSA9IGUubWVzc2FnZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgZSA9IGUubWVzc2FnZTsgLy8gbGV0IHRoZSBzdHJpbmdpZnkvdG9TdHJpbmcgbWVzc2FnZSBnaXZlIHVzIGEgcmVhc29uYWJsZSB2ZXJib3NlIGVycm9yIHN0cmluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbWVzc2FnZSBpcyAqc3RpbGwqIG51bGwsIGxldCdzIHRyeSBoYXJkZXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobWVzc2FnZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZSA9IEpTT04uc3RyaW5naWZ5KGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLyogT24gTVNJRTgsIHRoaXMgY2FuIHJlc3VsdCBpbiAnb3V0IG9mIG1lbW9yeScsIHdoaWNoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKiBsZWF2ZXMgbWVzc2FnZSB1bmRlZmluZWQuICovXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mKG1lc3NhZ2UpID09ICd1bmRlZmluZWQnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlID0gZS50b1N0cmluZygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZSA9IGUudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zLmVycm9yKGVycm9yLG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtLmlkICYmIG0uY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFvdXRUYmxbbS5pZF0gfHwhb3V0VGJsW20uaWRdLmNhbGxiYWNrcyB8fCAhb3V0VGJsW20uaWRdLmNhbGxiYWNrc1ttLmNhbGxiYWNrXSlcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVidWcoXCJpZ25vcmluZyBpbnZhbGlkIGNhbGxiYWNrLCBpZDpcIittLmlkKyBcIiAoXCIgKyBtLmNhbGxiYWNrICtcIilcIik7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBYWFg6IHdoYXQgaWYgY2xpZW50IGNvZGUgcmFpc2VzIGFuIGV4Y2VwdGlvbiBoZXJlP1xuICAgICAgICAgICAgICAgICAgICAgICAgb3V0VGJsW20uaWRdLmNhbGxiYWNrc1ttLmNhbGxiYWNrXShtLnBhcmFtcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG0uaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFvdXRUYmxbbS5pZF0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlYnVnKFwiaWdub3JpbmcgaW52YWxpZCByZXNwb25zZTogXCIgKyBtLmlkKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFhYWDogd2hhdCBpZiBjbGllbnQgY29kZSByYWlzZXMgYW4gZXhjZXB0aW9uIGhlcmU/XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobS5lcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICgxLG91dFRibFttLmlkXS5lcnJvcikobS5lcnJvciwgbS5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG0ucmVzdWx0ICE9PSB1bmRlZmluZWQpICgxLG91dFRibFttLmlkXS5zdWNjZXNzKShtLnJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSAoMSxvdXRUYmxbbS5pZF0uc3VjY2VzcykoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBvdXRUYmxbbS5pZF07XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgc190cmFuc0lkc1ttLmlkXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobWV0aG9kKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHRpcyBhIG5vdGlmaWNhdGlvbi5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlZ1RibFttZXRob2RdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB5ZXAsIHRoZXJlJ3MgYSBoYW5kbGVyIGZvciB0aGF0LlxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdHJhbnNhY3Rpb24gaGFzIG9ubHkgb3JpZ2luIGZvciBub3RpZmljYXRpb25zLlxuICAgICAgICAgICAgICAgICAgICAgICAgcmVnVGJsW21ldGhvZF0oeyBvcmlnaW46IG9yaWdpbiB9LCBtLnBhcmFtcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpZiB0aGUgY2xpZW50IHRocm93cywgd2UnbGwganVzdCBsZXQgaXQgYnViYmxlIG91dFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gd2hhdCBjYW4gd2UgZG8/ICBBbHNvLCBoZXJlIHdlJ2xsIGlnbm9yZSByZXR1cm4gdmFsdWVzXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBub3cgcmVnaXN0ZXIgb3VyIGJvdW5kIGNoYW5uZWwgZm9yIG1zZyByb3V0aW5nXG4gICAgICAgICAgICBzX2FkZEJvdW5kQ2hhbihjZmcud2luZG93LCBjZmcub3JpZ2luLCAoKHR5cGVvZiBjZmcuc2NvcGUgPT09ICdzdHJpbmcnKSA/IGNmZy5zY29wZSA6ICcnKSwgb25NZXNzYWdlKTtcblxuICAgICAgICAgICAgLy8gc2NvcGUgbWV0aG9kIG5hbWVzIGJhc2VkIG9uIGNmZy5zY29wZSBzcGVjaWZpZWQgd2hlbiB0aGUgQ2hhbm5lbCB3YXMgaW5zdGFudGlhdGVkXG4gICAgICAgICAgICB2YXIgc2NvcGVNZXRob2QgPSBmdW5jdGlvbihtKSB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjZmcuc2NvcGUgPT09ICdzdHJpbmcnICYmIGNmZy5zY29wZS5sZW5ndGgpIG0gPSBbY2ZnLnNjb3BlLCBtXS5qb2luKFwiOjpcIik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG07XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBhIHNtYWxsIHdyYXBwZXIgYXJvdW5kIHBvc3RtZXNzYWdlIHdob3NlIHByaW1hcnkgZnVuY3Rpb24gaXMgdG8gaGFuZGxlIHRoZVxuICAgICAgICAgICAgLy8gY2FzZSB0aGF0IGNsaWVudHMgc3RhcnQgc2VuZGluZyBtZXNzYWdlcyBiZWZvcmUgdGhlIG90aGVyIGVuZCBpcyBcInJlYWR5XCJcbiAgICAgICAgICAgIHZhciBwb3N0TWVzc2FnZSA9IGZ1bmN0aW9uKG1zZywgZm9yY2UpIHtcbiAgICAgICAgICAgICAgICBpZiAoIW1zZykgdGhyb3cgXCJwb3N0TWVzc2FnZSBjYWxsZWQgd2l0aCBudWxsIG1lc3NhZ2VcIjtcblxuICAgICAgICAgICAgICAgIC8vIGRlbGF5IHBvc3RpbmcgaWYgd2UncmUgbm90IHJlYWR5IHlldC5cbiAgICAgICAgICAgICAgICB2YXIgdmVyYiA9IChyZWFkeSA/IFwicG9zdCAgXCIgOiBcInF1ZXVlIFwiKTtcbiAgICAgICAgICAgICAgICBkZWJ1Zyh2ZXJiICsgXCIgbWVzc2FnZTogXCIgKyBKU09OLnN0cmluZ2lmeShtc2cpKTtcbiAgICAgICAgICAgICAgICBpZiAoIWZvcmNlICYmICFyZWFkeSkge1xuICAgICAgICAgICAgICAgICAgICBwZW5kaW5nUXVldWUucHVzaChtc2cpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY2ZnLnBvc3RNZXNzYWdlT2JzZXJ2ZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2ZnLnBvc3RNZXNzYWdlT2JzZXJ2ZXIoY2ZnLm9yaWdpbiwgbXNnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWJ1ZyhcInBvc3RNZXNzYWdlT2JzZXJ2ZXIoKSByYWlzZWQgYW4gZXhjZXB0aW9uOiBcIiArIGUudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjZmcud2luZG93LnBvc3RNZXNzYWdlKEpTT04uc3RyaW5naWZ5KG1zZyksIGNmZy5vcmlnaW4pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHZhciBvblJlYWR5ID0gZnVuY3Rpb24odHJhbnMsIHR5cGUpIHtcbiAgICAgICAgICAgICAgICBkZWJ1ZygncmVhZHkgbXNnIHJlY2VpdmVkJyk7XG4gICAgICAgICAgICAgICAgaWYgKHJlYWR5ICYmICFjZmcucmVjb25uZWN0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IFwicmVjZWl2ZWQgcmVhZHkgbWVzc2FnZSB3aGlsZSBpbiByZWFkeSBzdGF0ZS4gIGhlbHAhXCI7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVhZHkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBvbmx5IGFwcGVuZCBzdWZmaXggdG8gY2hhbklkIG9uY2U6XG4gICAgICAgICAgICAgICAgaWYgKGNoYW5JZC5sZW5ndGggPCA2KXtcbiAgICAgICAgICAgICAgICAgICAgY2hhbklkICs9ICh0eXBlID09PSAncGluZycpID8gJy1SJyA6ICctTCc7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy91bmJpbmQgcmVhZHkgaGFuZGxlciB1bmxlc3Mgd2UgYWxsb3cgcmVjb25uZWN0aW5nOlxuICAgICAgICAgICAgICAgIGlmICghY2ZnLnJlY29ubmVjdCkge1xuICAgICAgICAgICAgICAgICAgICBvYmoudW5iaW5kKCdfX3JlYWR5Jyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmVhZHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGRlYnVnKCdyZWFkeSBtc2cgYWNjZXB0ZWQuJyk7XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZSA9PT0gJ3BpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgIG9iai5ub3RpZnkoeyBtZXRob2Q6ICdfX3JlYWR5JywgcGFyYW1zOiAncG9uZycgfSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gZmx1c2ggcXVldWVcbiAgICAgICAgICAgICAgICB3aGlsZSAocGVuZGluZ1F1ZXVlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBwb3N0TWVzc2FnZShwZW5kaW5nUXVldWUucG9wKCkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGludm9rZSBvblJlYWR5IG9ic2VydmVyIGlmIHByb3ZpZGVkXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjZmcub25SZWFkeSA9PT0gJ2Z1bmN0aW9uJykgY2ZnLm9uUmVhZHkob2JqKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHZhciBvYmogPSB7XG4gICAgICAgICAgICAgICAgLy8gdHJpZXMgdG8gdW5iaW5kIGEgYm91bmQgbWVzc2FnZSBoYW5kbGVyLiAgcmV0dXJucyBmYWxzZSBpZiBub3QgcG9zc2libGVcbiAgICAgICAgICAgICAgICB1bmJpbmQ6IGZ1bmN0aW9uIChtZXRob2QpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlZ1RibFttZXRob2RdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIShkZWxldGUgcmVnVGJsW21ldGhvZF0pKSB0aHJvdyAoXCJjYW4ndCBkZWxldGUgbWV0aG9kOiBcIiArIG1ldGhvZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBiaW5kOiBmdW5jdGlvbiAobWV0aG9kLCBjYikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIW1ldGhvZCB8fCB0eXBlb2YgbWV0aG9kICE9PSAnc3RyaW5nJykgdGhyb3cgXCInbWV0aG9kJyBhcmd1bWVudCB0byBiaW5kIG11c3QgYmUgc3RyaW5nXCI7XG4gICAgICAgICAgICAgICAgICAgIGlmICghY2IgfHwgdHlwZW9mIGNiICE9PSAnZnVuY3Rpb24nKSB0aHJvdyBcImNhbGxiYWNrIG1pc3NpbmcgZnJvbSBiaW5kIHBhcmFtc1wiO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWdUYmxbbWV0aG9kXSkgdGhyb3cgXCJtZXRob2QgJ1wiK21ldGhvZCtcIicgaXMgYWxyZWFkeSBib3VuZCFcIjtcbiAgICAgICAgICAgICAgICAgICAgcmVnVGJsW21ldGhvZF0gPSBjYjtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBjYWxsOiBmdW5jdGlvbihtKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghbSkgdGhyb3cgJ21pc3NpbmcgYXJndW1lbnRzIHRvIGNhbGwgZnVuY3Rpb24nO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIW0ubWV0aG9kIHx8IHR5cGVvZiBtLm1ldGhvZCAhPT0gJ3N0cmluZycpIHRocm93IFwiJ21ldGhvZCcgYXJndW1lbnQgdG8gY2FsbCBtdXN0IGJlIHN0cmluZ1wiO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIW0uc3VjY2VzcyB8fCB0eXBlb2YgbS5zdWNjZXNzICE9PSAnZnVuY3Rpb24nKSB0aHJvdyBcIidzdWNjZXNzJyBjYWxsYmFjayBtaXNzaW5nIGZyb20gY2FsbFwiO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIG5vdyBpdCdzIHRpbWUgdG8gc3VwcG9ydCB0aGUgJ2NhbGxiYWNrJyBmZWF0dXJlIG9mIGpzY2hhbm5lbC4gIFdlJ2xsIHRyYXZlcnNlIHRoZSBhcmd1bWVudFxuICAgICAgICAgICAgICAgICAgICAvLyBvYmplY3QgYW5kIHBpY2sgb3V0IGFsbCBvZiB0aGUgZnVuY3Rpb25zIHRoYXQgd2VyZSBwYXNzZWQgYXMgYXJndW1lbnRzLlxuICAgICAgICAgICAgICAgICAgICB2YXIgY2FsbGJhY2tzID0geyB9O1xuICAgICAgICAgICAgICAgICAgICB2YXIgY2FsbGJhY2tOYW1lcyA9IFsgXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNlZW4gPSBbIF07XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIHBydW5lRnVuY3Rpb25zID0gZnVuY3Rpb24gKHBhdGgsIG9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNlZW4uaW5kZXhPZihvYmopID49IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBcInBhcmFtcyBjYW5ub3QgYmUgYSByZWN1cnNpdmUgZGF0YSBzdHJ1Y3R1cmVcIlxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgc2Vlbi5wdXNoKG9iaik7XG4gICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBvYmogPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgayBpbiBvYmopIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFvYmouaGFzT3duUHJvcGVydHkoaykpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbnAgPSBwYXRoICsgKHBhdGgubGVuZ3RoID8gJy8nIDogJycpICsgaztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBvYmpba10gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrc1tucF0gPSBvYmpba107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFja05hbWVzLnB1c2gobnApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIG9ialtrXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygb2JqW2tdID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJ1bmVGdW5jdGlvbnMobnAsIG9ialtrXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIHBydW5lRnVuY3Rpb25zKFwiXCIsIG0ucGFyYW1zKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBidWlsZCBhICdyZXF1ZXN0JyBtZXNzYWdlIGFuZCBzZW5kIGl0XG4gICAgICAgICAgICAgICAgICAgIHZhciBtc2cgPSB7IGlkOiBzX2N1clRyYW5JZCwgbWV0aG9kOiBzY29wZU1ldGhvZChtLm1ldGhvZCksIHBhcmFtczogbS5wYXJhbXMgfTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrTmFtZXMubGVuZ3RoKSBtc2cuY2FsbGJhY2tzID0gY2FsbGJhY2tOYW1lcztcblxuICAgICAgICAgICAgICAgICAgICBpZiAobS50aW1lb3V0KVxuICAgICAgICAgICAgICAgICAgICAgIC8vIFhYWDogVGhpcyBmdW5jdGlvbiByZXR1cm5zIGEgdGltZW91dCBJRCwgYnV0IHdlIGRvbid0IGRvIGFueXRoaW5nIHdpdGggaXQuXG4gICAgICAgICAgICAgICAgICAgICAgLy8gV2UgbWlnaHQgd2FudCB0byBrZWVwIHRyYWNrIG9mIGl0IHNvIHdlIGNhbiBjYW5jZWwgaXQgdXNpbmcgY2xlYXJUaW1lb3V0KClcbiAgICAgICAgICAgICAgICAgICAgICAvLyB3aGVuIHRoZSB0cmFuc2FjdGlvbiBjb21wbGV0ZXMuXG4gICAgICAgICAgICAgICAgICAgICAgc2V0VHJhbnNhY3Rpb25UaW1lb3V0KHNfY3VyVHJhbklkLCBtLnRpbWVvdXQsIHNjb3BlTWV0aG9kKG0ubWV0aG9kKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gaW5zZXJ0IGludG8gdGhlIHRyYW5zYWN0aW9uIHRhYmxlXG4gICAgICAgICAgICAgICAgICAgIG91dFRibFtzX2N1clRyYW5JZF0gPSB7IGNhbGxiYWNrczogY2FsbGJhY2tzLCBlcnJvcjogbS5lcnJvciwgc3VjY2VzczogbS5zdWNjZXNzIH07XG4gICAgICAgICAgICAgICAgICAgIHNfdHJhbnNJZHNbc19jdXJUcmFuSWRdID0gb25NZXNzYWdlO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGluY3JlbWVudCBjdXJyZW50IGlkXG4gICAgICAgICAgICAgICAgICAgIHNfY3VyVHJhbklkKys7XG5cbiAgICAgICAgICAgICAgICAgICAgcG9zdE1lc3NhZ2UobXNnKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIG5vdGlmeTogZnVuY3Rpb24obSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIW0pIHRocm93ICdtaXNzaW5nIGFyZ3VtZW50cyB0byBub3RpZnkgZnVuY3Rpb24nO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIW0ubWV0aG9kIHx8IHR5cGVvZiBtLm1ldGhvZCAhPT0gJ3N0cmluZycpIHRocm93IFwiJ21ldGhvZCcgYXJndW1lbnQgdG8gbm90aWZ5IG11c3QgYmUgc3RyaW5nXCI7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gbm8gbmVlZCB0byBnbyBpbnRvIGFueSB0cmFuc2FjdGlvbiB0YWJsZVxuICAgICAgICAgICAgICAgICAgICBwb3N0TWVzc2FnZSh7IG1ldGhvZDogc2NvcGVNZXRob2QobS5tZXRob2QpLCBwYXJhbXM6IG0ucGFyYW1zIH0pO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZGVzdHJveTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBzX3JlbW92ZUJvdW5kQ2hhbihjZmcud2luZG93LCBjZmcub3JpZ2luLCAoKHR5cGVvZiBjZmcuc2NvcGUgPT09ICdzdHJpbmcnKSA/IGNmZy5zY29wZSA6ICcnKSk7XG4gICAgICAgICAgICAgICAgICAgIGlmICh3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcikgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBvbk1lc3NhZ2UsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZih3aW5kb3cuZGV0YWNoRXZlbnQpIHdpbmRvdy5kZXRhY2hFdmVudCgnb25tZXNzYWdlJywgb25NZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgcmVhZHkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgcmVnVGJsID0geyB9O1xuICAgICAgICAgICAgICAgICAgICBpblRibCA9IHsgfTtcbiAgICAgICAgICAgICAgICAgICAgb3V0VGJsID0geyB9O1xuICAgICAgICAgICAgICAgICAgICBjZmcub3JpZ2luID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgcGVuZGluZ1F1ZXVlID0gWyBdO1xuICAgICAgICAgICAgICAgICAgICBkZWJ1ZyhcImNoYW5uZWwgZGVzdHJveWVkXCIpO1xuICAgICAgICAgICAgICAgICAgICBjaGFuSWQgPSBcIlwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIG9iai5iaW5kKCdfX3JlYWR5Jywgb25SZWFkeSk7XG4gICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHBvc3RNZXNzYWdlKHsgbWV0aG9kOiBzY29wZU1ldGhvZCgnX19yZWFkeScpLCBwYXJhbXM6IFwicGluZ1wiIH0sIHRydWUpO1xuICAgICAgICAgICAgfSwgMCk7XG5cbiAgICAgICAgICAgIHJldHVybiBvYmo7XG4gICAgICAgIH1cbiAgICB9O1xufSkoKTtcblxuLy9lbmFibGUgbG9hZGluZyB2aWEgQU1EXG5pZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgZGVmaW5lKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gQ2hhbm5lbDtcbiAgICB9KTtcbn1cblxuLy8gZW5hYmxlIE5vZGUuSlMgcmVxdWlyaW5nXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMgIT09IHVuZGVmaW5lZCkge1xuICAgIG1vZHVsZS5leHBvcnRzID0gQ2hhbm5lbDtcbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9+L2pzY2hhbm5lbC9zcmMvanNjaGFubmVsLmpzXG4gKiogbW9kdWxlIGlkID0gM1xuICoqIG1vZHVsZSBjaHVua3MgPSAwIDFcbiAqKi8iLCIvKiFcbiAqIEphdmFTY3JpcHQgQ29va2llIHYyLjEuMlxuICogaHR0cHM6Ly9naXRodWIuY29tL2pzLWNvb2tpZS9qcy1jb29raWVcbiAqXG4gKiBDb3B5cmlnaHQgMjAwNiwgMjAxNSBLbGF1cyBIYXJ0bCAmIEZhZ25lciBCcmFja1xuICogUmVsZWFzZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlXG4gKi9cbjsoZnVuY3Rpb24gKGZhY3RvcnkpIHtcblx0aWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuXHRcdGRlZmluZShmYWN0b3J5KTtcblx0fSBlbHNlIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcblx0XHRtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKTtcblx0fSBlbHNlIHtcblx0XHR2YXIgT2xkQ29va2llcyA9IHdpbmRvdy5Db29raWVzO1xuXHRcdHZhciBhcGkgPSB3aW5kb3cuQ29va2llcyA9IGZhY3RvcnkoKTtcblx0XHRhcGkubm9Db25mbGljdCA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdHdpbmRvdy5Db29raWVzID0gT2xkQ29va2llcztcblx0XHRcdHJldHVybiBhcGk7XG5cdFx0fTtcblx0fVxufShmdW5jdGlvbiAoKSB7XG5cdGZ1bmN0aW9uIGV4dGVuZCAoKSB7XG5cdFx0dmFyIGkgPSAwO1xuXHRcdHZhciByZXN1bHQgPSB7fTtcblx0XHRmb3IgKDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0dmFyIGF0dHJpYnV0ZXMgPSBhcmd1bWVudHNbIGkgXTtcblx0XHRcdGZvciAodmFyIGtleSBpbiBhdHRyaWJ1dGVzKSB7XG5cdFx0XHRcdHJlc3VsdFtrZXldID0gYXR0cmlidXRlc1trZXldO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0ZnVuY3Rpb24gaW5pdCAoY29udmVydGVyKSB7XG5cdFx0ZnVuY3Rpb24gYXBpIChrZXksIHZhbHVlLCBhdHRyaWJ1dGVzKSB7XG5cdFx0XHR2YXIgcmVzdWx0O1xuXHRcdFx0aWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBXcml0ZVxuXG5cdFx0XHRpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcblx0XHRcdFx0YXR0cmlidXRlcyA9IGV4dGVuZCh7XG5cdFx0XHRcdFx0cGF0aDogJy8nXG5cdFx0XHRcdH0sIGFwaS5kZWZhdWx0cywgYXR0cmlidXRlcyk7XG5cblx0XHRcdFx0aWYgKHR5cGVvZiBhdHRyaWJ1dGVzLmV4cGlyZXMgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0dmFyIGV4cGlyZXMgPSBuZXcgRGF0ZSgpO1xuXHRcdFx0XHRcdGV4cGlyZXMuc2V0TWlsbGlzZWNvbmRzKGV4cGlyZXMuZ2V0TWlsbGlzZWNvbmRzKCkgKyBhdHRyaWJ1dGVzLmV4cGlyZXMgKiA4NjRlKzUpO1xuXHRcdFx0XHRcdGF0dHJpYnV0ZXMuZXhwaXJlcyA9IGV4cGlyZXM7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdHJlc3VsdCA9IEpTT04uc3RyaW5naWZ5KHZhbHVlKTtcblx0XHRcdFx0XHRpZiAoL15bXFx7XFxbXS8udGVzdChyZXN1bHQpKSB7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IHJlc3VsdDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gY2F0Y2ggKGUpIHt9XG5cblx0XHRcdFx0aWYgKCFjb252ZXJ0ZXIud3JpdGUpIHtcblx0XHRcdFx0XHR2YWx1ZSA9IGVuY29kZVVSSUNvbXBvbmVudChTdHJpbmcodmFsdWUpKVxuXHRcdFx0XHRcdFx0LnJlcGxhY2UoLyUoMjN8MjR8MjZ8MkJ8M0F8M0N8M0V8M0R8MkZ8M0Z8NDB8NUJ8NUR8NUV8NjB8N0J8N0R8N0MpL2csIGRlY29kZVVSSUNvbXBvbmVudCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dmFsdWUgPSBjb252ZXJ0ZXIud3JpdGUodmFsdWUsIGtleSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRrZXkgPSBlbmNvZGVVUklDb21wb25lbnQoU3RyaW5nKGtleSkpO1xuXHRcdFx0XHRrZXkgPSBrZXkucmVwbGFjZSgvJSgyM3wyNHwyNnwyQnw1RXw2MHw3QykvZywgZGVjb2RlVVJJQ29tcG9uZW50KTtcblx0XHRcdFx0a2V5ID0ga2V5LnJlcGxhY2UoL1tcXChcXCldL2csIGVzY2FwZSk7XG5cblx0XHRcdFx0cmV0dXJuIChkb2N1bWVudC5jb29raWUgPSBbXG5cdFx0XHRcdFx0a2V5LCAnPScsIHZhbHVlLFxuXHRcdFx0XHRcdGF0dHJpYnV0ZXMuZXhwaXJlcyAmJiAnOyBleHBpcmVzPScgKyBhdHRyaWJ1dGVzLmV4cGlyZXMudG9VVENTdHJpbmcoKSwgLy8gdXNlIGV4cGlyZXMgYXR0cmlidXRlLCBtYXgtYWdlIGlzIG5vdCBzdXBwb3J0ZWQgYnkgSUVcblx0XHRcdFx0XHRhdHRyaWJ1dGVzLnBhdGggICAgJiYgJzsgcGF0aD0nICsgYXR0cmlidXRlcy5wYXRoLFxuXHRcdFx0XHRcdGF0dHJpYnV0ZXMuZG9tYWluICAmJiAnOyBkb21haW49JyArIGF0dHJpYnV0ZXMuZG9tYWluLFxuXHRcdFx0XHRcdGF0dHJpYnV0ZXMuc2VjdXJlID8gJzsgc2VjdXJlJyA6ICcnXG5cdFx0XHRcdF0uam9pbignJykpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBSZWFkXG5cblx0XHRcdGlmICgha2V5KSB7XG5cdFx0XHRcdHJlc3VsdCA9IHt9O1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBUbyBwcmV2ZW50IHRoZSBmb3IgbG9vcCBpbiB0aGUgZmlyc3QgcGxhY2UgYXNzaWduIGFuIGVtcHR5IGFycmF5XG5cdFx0XHQvLyBpbiBjYXNlIHRoZXJlIGFyZSBubyBjb29raWVzIGF0IGFsbC4gQWxzbyBwcmV2ZW50cyBvZGQgcmVzdWx0IHdoZW5cblx0XHRcdC8vIGNhbGxpbmcgXCJnZXQoKVwiXG5cdFx0XHR2YXIgY29va2llcyA9IGRvY3VtZW50LmNvb2tpZSA/IGRvY3VtZW50LmNvb2tpZS5zcGxpdCgnOyAnKSA6IFtdO1xuXHRcdFx0dmFyIHJkZWNvZGUgPSAvKCVbMC05QS1aXXsyfSkrL2c7XG5cdFx0XHR2YXIgaSA9IDA7XG5cblx0XHRcdGZvciAoOyBpIDwgY29va2llcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHR2YXIgcGFydHMgPSBjb29raWVzW2ldLnNwbGl0KCc9Jyk7XG5cdFx0XHRcdHZhciBjb29raWUgPSBwYXJ0cy5zbGljZSgxKS5qb2luKCc9Jyk7XG5cblx0XHRcdFx0aWYgKGNvb2tpZS5jaGFyQXQoMCkgPT09ICdcIicpIHtcblx0XHRcdFx0XHRjb29raWUgPSBjb29raWUuc2xpY2UoMSwgLTEpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHR2YXIgbmFtZSA9IHBhcnRzWzBdLnJlcGxhY2UocmRlY29kZSwgZGVjb2RlVVJJQ29tcG9uZW50KTtcblx0XHRcdFx0XHRjb29raWUgPSBjb252ZXJ0ZXIucmVhZCA/XG5cdFx0XHRcdFx0XHRjb252ZXJ0ZXIucmVhZChjb29raWUsIG5hbWUpIDogY29udmVydGVyKGNvb2tpZSwgbmFtZSkgfHxcblx0XHRcdFx0XHRcdGNvb2tpZS5yZXBsYWNlKHJkZWNvZGUsIGRlY29kZVVSSUNvbXBvbmVudCk7XG5cblx0XHRcdFx0XHRpZiAodGhpcy5qc29uKSB7XG5cdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRjb29raWUgPSBKU09OLnBhcnNlKGNvb2tpZSk7XG5cdFx0XHRcdFx0XHR9IGNhdGNoIChlKSB7fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChrZXkgPT09IG5hbWUpIHtcblx0XHRcdFx0XHRcdHJlc3VsdCA9IGNvb2tpZTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICgha2V5KSB7XG5cdFx0XHRcdFx0XHRyZXN1bHRbbmFtZV0gPSBjb29raWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGNhdGNoIChlKSB7fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblxuXHRcdGFwaS5zZXQgPSBhcGk7XG5cdFx0YXBpLmdldCA9IGZ1bmN0aW9uIChrZXkpIHtcblx0XHRcdHJldHVybiBhcGkoa2V5KTtcblx0XHR9O1xuXHRcdGFwaS5nZXRKU09OID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0cmV0dXJuIGFwaS5hcHBseSh7XG5cdFx0XHRcdGpzb246IHRydWVcblx0XHRcdH0sIFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKSk7XG5cdFx0fTtcblx0XHRhcGkuZGVmYXVsdHMgPSB7fTtcblxuXHRcdGFwaS5yZW1vdmUgPSBmdW5jdGlvbiAoa2V5LCBhdHRyaWJ1dGVzKSB7XG5cdFx0XHRhcGkoa2V5LCAnJywgZXh0ZW5kKGF0dHJpYnV0ZXMsIHtcblx0XHRcdFx0ZXhwaXJlczogLTFcblx0XHRcdH0pKTtcblx0XHR9O1xuXG5cdFx0YXBpLndpdGhDb252ZXJ0ZXIgPSBpbml0O1xuXG5cdFx0cmV0dXJuIGFwaTtcblx0fVxuXG5cdHJldHVybiBpbml0KGZ1bmN0aW9uICgpIHt9KTtcbn0pKTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi9+L2pzLWNvb2tpZS9zcmMvanMuY29va2llLmpzXG4gKiogbW9kdWxlIGlkID0gMTdcbiAqKiBtb2R1bGUgY2h1bmtzID0gMVxuICoqLyIsIid1c2Ugc3RyaWN0JztcblxuKGZ1bmN0aW9uIHN0ZW5jaWxFZGl0b3JTREsod2luZG93LCBDaGFubmVsLCBDb29raWVzKSB7XG4gICAgdmFyIF9jb25maWd1cmF0aW9uSWQgPSAnJyxcbiAgICAgICAgLy8gQWRkaW5nIGEgZG90IGJlY2F1c2UgY29va2llIHNldCBieSBiY2FwcCBhbHNvIGFkZHMgYSBkb3RcbiAgICAgICAgX2Nvb2tpZURvbWFpbiA9ICh3aW5kb3cubG9jYXRpb24uaG9zdG5hbWUgPT09ICdsb2NhbGhvc3QnID8gJycgOiAnLicpICsgd2luZG93LmxvY2F0aW9uLmhvc3RuYW1lLFxuICAgICAgICBfY29va2llTmFtZSA9ICdzdGVuY2lsX3ByZXZpZXcnLFxuICAgICAgICBfbm9vcCA9IGZ1bmN0aW9uKCkge30sXG4gICAgICAgIF92ZXJzaW9uSWQgPSAnJztcblxuICAgIGluaXQoKTtcblxuICAgIGZ1bmN0aW9uIGluaXQoKSB7XG4gICAgICAgIGlmIChydW5uaW5nSW5JZnJhbWUoKSkge1xuICAgICAgICAgICAgcmVnaXN0ZXJFdmVudHMoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNsb3NlUHJldmlldygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIGxpbmsgZWxlbWVudCB3aXRoIHRoZSBwYXNzZWQgZm9udCB1cmxcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZm9udFVybFxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zXG4gICAgICovXG4gICAgZnVuY3Rpb24gYWRkRm9udChmb250VXJsLCBvcHRpb25zKSB7XG4gICAgICAgIHZhciBsaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGluaycpLFxuICAgICAgICAgICAgbGlua0xvYWRIYW5kbGVyO1xuXG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgICAgICBvcHRpb25zLmVycm9yID0gb3B0aW9ucy5lcnJvciB8fCBfbm9vcDtcbiAgICAgICAgb3B0aW9ucy5zdWNjZXNzID0gb3B0aW9ucy5zdWNjZXNzIHx8IF9ub29wO1xuXG4gICAgICAgIGxpbmsuc2V0QXR0cmlidXRlKCdyZWwnLCAnc3R5bGVzaGVldCcpO1xuICAgICAgICBsaW5rLnNldEF0dHJpYnV0ZSgnaHJlZicsIGZvbnRVcmwpO1xuXG4gICAgICAgIGxpbmtMb2FkSGFuZGxlciA9IGxpbmsuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIGZ1bmN0aW9uIG5ld0ZvbnRMb2FkZWQoKSB7XG4gICAgICAgICAgICBvcHRpb25zLnN1Y2Nlc3MoZm9udFVybCk7XG5cbiAgICAgICAgICAgIGxpbmsucmVtb3ZlRXZlbnRMaXN0ZW5lcignbG9hZCcsIGxpbmtMb2FkSGFuZGxlcik7XG5cbiAgICAgICAgICAgIGZvY3VzQm9keSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKGxpbmspO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgdGhlIGNvb2tpZSBhbmQgcmVsb2FkcyB0aGUgcGFnZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGNsb3NlUHJldmlldygpIHtcbiAgICAgICAgQ29va2llcy5yZW1vdmUoX2Nvb2tpZU5hbWUsIHtcbiAgICAgICAgICAgIGRvbWFpbjogX2Nvb2tpZURvbWFpblxuICAgICAgICB9KTtcblxuICAgICAgICByZWxvYWRQYWdlKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRm9yY2UgdGhlIGJyb3dzZXIgdG8gcmVwYWludCB0aGUgcGFnZSBhZnRlciBhIHN0eWxlc2hlZXQgdXBkYXRlXG4gICAgICovXG4gICAgZnVuY3Rpb24gZm9jdXNCb2R5KCkge1xuICAgICAgICBkb2N1bWVudC5ib2R5LmZvY3VzKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV3cml0ZSB0aGUgY2RuIHVybCB0byBhIHJlbGF0aXZlIHBhdGggdGhhdCBpbmNsdWRlcyB0aGUgc3RvcmVIYXNoXG4gICAgICogQHBhcmFtICB7c3RyaW5nfSB1cmxcbiAgICAgKiBAcmV0dXJuIHtzdHJpbmd9XG4gICAgICovXG4gICAgZnVuY3Rpb24gcmV3cml0ZVN0eWxlc2hlZXRVcmwodXJsKSB7XG4gICAgICAgIHZhciBjZG5VcmxSZWdleCA9IC9bLXxcXC9dKFxcdyspXFwvc3RlbmNpbFxcLyguKikvaSxcbiAgICAgICAgICAgIG1hdGNoID0gdXJsLm1hdGNoKGNkblVybFJlZ2V4KSxcbiAgICAgICAgICAgIHN0b3JlSGFzaCxcbiAgICAgICAgICAgIGNzc1BhdGg7XG5cbiAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICBzdG9yZUhhc2ggPSBtYXRjaFsxXTtcbiAgICAgICAgICAgIGNzc1BhdGggPSBtYXRjaFsyXTtcblxuICAgICAgICAgICAgcmV0dXJuICcvc3RlbmNpbC9zLScgKyBzdG9yZUhhc2ggKyAnLycgKyBjc3NQYXRoO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHVybDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZW5lcmF0ZSBhIHN0eWxlc2hlZXQgdXJsIHJlcGxhY2luZyB0aGUgY29uZmlnSWRcbiAgICAgKiBhbmQgYWRkaW5nIGEgcXVlcnkgcGFyYW1ldGVyIHdpdGggYSB0aW1lc3RhbXBcbiAgICAgKiBAcGFyYW0gIHtzdHJpbmd9IHVybFxuICAgICAqIEBwYXJhbSAge3N0cmluZ30gY29uZmlndXJhdGlvbklkXG4gICAgICogQHJldHVybiB7c3RyaW5nfVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGdlbmVyYXRlU3R5bGVzaGVldFVybCh1cmwsIGNvbmZpZ3VyYXRpb25JZCkge1xuICAgICAgICB2YXIgcXVlcnlJbmRleCA9IHVybC5pbmRleE9mKCc/JyksXG4gICAgICAgICAgICBzdHlsZXNoZWV0VXJsUmVnZXggPSAvXihcXC9zdGVuY2lsXFwvLipcXC8pLis/KFxcL2Nzc1xcLy4qKS9pLFxuICAgICAgICAgICAgbWF0Y2gsXG4gICAgICAgICAgICBiYXNlVXJsLFxuICAgICAgICAgICAgY3NzUGF0aDtcblxuICAgICAgICBpZiAocXVlcnlJbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgIHVybCA9IHVybC5zdWJzdHJpbmcoMCwgcXVlcnlJbmRleCk7XG4gICAgICAgIH1cblxuICAgICAgICB1cmwgPSByZXdyaXRlU3R5bGVzaGVldFVybCh1cmwpO1xuXG4gICAgICAgIG1hdGNoID0gdXJsLm1hdGNoKHN0eWxlc2hlZXRVcmxSZWdleCk7XG5cbiAgICAgICAgaWYgKCFtYXRjaCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTdXBwbGllZCB1cmwgaXMgbm90IGEgdmFsaWQgc3R5bGVzaGVldCB1cmwnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGJhc2VVcmwgPSBtYXRjaFsxXTtcbiAgICAgICAgY3NzUGF0aCA9IG1hdGNoWzJdO1xuXG4gICAgICAgIHJldHVybiBiYXNlVXJsICsgY29uZmlndXJhdGlvbklkICsgY3NzUGF0aCArICc/cHJldmlldz0nICsgRGF0ZS5ub3coKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gYW4gYXJyYXkgb2Ygc3R5bGVzaGVldCBsaW5rIGVsZW1lbnRzXG4gICAgICogQHJldHVybiB7YXJyYXl9XG4gICAgICovXG4gICAgZnVuY3Rpb24gZ2V0U3R5bGVzaGVldHMoKSB7XG4gICAgICAgIHZhciBzdHlsZXNoZWV0cyA9IGRvY3VtZW50LmhlYWQucXVlcnlTZWxlY3RvckFsbCgnbGlua1tkYXRhLXN0ZW5jaWwtc3R5bGVzaGVldF0nKTtcblxuICAgICAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoc3R5bGVzaGVldHMpO1xuICAgIH1cblxuICAgIC8qXG4gICAgICogUmVnaXN0ZXJzIEpzQ2hhbm5lbCBzdWJzY3JpcHRpb25zXG4gICAgICovXG4gICAgZnVuY3Rpb24gcmVnaXN0ZXJFdmVudHMoKSB7XG4gICAgICAgIHZhciBjb29raWUgPSBDb29raWVzLmdldChfY29va2llTmFtZSkuc3BsaXQoJ0AnKSxcbiAgICAgICAgICAgIGNoYW4gPSBDaGFubmVsLmJ1aWxkKHtcbiAgICAgICAgICAgICAgICB3aW5kb3c6IHdpbmRvdy5wYXJlbnQsXG4gICAgICAgICAgICAgICAgb3JpZ2luOiAnKicsXG4gICAgICAgICAgICAgICAgb25SZWFkeTogZW1pdFJlYWR5LFxuICAgICAgICAgICAgICAgIHNjb3BlOiAnc3RlbmNpbEVkaXRvcidcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIC8vIHRoZSB2ZXJzaW9uIGlkICYgY29uZmlnIGlkIHdpbGwgYWxyZWFkeSBiZSBzZXQgYnkgdGhlIHNlcnZlclxuICAgICAgICAvLyB3aGVuIHRoZSBpZnJhbWUgaXMgbG9hZGVkIGZvciB0aGUgZmlyc3QgdGltZVxuICAgICAgICBfdmVyc2lvbklkID0gY29va2llWzBdO1xuICAgICAgICBfY29uZmlndXJhdGlvbklkID0gY29va2llWzFdO1xuXG4gICAgICAgIC8vIFJlZ2lzdGVyIGpzQ2hhbm5lbCBldmVudHNcbiAgICAgICAgY2hhbi5iaW5kKCdhZGQtZm9udCcsIGFkZEZvbnRIYW5kbGVyKTtcbiAgICAgICAgY2hhbi5iaW5kKCdyZWxvYWQtc3R5bGVzaGVldHMnLCByZWxvYWRTdHlsZXNoZWV0c0hhbmRsZXIpO1xuICAgICAgICBjaGFuLmJpbmQoJ3JlbG9hZC1wYWdlJywgcmVsb2FkUGFnZUhhbmRsZXIpO1xuICAgICAgICBjaGFuLmJpbmQoJ3NldC1jb29raWUnLCBzZXRDb29raWVIYW5kbGVyKTtcblxuICAgICAgICAvLyBMaXN0ZW4gb24gZnVjdXMgZXZlbnQgYW5kIHJlc2V0IHRoZSBwcmV2aWV3IGNvb2tpZVxuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignZm9jdXMnLCBvbkZvY3VzSGFuZGxlcik7XG5cbiAgICAgICAgd2luZG93Lm9uYmVmb3JldW5sb2FkID0gZnVuY3Rpb24gZW1pdE9uVW5sb2FkKCkge1xuICAgICAgICAgICAgZW1pdE5vdFJlYWR5KCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEVtaXQgdGhlICdzZGstcmVhZHknIGV2ZW50LlxuICAgICAgICAgKiBAcmV0dXJuIGNoYW5uZWxcbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIGVtaXRSZWFkeSgpIHtcbiAgICAgICAgICAgIGNoYW4uY2FsbCh7XG4gICAgICAgICAgICAgICAgbWV0aG9kOiAnc2RrLXJlYWR5JyxcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBfbm9vcCxcbiAgICAgICAgICAgICAgICBlcnJvcjogX25vb3BcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gY2hhbjtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGVtaXROb3RSZWFkeSgpIHtcbiAgICAgICAgICAgIGNoYW4uY2FsbCh7XG4gICAgICAgICAgICAgICAgbWV0aG9kOiAnc2RrLW5vdC1yZWFkeScsXG4gICAgICAgICAgICAgICAgc3VjY2VzczogX25vb3AsXG4gICAgICAgICAgICAgICAgZXJyb3I6IF9ub29wXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIGNoYW47XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBhZGRGb250SGFuZGxlcih0cmFucywgZGF0YSkge1xuICAgICAgICAgICAgdmFyIGZvbnRVcmwgPSBKU09OLnBhcnNlKGRhdGEpLmZvbnRVcmwsXG4gICAgICAgICAgICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zLmVycm9yKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmdW5jdGlvbihtZXNzYWdlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmFucy5jb21wbGV0ZShtZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHRyYW5zLmRlbGF5UmV0dXJuKHRydWUpO1xuXG4gICAgICAgICAgICByZXR1cm4gYWRkRm9udChmb250VXJsLCBvcHRpb25zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHJlbG9hZFN0eWxlc2hlZXRzSGFuZGxlcih0cmFucywgZGF0YSkge1xuICAgICAgICAgICAgdmFyIGNvbmZpZ3VyYXRpb25JZCA9IEpTT04ucGFyc2UoZGF0YSkuY29uZmlndXJhdGlvbklkLFxuICAgICAgICAgICAgICAgIGxvYWRlZFN0eWxlc2hlZXRzQ291bnQgPSBnZXRMb2FkZWRTdHlsZXNoZWV0cygpLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBvcHRpb25zID0ge1xuICAgICAgICAgICAgICAgICAgICBlcnJvcjogY2FsbE9uY2Uob25FcnJvciksXG4gICAgICAgICAgICAgICAgICAgIC8vIGNhbGwgdHJhbnMuY29tcGxldGUgb25jZSBhZnRlciBhbGwgc3R5bGVzaGVldHMgaGF2ZSBiZWVuIHJlbG9hZGVkXG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGNhbGxBZnRlck5UaW1lcyhsb2FkZWRTdHlsZXNoZWV0c0NvdW50LCBvblN1Y2Nlc3MpXG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgZnVuY3Rpb24gb25FcnJvcihtZXNzYWdlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRyYW5zLmVycm9yKG1lc3NhZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZnVuY3Rpb24gb25TdWNjZXNzKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJhbnMuY29tcGxldGUobWVzc2FnZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRyYW5zLmRlbGF5UmV0dXJuKHRydWUpO1xuXG4gICAgICAgICAgICBzZXRDb29raWUoY29uZmlndXJhdGlvbklkKTtcblxuICAgICAgICAgICAgcmV0dXJuIHJlbG9hZFN0eWxlc2hlZXRzKGNvbmZpZ3VyYXRpb25JZCwgb3B0aW9ucyk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBHZXQgdGhlIHN0eWxlc2hlZXRzIG9uIHRoZSBwYWdlIGFuZCBmaWx0ZXIgZm9yIG9uZXMgdGhhdCBhcmUgbG9hZGVkLlxuICAgICAgICAgKiBAcmV0dXJuIHtBcnJheX0gQXJyYXkgb2Ygc3R5bGVzaGVldCBub2Rlc1xuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gZ2V0TG9hZGVkU3R5bGVzaGVldHMoKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0U3R5bGVzaGVldHMoKS5maWx0ZXIoZnVuY3Rpb24obGluaykge1xuICAgICAgICAgICAgICAgIHJldHVybiAhbGluay5oYXNBdHRyaWJ1dGUoJ2RhdGEtaXMtbG9hZGluZycpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogSW52b2tlIHRoZSBjYWxsYmFjayBhZnRlciB0aGUgbnRoIHRpbWUgdGhpcyBmdW5jdGlvbiBoYXMgYmVlbiBjYWxsZWQuIFNlZSBfLmFmdGVyIGluIHVuZGVyc2NvcmUgb3IgbG9kYXNoLlxuICAgICAgICAgKiBAcGFyYW0gIHtOdW1iZXJ9IG4gVGhlIG51bWJlciBvZiBjYWxscyBiZWZvcmUgZnVuYyBpcyBpbnZva2VkLlxuICAgICAgICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gZnVuYyBUaGUgY2FsbGJhY2sgZnVuY3Rpb24gdG8gaW52b2tlLlxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn0gVGhlIG5ldyByZXN0cmljdGVkIGZ1bmN0aW9uLlxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gY2FsbEFmdGVyTlRpbWVzKG4sIGZ1bmMpIHtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiBjYWxsQWZ0ZXJGdW5jKCkge1xuICAgICAgICAgICAgICAgIGlmICgtLW4gPCAxKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgaXMgcmVzdHJpY3RlZCB0byBpbnZva2luZyBmdW5jIG9uY2UuIFJlcGVhdCBjYWxscyB0byB0aGUgZnVuY3Rpb24gcmV0dXJucyB0aGUgdmFsdWUgb2YgdGhlIGZpcnN0IGludm9jYXRpb24uXG4gICAgICAgICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBmdW5jIFRoZSBjYWxsYmFjayBmdW5jdGlvbiB0byBpbnZva2UuXG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufSBUaGUgbmV3IHJlc3RyaWN0ZWQgZnVuY3Rpb24uXG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBjYWxsT25jZShmdW5jKSB7XG4gICAgICAgICAgICB2YXIgY2FsbGVkID0gZmFsc2UsXG4gICAgICAgICAgICAgICAgcmVzdWx0O1xuXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gb25jZUZ1bmMoKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjYWxsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiByZWxvYWRQYWdlSGFuZGxlcigpIHtcbiAgICAgICAgICAgIHJldHVybiByZWxvYWRQYWdlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBzZXRDb29raWVIYW5kbGVyKHRyYW5zLCBqc29uRGF0YSkge1xuICAgICAgICAgICAgdmFyIGRhdGEgPSBKU09OLnBhcnNlKGpzb25EYXRhKTtcbiAgICAgICAgICAgIHZhciBjb25maWd1cmF0aW9uSWQgPSBkYXRhLmNvbmZpZ3VyYXRpb25JZDtcbiAgICAgICAgICAgIHZhciB2ZXJzaW9uSWQgPSBkYXRhLnZlcnNpb25JZDtcblxuICAgICAgICAgICAgcmV0dXJuIHNldENvb2tpZShjb25maWd1cmF0aW9uSWQsIHZlcnNpb25JZCk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBvbkZvY3VzSGFuZGxlcigpIHtcbiAgICAgICAgICAgIHNldENvb2tpZShfY29uZmlndXJhdGlvbklkLCBfdmVyc2lvbklkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbG9hZHMgdGhlIGN1cnJlbnQgcGFnZVxuICAgICAqIEByZXR1cm5zIHtib29sZWFufVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHJlbG9hZFBhZ2UoKSB7XG4gICAgICAgIGRvY3VtZW50LmxvY2F0aW9uLnJlbG9hZCh0cnVlKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWxvYWRzIHN0eWxlc2hlZXRzIGJ5IGFwcGVuZGluZyBEYXRlLm5vdygpIHRvIHRoZWlyIGhyZWZcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiByZWxvYWRTdHlsZXNoZWV0cyhjb25maWd1cmF0aW9uSWQsIG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgICAgIG9wdGlvbnMuZXJyb3IgPSBvcHRpb25zLmVycm9yIHx8IF9ub29wO1xuICAgICAgICBvcHRpb25zLnN1Y2Nlc3MgPSBvcHRpb25zLnN1Y2Nlc3MgfHwgX25vb3A7XG5cbiAgICAgICAgZ2V0U3R5bGVzaGVldHMoKS5mb3JFYWNoKHVwZGF0ZVN0eWxlc2hlZXQuYmluZChudWxsLCBjb25maWd1cmF0aW9uSWQsIG9wdGlvbnMpKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB1cGRhdGVTdHlsZXNoZWV0KGNvbmZpZ3VyYXRpb25JZCwgb3B0aW9ucywgY3VycmVudExpbmspIHtcbiAgICAgICAgdmFyIHVybCA9IGN1cnJlbnRMaW5rLmdldEF0dHJpYnV0ZSgnaHJlZicpLFxuICAgICAgICAgICAgbmV3TGluaztcblxuICAgICAgICBpZiAoIXVybCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGN1cnJlbnRMaW5rLmhhc0F0dHJpYnV0ZSgnZGF0YS1pcy1sb2FkaW5nJykpIHtcbiAgICAgICAgICAgIGRvY3VtZW50LmhlYWQucmVtb3ZlQ2hpbGQoY3VycmVudExpbmspO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbmV3TGluayA9IGN1cnJlbnRMaW5rLmNsb25lTm9kZShmYWxzZSk7XG5cbiAgICAgICAgICAgIG5ld0xpbmsuc2V0QXR0cmlidXRlKCdocmVmJywgZ2VuZXJhdGVTdHlsZXNoZWV0VXJsKHVybCwgY29uZmlndXJhdGlvbklkKSk7XG4gICAgICAgICAgICBuZXdMaW5rLnNldEF0dHJpYnV0ZSgnZGF0YS1pcy1sb2FkaW5nJywgdHJ1ZSk7XG5cbiAgICAgICAgICAgIG5ld0xpbmsuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIHN0eWxlc2hlZXRMb2FkKTtcbiAgICAgICAgICAgIG5ld0xpbmsuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCBzdHlsZXNoZWV0RXJyb3IpO1xuXG4gICAgICAgICAgICAvLyBJbnNlcnQgdGhlIG5ldyBzdHlsZXNoZWV0IGJlZm9yZSB0aGUgb2xkIG9uZSB0byBhdm9pZCBhbnkgZmxhc2ggb2YgdW4tc3R5bGVkIGNvbnRlbnQuIFRoZSBsb2FkXG4gICAgICAgICAgICAvLyBhbmQgZXJyb3IgZXZlbnRzIG9ubHkgd29yayBmb3IgdGhlIGluaXRpYWwgbG9hZCwgd2hpY2ggaXMgd2h5IHdlIHJlcGxhY2UgdGhlIGxpbmsgb24gZWFjaCB1cGRhdGUuXG4gICAgICAgICAgICBkb2N1bWVudC5oZWFkLmluc2VydEJlZm9yZShuZXdMaW5rLCBjdXJyZW50TGluayk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBzdHlsZXNoZWV0TG9hZCgpIHtcbiAgICAgICAgICAgIG5ld0xpbmsucmVtb3ZlQXR0cmlidXRlKCdkYXRhLWlzLWxvYWRpbmcnKTtcblxuICAgICAgICAgICAgLy8gRGVzdHJveSBhbnkgZXhpc3RpbmcgaGFuZGxlcnMgdG8gc2F2ZSBtZW1vcnkgb24gc3Vic2VxdWVudCBzdHlsZXNoZWV0IGNoYW5nZXNcbiAgICAgICAgICAgIG5ld0xpbmsucmVtb3ZlRXZlbnRMaXN0ZW5lcignZXJyb3InLCBzdHlsZXNoZWV0RXJyb3IpO1xuICAgICAgICAgICAgbmV3TGluay5yZW1vdmVFdmVudExpc3RlbmVyKCdsb2FkJywgc3R5bGVzaGVldExvYWQpO1xuXG5cbiAgICAgICAgICAgIC8vIFJlbW92ZSB0aGUgb2xkIHN0eWxlc2hlZXQgdG8gYWxsb3cgdGhlIG5ldyBvbmUgdG8gdGFrZSBvdmVyXG4gICAgICAgICAgICBkb2N1bWVudC5oZWFkLnJlbW92ZUNoaWxkKGN1cnJlbnRMaW5rKTtcblxuICAgICAgICAgICAgb3B0aW9ucy5zdWNjZXNzKHVybCk7XG5cbiAgICAgICAgICAgIGZvY3VzQm9keSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gc3R5bGVzaGVldEVycm9yKCkge1xuICAgICAgICAgICAgb3B0aW9ucy5lcnJvcih1cmwpO1xuXG4gICAgICAgICAgICAvLyBTb21ldGhpbmcgd2VudCB3cm9uZyB3aXRoIG91ciBuZXcgc3R5bGVzaGVldCwgc28gZGVzdHJveSBpdCBhbmQga2VlcCB0aGUgb2xkIG9uZVxuICAgICAgICAgICAgbmV3TGluay5yZW1vdmVFdmVudExpc3RlbmVyKCdlcnJvcicsIHN0eWxlc2hlZXRFcnJvcik7XG4gICAgICAgICAgICBuZXdMaW5rLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBzdHlsZXNoZWV0TG9hZCk7XG5cbiAgICAgICAgICAgIGRvY3VtZW50LmhlYWQucmVtb3ZlQ2hpbGQobmV3TGluayk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgdGhlIGN1cnJlbnQgd2luZG93IGlzIGJlaW5nIHJ1biBpbnNpZGUgYW4gaWZyYW1lXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59XG4gICAgICovXG4gICAgZnVuY3Rpb24gcnVubmluZ0luSWZyYW1lKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIHdpbmRvdy5zZWxmICE9PSB3aW5kb3cudG9wO1xuICAgICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgY29va2llXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNvbmZpZ3VyYXRpb25JZFxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB2ZXJzaW9uSWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBzZXRDb29raWUoY29uZmlndXJhdGlvbklkLCB2ZXJzaW9uSWQpIHtcbiAgICAgICAgaWYgKGNvbmZpZ3VyYXRpb25JZCkge1xuICAgICAgICAgICAgX2NvbmZpZ3VyYXRpb25JZCA9IGNvbmZpZ3VyYXRpb25JZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2ZXJzaW9uSWQpIHtcbiAgICAgICAgICAgIF92ZXJzaW9uSWQgPSB2ZXJzaW9uSWQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBZGRpbmcgYSBkb3QgYmVjYXVzZSBjb29raWUgc2V0IGJ5IGJjYXBwIGFsc28gYWRkcyBhIGRvdFxuICAgICAgICBDb29raWVzLnNldChfY29va2llTmFtZSwgX3ZlcnNpb25JZCArICdAJyArIF9jb25maWd1cmF0aW9uSWQsIHtcbiAgICAgICAgICAgIGRvbWFpbjogX2Nvb2tpZURvbWFpblxuICAgICAgICB9KTtcbiAgICB9XG5cbn0pKHdpbmRvdywgd2luZG93LkNoYW5uZWwsIHdpbmRvdy5Db29raWVzKTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKlxuICoqIFdFQlBBQ0sgRk9PVEVSXG4gKiogLi4vYmlnY29tbWVyY2UtYXBwLXZtL2NvZGViYXNlcy9uZy1zdGVuY2lsLWVkaXRvci9zcmMvc3RhdGljL3Nkay9zZGstc3RlbmNpbC1lZGl0b3IuanNcbiAqKiBtb2R1bGUgaWQgPSAxOFxuICoqIG1vZHVsZSBjaHVua3MgPSAxXG4gKiovIl0sInNvdXJjZVJvb3QiOiIifQ==