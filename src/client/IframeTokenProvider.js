import doubleApi from "../doubleApi";
import {TOKEN_LS_KEY} from "../const";
import {decodeToken} from "../jwt";

export default class AccessTokenProvider {
    constructor(uri) {
        this.store = "ls";
        if (uri) {
            this._blankUri = uri;
            this.store = "iframe";
            this.__prepareFrame;
        }
    }

    get(_cb) {
        const {promise, cb} = doubleApi(_cb);
        let token;
        switch (this.store) {
            case "ls":
                token = localStorage.getItem(TOKEN_LS_KEY) || null;
                cb(null, this.__validateToken(token));
                break;
            case "iframe":
                token = localStorage.getItem(TOKEN_LS_KEY) || null;
                cb(null, this.__validateToken(token));
                break;
        }
        return promise;
    }

    set(token, _cb) {
        const {promise, cb} = doubleApi(_cb);
        switch (this.store) {
            case "ls":
                if (token) {
                    localStorage.setItem(TOKEN_LS_KEY, token);
                } else {
                    localStorage.removeItem(TOKEN_LS_KEY);
                }
                cb(null);
                break;
        }
        return promise;
    }

    __validateToken(token) {
        if (token) {
            try {
                const tokenInfo = decodeToken(token);
                if (tokenInfo.exp > Math.floor(Date.now() / 1000)) {
                    return token;
                }
            } catch (e) {
                console.log("Invalid token in localStorage, will be cleared");
                localStorage.removeItem(TOKEN_LS_KEY);
            }
        }
        return null;
    }

    __prepareFrame(cb) {
        const frame = this.ifrm = document.createElement("iframe");
        frame.style.width = "0";
        frame.style.height = "0";
        frame.setAttribute("src", this._blankUri + "/sso-frame");
        frame.addEventListener("load", () => {
            const w = frame.contentWindow;
            w.postMessage("", this._blankUri);
        });
        window.addEventListener("message", event => {
            if (event.origin !== this._blankUri) { return; }
        }, false);
        document.body.appendChild(frame);
    }
}