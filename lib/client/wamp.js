// Wamp-one wamp-client.js 1.0.2
// (c) 2015 Samorukov Valentin, Kuvshinov Evgeniy
// Wamp-one may be freely distributed under the MIT license.
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var msgTypes = {
    "WELCOME": 0,
    "PREFIX": 1,
    "CALL": 2,
    "CALLRESULT": 3,
    "CALLERROR": 4,
    "SUBSCRIBE": 5,
    "UNSUBSCRIBE": 6,
    "PUBLISH": 7,
    "EVENT": 8,
    "SUBSCRIBED": 9,
    "SUBSCRIBEERROR": 10,
    "HB": 20
};

var wsStates = {
    "CONNECTING": 0,
    "OPEN": 1,
    "CLOSING": 2,
    "CLOSED": 3
};

var helpers = {
    getRandom: function getRandom(min, max) {
        return Math.random() * (max - min) + min;
    }
};

var WampClient = function () {
    function WampClient(heartBeat, stringMsgTypes) {
        _classCallCheck(this, WampClient);

        if (!(this instanceof WampClient)) {
            return new WampClient(heartBeat);
        }
        this._wsClient = null;
        this._heartBeat = heartBeat;
        this._stringMsgTypes = stringMsgTypes;
        this._callSequence = 0;
        //Outbound subscriptions (from THIS to SERVER)
        this._eventHandlers = {};
        this._subscribedHandlers = {};
        this._subscribeErrorHandlers = {};
        //Inbound subscriptions (from SERVER to THIS)
        this._subUris = {};
        //Outbound RPC
        this._callResponseHandlers = {};
        //Inbound RPC
        this._callRequestHandlers = {};
        //HB
        this._heartBeatHandlers = {};
        this._heartBeatInterval = 5 * 1000;
        //WS handlers
        this._wsOpenedHandler = this._wsOpenedHandler.bind(this);
        this._wsClosedHandler = this._wsClosedHandler.bind(this);
        this._wsErrorHandler = this._wsErrorHandler.bind(this);
        this._wsMessageHandler = this._wsMessageHandler.bind(this);
        //Public API
        this.open = this.connect = this.connect.bind(this);
        this.close = this.close.bind(this);
        this.call = this.call.bind(this);
        this.subscribe = this.subscribe.bind(this);
        this.unsubscribe = this.unsubscribe.bind(this);
        this.publish = this.publish.bind(this);
        this.event = this.event.bind(this);
        this.registerRpcHandler = this.registerRpcHandler.bind(this);
        //Public event handlers
        this.onclose = null;
        this.onopen = null;

        Object.defineProperty(this, "state", {
            get: function get() {
                return this._wsClient && this._wsClient.readyState;
            },
            enumerable: true
        });
    }

    /**
     *
     * @param serverUrl - адрес сервера
     * @param cb - callback, который отработает при успешном соединении с сервером
     * @private
     */


    _createClass(WampClient, [{
        key: "connect",
        value: function connect(serverUrl, cb) {
            if (this._wsClient && this._wsClient.readyState !== wsStates.CLOSED) {
                throw new Error("WebSocket not closed. Close WebSocket and try again. To close WebSocket use function \"close()\"");
            }
            if (!/^(wss?:\/\/).+/.test(serverUrl)) {
                throw new Error("Incorrect server url: " + serverUrl);
            }
            this._serverUrl = serverUrl;
            this._wsClient = new WebSocket(serverUrl);
            this._wsClient.onopen = this._wsOpenedHandler;
            this._wsClient.onclose = this._wsClosedHandler;
            this._wsClient.onmessage = this._wsMessageHandler;
            this._wsClient.onerror = this._wsErrorHandler;
            this._connectHandler = cb;
        }
    }, {
        key: "close",
        value: function close() {
            if (this._wsClient) {
                this._wsClient.close(4000);
            }
        }

        /**
         * Remote procedure call
         * @param url
         * @param callback - callback, который вызовется, когда придет ответ с сервера
         * @private
         */

    }, {
        key: "call",
        value: function call(url, callback) {
            if (this._wsClient.readyState === wsStates.OPEN) {
                var callId = ++this._callSequence;
                this._callResponseHandlers[callId] = callback;
                var callData = [this._stringMsgTypes ? "CALL" : msgTypes.CALL, callId, url];
                callData = callData.concat(Array.prototype.slice.call(arguments, 2));
                this._wsClient.send(JSON.stringify(callData));
            } else {
                throw new Error("WebSocket not connected");
            }
        }

        /**
         * Server events subscription
         * @param url
         * @param callback
         * @private
         */

    }, {
        key: "subscribe",
        value: function subscribe(uri, eventCb, okCb, errorCb, params) {
            if (this._wsClient.readyState === wsStates.OPEN) {
                this._eventHandlers[uri] = eventCb;
                this._subscribedHandlers[uri] = okCb;
                this._subscribeErrorHandlers[uri] = errorCb;
                var msg = [this._stringMsgTypes ? "SUBSCRIBE" : msgTypes.SUBSCRIBE, uri];
                if (params) {
                    msg.push(params);
                }
                this._wsClient.send(JSON.stringify(msg));
            } else {
                throw new Error("WebSocket not connected");
            }
        }

        /**
         * Отписка от серверных событий
         * @param url
         * @private
         */

    }, {
        key: "unsubscribe",
        value: function unsubscribe(uri) {
            delete this._eventHandlers[uri];
            delete this._subscribedHandlers[uri];
            delete this._subscribeErrorHandlers[uri];
            if (this._wsClient.readyState === wsStates.OPEN) {
                this._wsClient.send(JSON.stringify([this._stringMsgTypes ? "UNSUBSCRIBE" : msgTypes.UNSUBSCRIBE, uri]));
            }
        }
    }, {
        key: "publish",
        value: function publish(uri, event) {
            if (this._wsClient.readyState === wsStates.OPEN) {
                this._wsClient.send(JSON.stringify([this._stringMsgTypes ? "PUBLISH" : msgTypes.PUBLISH, uri, event]));
            } else {
                throw new Error("WebSocket not connected");
            }
        }
    }, {
        key: "event",
        value: function event(uri, _event) {
            if (this._wsClient.readyState === wsStates.OPEN) {
                if (this._subUris[uri]) {
                    this._wsClient.send(JSON.stringify([this._stringMsgTypes ? "EVENT" : msgTypes.EVENT, uri, _event]));
                } else {
                    console.info("No subscribers for \"" + uri + "\"");
                }
            } else {
                throw new Error("WebSocket not connected");
            }
        }
    }, {
        key: "registerRpcHandler",
        value: function registerRpcHandler(uri, cb) {
            if (typeof uri !== "string" || !uri) {
                throw new Error("Invalid uri, must be non empty string");
            }
            if (typeof cb === "function") {
                this._callRequestHandlers[uri] = cb;
            } else {
                if (cb == null) {
                    delete this._callRequestHandlers[uri];
                } else {
                    throw new Error("Invalid callback, must be function or null");
                }
            }
        }
    }, {
        key: "_wsMessageHandler",
        value: function _wsMessageHandler(rawMsg) {
            var msg = void 0;
            try {
                msg = JSON.parse(rawMsg.data);
            } catch (e) {
                console.debug("WAMP: Invalid message JSON");
                return;
            }
            var msgType = msg[0],
                msgId = msg[1],
                msgData = msg.length > 2 ? msg[2] : null;
            if (typeof msgType === "string" && msgTypes.hasOwnProperty(msgType)) {
                msgType = msgTypes[msgType];
            }
            switch (msgType) {
                case msgTypes.EVENT:
                    if (typeof this._eventHandlers[msgId] === "function") {
                        this._eventHandlers[msgId](msgData);
                    }
                    break;
                case msgTypes.SUBSCRIBE:
                    this._subUris[msgId] = true;
                    break;
                case msgTypes.UNSUBSCRIBE:
                    delete this._subUris[msgId];
                    break;
                case msgTypes.SUBSCRIBED:
                    if (typeof this._subscribedHandlers[msgId] === "function") {
                        this._subscribedHandlers[msgId](msgData);
                    }
                    delete this._subscribedHandlers[msgId];
                    break;
                case msgTypes.SUBSCRIBEERROR:
                    if (typeof this._subscribeErrorHandlers[msgId] === "function") {
                        this._subscribeErrorHandlers[msgId](msgData);
                    }
                    delete this._subscribeErrorHandlers[msgId];
                    break;
                case msgTypes.CALL:
                    {
                        var rpcUri = msgData;
                        var _iteratorNormalCompletion = true;
                        var _didIteratorError = false;
                        var _iteratorError = undefined;

                        try {
                            for (var _iterator = Object.keys(this._callRequestHandlers)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                                var uri = _step.value;

                                if (uri === rpcUri || new RegExp(uri).test(rpcUri)) {
                                    this._callRequestHandlers[uri].apply(this, msg.slice(3));
                                }
                            }
                        } catch (err) {
                            _didIteratorError = true;
                            _iteratorError = err;
                        } finally {
                            try {
                                if (!_iteratorNormalCompletion && _iterator.return) {
                                    _iterator.return();
                                }
                            } finally {
                                if (_didIteratorError) {
                                    throw _iteratorError;
                                }
                            }
                        }
                    }
                    break;
                case msgTypes.CALLRESULT:
                    if (typeof this._callResponseHandlers[msgId] === "function") {
                        this._callResponseHandlers[msgId](null, msgData);
                    }
                    delete this._callResponseHandlers[msgId];
                    break;
                case msgTypes.CALLERROR:
                    var err = {
                        desc: msgData,
                        details: msg.length > 3 ? msg[3] : null
                    };
                    if (typeof this._callResponseHandlers[msgId] === "function") {
                        this._callResponseHandlers[msgId](err, null);
                    }
                    delete this._callResponseHandlers[msgId];
                    break;
                case msgTypes.HB:
                    if (typeof this._heartBeatHandlers[msgId] === "function") {
                        this._heartBeatHandlers[msgId](msgData);
                    }
                    delete this._heartBeatHandlers[msgId];
                    break;
            }
        }
    }, {
        key: "_wsOpenedHandler",
        value: function _wsOpenedHandler() {
            var self = this;
            if (self._heartBeat) {
                self._startHeartbeat.call(self);
            }
            if (typeof self._connectHandler === "function") {
                self._connectHandler();
            }
            if (typeof self.onopen === "function") {
                self.onopen();
            }
        }
    }, {
        key: "_wsClosedHandler",
        value: function _wsClosedHandler(closeEvent) {
            var self = this;
            self._eventHandlers = {};
            self._subscribedHandlers = {};
            self._subscribeErrorHandlers = {};
            self._subUris = {};
            self._callResponseHandlers = {};
            self._callRequestHandlers = {};
            self._heartBeatHandlers = {};
            clearInterval(self._hbInterval);
            if (closeEvent.code !== 4000) {
                setTimeout(self._startReconnect.bind(self), helpers.getRandom(2, 4) * 1000);
            }
            if (typeof self.onclose === "function") {
                self.onclose();
            }
        }
    }, {
        key: "_wsErrorHandler",
        value: function _wsErrorHandler(err) {
            console.log(err);
        }
    }, {
        key: "_startReconnect",
        value: function _startReconnect() {
            var self = this;
            if (self._wsClient && self._wsClient.readyState === wsStates.CLOSED) {
                self.connect.call(self, self._serverUrl);
            }
        }
    }, {
        key: "_startHeartbeat",
        value: function _startHeartbeat() {
            var self = this;
            var hbCount = 0,
                hbCounter = 0;
            self._hbInterval = setInterval(function () {
                if (!self._wsClient || self._wsClient.readyState !== wsStates.OPEN) {
                    clearInterval(self._hbInterval);
                    return;
                }
                self._sendHeartbeat.call(self, hbCount++, function () {
                    hbCounter = 0;
                });
                hbCounter++;
                if (hbCounter > 5) {
                    console.warn("Ping timeout, reconnecting...");
                    self.close();
                }
            }, self._heartBeatInterval);
        }
    }, {
        key: "_sendHeartbeat",
        value: function _sendHeartbeat(hbNumber, cb) {
            var self = this;
            self._heartBeatHandlers[hbNumber] = cb;
            self._wsClient.send(JSON.stringify([self._stringMsgTypes ? "HB" : msgTypes.HB, hbNumber]));
        }
    }]);

    return WampClient;
}();

exports.default = WampClient;