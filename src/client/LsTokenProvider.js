import doubleApi from "../doubleApi";
import {TOKEN_LS_KEY} from "../const";
import BaseTokenProvider from "./BaseTokenProvider";

export default class AccessTokenProvider extends BaseTokenProvider {
    get(_cb) {
        const {promise, cb} = doubleApi(_cb);
        const token = localStorage.getItem(TOKEN_LS_KEY) || null;
        if (this.__isValidToken(token)) {
            cb(null, token);
        } else {
            console.log("Invalid token in localStorage, will be cleared");
            localStorage.removeItem(TOKEN_LS_KEY);
            cb(null, null);
        }
        return promise;
    }

    set(token, _cb) {
        const {promise, cb} = doubleApi(_cb);
        if (token) {
            localStorage.setItem(TOKEN_LS_KEY, token);
        } else {
            localStorage.removeItem(TOKEN_LS_KEY);
        }
        cb(null);
        return promise;
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