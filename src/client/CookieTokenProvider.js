import doubleApi from "../doubleApi";
import BaseTokenProvider from "./BaseTokenProvider";
import { decodeToken } from "../jwt";

const TOKEN_COOKIE_NAME = "blank-token";

export default class CookieTokenProvider extends BaseTokenProvider {
    constructor() {
        super();
    }

    canIUse() {
        return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    }

    get(_cb) {
        const {promise, cb} = doubleApi(_cb);
        const token = readCookie(TOKEN_COOKIE_NAME);
        if (this.__isValidToken(token)) {
            cb(null, token);
        } else {
            console.log("Invalid token in cookie, will be cleared");
            eraseCookie(TOKEN_COOKIE_NAME);
            cb(null, null);
        }
        return promise;
    }

    set(token, _cb) {
        const {promise, cb} = doubleApi(_cb);
        if (token) {
            const info = decodeToken(token);
            createCookie(TOKEN_COOKIE_NAME, token, info.exp);
        } else {
            eraseCookie(TOKEN_COOKIE_NAME);
        }
        cb(null);
        return promise;
    }
}

function createCookie(name, value, expiresIn) {
    let cookie = `${name}=${value}`,
        deleting = expiresIn === -1,
        expires = "";
    if (expiresIn) {
        expires = "; expires=" + new Date(deleting ? 0 : expiresIn * 1000).toGMTString();
    }

    const hostname = document.location.hostname.split(".");
    for (let i = hostname.length - 1; i >= 0; i--) {
        const h = hostname.slice(i).join(".");
        document.cookie = `${cookie}${expires}; path=/; domain=.${h};`;
        if (!deleting && document.cookie.indexOf(cookie) > -1) {
            return;
        }
    }
}

function readCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(";");
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == " ") c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function eraseCookie(name) {
    createCookie(name, "", -1);
}