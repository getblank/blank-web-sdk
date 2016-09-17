// Wamp-one wamp-client.js 1.0.2
// (c) 2015 Samorukov Valentin, Kuvshinov Evgeniy
// Wamp-one may be freely distributed under the MIT license.
"use strict";

import doubleApi from "../doubleApi";

const msgTypes = {
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
    "HB": 20,
};

const wsStates = {
    "CONNECTING": 0,
    "OPEN": 1,
    "CLOSING": 2,
    "CLOSED": 3,
};

const helpers = {
    getRandom: function (min, max) {
        return Math.random() * (max - min) + min;
    },
};

export default class WampClient {
    constructor(heartBeat, stringMsgTypes) {
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
            get: function () {
                return this._wsClient && this._wsClient.readyState;
            },
            enumerable: true,
        });
    }

    /**
     *
     * @param serverUrl - адрес сервера
     * @param cb - callback, который отработает при успешном соединении с сервером
     * @private
     */
    connect(serverUrl, cb) {
        if (this._wsClient && this._wsClient.readyState !== wsStates.CLOSED) {
            throw new Error("WebSocket not closed. Close WebSocket and try again. To close WebSocket use function \"close()\"");
        }
        if (!/^(wss?:\/\/).+/.test(serverUrl)) {
            throw new Error("Incorrect server url: " + serverUrl);
        }
        let Client = typeof WebSocket === "undefined" ? this.WebSocket : WebSocket;
        this._serverUrl = serverUrl;
        this._wsClient = new Client(serverUrl);
        this._wsClient.onopen = this._wsOpenedHandler;
        this._wsClient.onclose = this._wsClosedHandler;
        this._wsClient.onmessage = this._wsMessageHandler;
        this._wsClient.onerror = this._wsErrorHandler;
        this._connectHandler = cb;
    }

    close() {
        if (this._wsClient) {
            this._closedByApplication = true;
            this._wsClient.close();
        }
    }

    /**
     * Remote procedure call
     * @param url
     * @param callback - callback, который вызовется, когда придет ответ с сервера
     * @private
     */
    call(url) {
        if (!url) {
            throw new Error("invalid args: url");
        }
        if (this._wsClient.readyState !== wsStates.OPEN) {
            throw new Error("WebSocket not connected");
        }
        let cb, promise, data = Array.prototype.slice.call(arguments, 1);
        if (typeof data[data.length - 1] === "function") {
            cb = data.pop();
        }
        ({ promise, cb } = doubleApi(cb));

        let callId = ++this._callSequence;
        this._callResponseHandlers[callId] = cb;
        var callData = [(this._stringMsgTypes ? "CALL" : msgTypes.CALL), callId, url];
        callData = callData.concat(data);
        this._wsClient.send(JSON.stringify(callData));

        return promise;
    }

    /**
     * Server events subscription
     * @param url
     * @param callback
     * @private
     */
    subscribe(uri, eventCb, okCb, errorCb, params) {
        if (this._wsClient.readyState === wsStates.OPEN) {
            this._eventHandlers[uri] = eventCb;
            this._subscribedHandlers[uri] = okCb;
            this._subscribeErrorHandlers[uri] = errorCb;
            let msg = [(this._stringMsgTypes ? "SUBSCRIBE" : msgTypes.SUBSCRIBE), uri];
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
    unsubscribe(uri) {
        delete this._eventHandlers[uri];
        delete this._subscribedHandlers[uri];
        delete this._subscribeErrorHandlers[uri];
        if (this._wsClient.readyState === wsStates.OPEN) {
            this._wsClient.send(JSON.stringify([(this._stringMsgTypes ? "UNSUBSCRIBE" : msgTypes.UNSUBSCRIBE), uri]));
        }
    }

    publish(uri, event) {
        if (this._wsClient.readyState === wsStates.OPEN) {
            this._wsClient.send(JSON.stringify([(this._stringMsgTypes ? "PUBLISH" : msgTypes.PUBLISH), uri, event]));
        } else {
            throw new Error("WebSocket not connected");
        }
    }

    event(uri, event) {
        if (this._wsClient.readyState === wsStates.OPEN) {
            if (this._subUris[uri]) {
                this._wsClient.send(JSON.stringify([(this._stringMsgTypes ? "EVENT" : msgTypes.EVENT), uri, event]));
            } else {
                console.info(`No subscribers for "${uri}"`);
            }
        } else {
            throw new Error("WebSocket not connected");
        }
    }

    registerRpcHandler(uri, cb) {
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

    _wsMessageHandler(rawMsg) {
        let msg;
        try {
            msg = JSON.parse(rawMsg.data);
        } catch (e) {
            console.debug("WAMP: Invalid message JSON");
            return;
        }
        let msgType = msg[0],
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
                    let rpcUri = msgData;
                    for (let uri of Object.keys(this._callRequestHandlers)) {
                        if (uri === rpcUri || (new RegExp(uri)).test(rpcUri)) {
                            this._callRequestHandlers[uri].apply(this, msg.slice(3));
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
                    details: msg.length > 3 ? msg[3] : null,
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

    _wsOpenedHandler(e) {
        if (this._heartBeat) {
            this._startHeartbeat.call(this);
        }
        if (typeof this._connectHandler === "function") {
            this._connectHandler();
        }
        if (typeof this.onopen === "function") {
            this.onopen(e);
        }
    }

    _wsClosedHandler(closeEvent) {
        clearInterval(this._hbInterval);
        if (!this._closedByApplication) {
            setTimeout(this._startReconnect.bind(this), helpers.getRandom(2, 4) * 1000);
        }

        this._closedByApplication = false;
        this._eventHandlers = {};
        this._subscribedHandlers = {};
        this._subscribeErrorHandlers = {};
        this._subUris = {};
        this._callResponseHandlers = {};
        this._callRequestHandlers = {};
        this._heartBeatHandlers = {};
        if (typeof this.onclose === "function") {
            this.onclose(closeEvent);
        }
    }

    _wsErrorHandler(err) {
        console.error(err);
    }

    _startReconnect() {
        var self = this;
        if (self._wsClient && self._wsClient.readyState === wsStates.CLOSED) {
            self.connect.call(self, self._serverUrl);
        }
    }

    _startHeartbeat() {
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

    _sendHeartbeat(hbNumber, cb) {
        var self = this;
        self._heartBeatHandlers[hbNumber] = cb;
        self._wsClient.send(JSON.stringify([(self._stringMsgTypes ? "HB" : msgTypes.HB), hbNumber]));
    }
}