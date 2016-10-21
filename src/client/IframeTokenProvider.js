import doubleApi from "../doubleApi";
import BaseTokenProvider from "./BaseTokenProvider";

export default class IframeTokenProvider extends BaseTokenProvider {
    constructor(uri) {
        super();
        this._mID = 0;
        this._blankUri = uri;
        this._requests = {};
        const loadFramePromise = new Promise(resolve => {
            this.__prepareFrame(resolve);
        });
        this._waitForLoad = () => loadFramePromise;
    }

    canIUse() {
        return !/^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    }

    get(_cb) {
        const {promise, cb} = doubleApi(_cb);
        this._waitForLoad()
            .then(() => {
                return this.__rpc({ method: "GET" });
            })
            .then(token => {
                if (this.__isValidToken(token)) {
                    cb(null, token);
                } else {
                    console.log("Invalid token in iframe storage, will be cleared");
                    this.__rpc({ method: "REMOVE" });
                    cb(null, null);
                }
            });
        return promise;
    }

    set(token, _cb) {
        const {promise, cb} = doubleApi(_cb);
        this._waitForLoad()
            .then(() => {
                return this.__rpc({ method: "SET", token });
            })
            .then(() => {
                cb(null, null);
            });
        return promise;
    }

    __getMessageId() {
        return "a" + (++this._mID);
    }

    __rpc(data) {
        return new Promise((resolve, reject) => {
            data.id = this.__getMessageId();
            const timer = setTimeout(() => {
                reject("timeout");
            }, 2000);
            this._requests[data.id] = (_d) => {
                clearTimeout(timer);
                delete this._requests[data.id];
                resolve(_d);
            };
            this.iframeWindow.postMessage(data, this._blankUri);
        });
    }

    __prepareFrame(_cb) {
        const frame = document.createElement("iframe");
        frame.style.width = "0";
        frame.style.height = "0";
        frame.setAttribute("src", this._blankUri + "hooks/cd/frame");
        frame.addEventListener("load", () => {
            this.iframeWindow = frame.contentWindow;
            this.iframeWindow.postMessage({ method: "SUBSCRIBE", id: this.__getMessageId() }, this._blankUri);
            _cb();
        });
        window.addEventListener("message", event => {
            // console.log("EVENT:", event.origin, event.data);
            if (event.origin !== this._blankUri || event.data == null) { return; }

            if (event.data.requestId) {
                const requestCb = this._requests[event.data.requestId];
                if (typeof requestCb === "function") {
                    requestCb(event.data.result);
                }
            } else {
                if (typeof event.data.token !== "undefined") {
                    this.emit("change", event.data.token);
                }
            }
        }, false);
        document.body.appendChild(frame);
    }
}