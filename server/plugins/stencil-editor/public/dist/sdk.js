/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

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

	        if (_cookieDomain.substr(0, 4) === 'www.') {
	            Cookies.remove(_cookieName, {
	                domain: _cookieDomain.substr(3, _cookieDomain.length)
	            });
	        }

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