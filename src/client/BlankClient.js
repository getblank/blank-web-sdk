import WSClient from "./WSClient";
import EventEmitter from "../utils/events";
import doubleApi from "../doubleApi";
import { CLIENT_STATES } from "../const";

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

        this.init = () => {
            this.emit("init");
            return this.getTokenInfo()
                .then(res => {
                    if (res) {
                        this.__openWS();
                    }
                });
        };

        this.call = this._wsClient.call;
        this.subscribe = this._wsClient.subscribe;
        this.unsubscribe = this._wsClient.unsubscribe;
    }

    getTokenInfo() {
        return this.__checkAccessToken()
            .then(res => res);
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

                this._user = data.user;
                localStorage.setItem("signedIn", true);
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
        return fetch(`${this._blankUri}logout`, { method: "POST", credentials: "include" })
            .then(res => {
                response = res;
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
        return fetch(`${this._blankUri}check-jwt`, {
            method: "POST",
            credentials: "include",
        })
            .then(res => {
                if (res.status !== 200) {
                    if (res.status === 403) {
                        this.__reset();
                        return;
                    }

                    throw new Error(`[__checkAccessToken] error status: ${res.status} ${res.statusText}`);
                }

                return res.json();
            })
            .then(res => {
                if (!res) {
                    return;
                }

                if (!res.valid) {
                    this.__reset();
                    return;
                }

                this._user = res.user;
                return res.user;
            });
    }

    __setState(state) {
        const prev = this.state;
        this.state = state;
        try {
            this.emit("change", state, prev);
        } catch (err) {
            console.error("__setState error", err);
        }
    }

    __setToken(token) {
        if (token) {
            this._ws ? this.__openWS() : this.__setState(CLIENT_STATES.ready);
        } else {
            this.__setState(CLIENT_STATES.unauthorized);
        }
    }

    __reset() {
        localStorage.removeItem("signedIn");
        this._user = null;
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