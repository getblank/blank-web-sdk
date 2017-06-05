import WSClient from "./WSClient";
import EventEmitter from "../utils/events";
import { isTokenInvalid, decodeToken } from "../jwt";
import doubleApi from "../doubleApi";
import { CLIENT_STATES } from "../const";
import LsTokenProvider from "./LsTokenProvider";
import IframeTokenProvider from "./IframeTokenProvider";
import CookieTokenProvider from "./CookieTokenProvider";

const providers = { LsTokenProvider, IframeTokenProvider, CookieTokenProvider };

export default class BlankClient extends EventEmitter {
    constructor(blankUri = "", ws = true) {
        super();
        this._blankUri = process.env.WS ||
            blankUri ||
            (location.protocol + "//" + location.host + location.pathname);
        if (this._blankUri[this._blankUri.length - 1] !== "/") {
            this._blankUri += "/";
        }
        this._wsClient = new WSClient();
        this._wsClient.onopen = this.__onWSOpen.bind(this);
        this._wsClient.onerror = this.__onWSError.bind(this);
        this._wsClient.onclose = this.__onWSClose.bind(this);
        this._ws = ws;
        this.state = CLIENT_STATES.authorization;

        for (let pName of Object.keys(providers)) {
            const provider = new providers[pName](this._blankUri);
            if (provider.canIUse()) {
                this.accessTokenProvider = provider;
                console.log("Selected token provider:", pName);
                break;
            }
        }

        if (this.accessTokenProvider == null) {
            throw new Error("Cannot find usable token provider!");
        }
        this.accessTokenProvider.on("change", (token) => {
            // console.log("TOKEN UPDATE:", token);
            this.__setToken(token);
        });
        const initPromise = this.accessTokenProvider.get()
            .then(token => {
                this.__setToken(token);
                this.emit("init");
            });
        this.init = () => initPromise;
        this.call = this._wsClient.call;
        this.subscribe = this._wsClient.subscribe;
        this.unsubscribe = this._wsClient.unsubscribe;
    }

    getTokenInfo() {
        if (this._accessToken == null) {
            return null;
        }

        const tokenInfo = decodeToken(this._accessToken);
        tokenInfo.RAW = this._accessToken;
        return tokenInfo;
    }

    signIn(props, _cb) {
        const { promise, cb } = doubleApi(_cb);
        this._accessToken = null;

        const formData = new FormData();
        for (let propName of Object.keys(props)) {
            formData.append(propName, props[propName]);
        }

        let response;
        fetch(`${this._blankUri}login`, {
            method: "POST",
            body: formData,
            credentials: "include",
        })
            .then(_response => {
                response = _response;
                return response.json();
            })
            .then(data => {
                if (response.status !== 200) {
                    const error = new Error(data);
                    error.response = response;
                    throw error;
                }
                this._accessToken = data.access_token;
                this.accessTokenProvider.set(data.access_token);
                cb(null, data.user);
                this._ws ? this.__openWS() : this.__setState(CLIENT_STATES.ready);
            })
            .catch(err => {
                console.log("SIGN IN ERROR");
                this.__setState(CLIENT_STATES.unauthorized);
                cb(err, null);
            });

        return promise;
    }

    signOut() {
        let response;
        return fetch(`${this._blankUri}logout?key=${this._accessToken}`, {
            method: "POST",
        })
            .then(res => {
                return res.json();
            })
            .then(res => {
                if (response.status !== 200) {
                    const error = new Error(res);
                    error.response = response;
                    throw error;
                }

                this.__reset();
            })
            .catch(err => {
                console.log("SIGN OUT ERROR", err);
            });
    }

    __openWS() {
        this.__setState(CLIENT_STATES.wsConnecting);
        const uri = this._blankUri.replace(/^http/, "ws") + "wamp";
        this._wsClient.open(uri);
    }

    __checkAccessToken() {
        const token = this._accessToken;
        if (this._accessToken) {
            return isTokenInvalid(token, this._blankUri)
                .then(invalid => {
                    if (token !== this._accessToken) { return; }
                    if (invalid) {
                        //Invalid token, cleaning up and going offline
                        console.log("INVALID TOKEN!");
                        this.__reset();
                    }
                });
        }
        return Promise.resolve(false);
    }

    __setState(state) {
        const prev = this.state;
        this.state = state;
        try {
            this.emit("change", state, prev);
        } catch (e) { }
    }

    __setToken(token) {
        this._accessToken = token;
        if (token) {
            this._ws ? this.__openWS() : this.__setState(CLIENT_STATES.ready);
        } else {
            this.__setState(CLIENT_STATES.unauthorized);
        }
    }

    __reset() {
        this._accessToken = null;
        this.accessTokenProvider.set(null);
        this.__setState(CLIENT_STATES.unauthorized);
        this._wsClient.close();
    }

    __onWSOpen() {
        console.log("WS CONNECTED");
        // this.emit("wsopen");
        this.__setState(CLIENT_STATES.wsConnected);
    }

    __onWSError(e) {
        console.log("WS ERROR:", e);
        this.__checkAccessToken();
        // this.emit("wserror", e);
    }

    __onWSClose() {
        console.log("WS CLOSE");
        if (this.state === CLIENT_STATES.wsConnected) {
            this.__setState(CLIENT_STATES.wsConnecting);
        }
        // this.emit("wsclose", e);
    }
}