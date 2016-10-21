import doubleApi from "../doubleApi";
import { TOKEN_LS_KEY } from "../const";
import BaseTokenProvider from "./BaseTokenProvider";

export default class LsTokenProvider extends BaseTokenProvider {
    constructor(uri) {
        super();
        this._blankUri = uri;
        window.addEventListener("storage", e => {
            if (e.key === TOKEN_LS_KEY) {
                this.emit("change", localStorage.getItem(TOKEN_LS_KEY));
            }
        });
    }

    canIUse() {
        return this.__isSameOrigin(this._blankUri) && !/^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    }

    __isSameOrigin(url) {
        if (!url) { return true; }
        const loc = window.location,
            a = document.createElement("a");
        a.href = url;
        return a.hostname == loc.hostname &&
            a.port == loc.port &&
            a.protocol == loc.protocol;
    }

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
}