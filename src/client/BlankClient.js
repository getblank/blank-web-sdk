import WSClient from "./WSClient";
import EventEmitter from "../utils/events";
import {isTokenInvalid, decodeToken} from "../jwt";
import doubleApi from "../doubleApi";
import {TOKEN_LS_KEY, CLIENT_STATES} from "../const";
import LsTokenProvider from "./LsTokenProvider";
import IframeTokenProvider from "./IframeTokenProvider";

export default class BlankClient extends EventEmitter {
    constructor(blankUri = "", ws = true) {
        super();
        this._blankUri = process.env.WS || blankUri;
        this._wsClient = new WSClient();
        this._wsClient.onopen = this.__onWSOpen.bind(this);
        this._wsClient.onerror = this.__onWSError.bind(this);
        this._wsClient.onclose = this.__onWSClose.bind(this);
        this._ws = ws;
        this.state = CLIENT_STATES.authorization;

        this.accessTokenProvider = new LsTokenProvider(blankUri);
        const initPromise = this.accessTokenProvider.get()
            .then(token => {
                this._accessToken = token;
                if (token) {
                    this._ws ? this.__openWS() : this.__setState(CLIENT_STATES.ready);
                } else {
                    this.__setState(CLIENT_STATES.unauthorized);
                }
                this.emit("init");
            });
        this.init = () => initPromise;
        this.call = this._wsClient.call;
        this.subscribe = this._wsClient.subscribe;
        this.unsubscribe = this._wsClient.unsubscribe;
    }

    getTokenInfo() {
        if (this._accessToken == null) { return null; }
        return decodeToken(this._accessToken);
    }

    signIn(login, password, _cb) {
        const {promise, cb} = doubleApi(_cb);
        this._accessToken = null;

        const formData = new FormData();
        formData.append("login", login);
        formData.append("password", password);

        let response;
        fetch(`${this._blankUri}/login`, {
            method: "POST",
            body: formData,
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
        this.__reset();
        return Promise.resolve();
    }

    __openWS() {
        this.__setState(CLIENT_STATES.wsConnecting);
        let uri = this._blankUri ?
            this._blankUri.replace(/^http/, "ws")
            :
            (location.protocol === "https:" ? "wss:" : "ws:") + "//" + location.host + location.pathname;
        if (uri[uri.length - 1] !== "/") {
            uri += "/";
        }
        uri += `wamp?access_token=${encodeURIComponent(this._accessToken)}`;
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