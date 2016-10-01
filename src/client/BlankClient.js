import WSClient from "./WSClient";
import EventEmitter from "../utils/events";
import {checkToken, decodeToken} from "../jwt";
import doubleApi from "../doubleApi";
import {TOKEN_LS_KEY, CLIENT_STATES} from "../const";
import AccessTokenProvider from "./AccessTokenProvider";

export default class BlankClient extends EventEmitter {
    constructor(blankUri = "", ws = true) {
        super();
        this._blankUri = blankUri;
        this._wsClient = new WSClient();
        this._wsClient.onopen = this.__onWSOpen.bind(this);
        this._wsClient.onerror = this.__onWSError.bind(this);
        this._wsClient.onclose = this.__onWSClose.bind(this);
        this._ws = ws;
        this.state = CLIENT_STATES.authorization;

        this.accessTokenProvider = new AccessTokenProvider(blankUri);
        this.accessTokenProvider.get()
            .then(token => {
                this._accessToken = token;
                if (token) {
                    this._ws ? this.__openWS() : this.__setState(CLIENT_STATES.ready);
                } else {
                    this.__setState(CLIENT_STATES.unauthorized);
                }
                this.emit("init");
            });
    }

    signIn(login, password, _cb) {
        const {promise, cb} = doubleApi(_cb);
        this._accessToken = null;

        const formData = new FormData();
        formData.append("login", login);
        formData.append("password", password);

        fetch(`${this._blankUri}/login`, {
            method: "POST",
            body: formData,
        })
            .then(response => {
                if (response.status === 200) {
                    return response.json();
                }
                const error = new Error(response.statusText);
                error.response = response;
                throw error;
            })
            .then(data => {
                this._accessToken = data.access_token;
                this.accessTokenProvider.set(data.access_token);
                cb(null, data.access_token);
                this._ws ? this.__openWS() : this.__setState(CLIENT_STATES.ready);
            })
            .catch(err => {
                this.__setState(CLIENT_STATES.unauthorized);
                cb(err, null);
            });

        return promise;
    }

    signOut() {
        this._wsClient.close();
    }

    __openWS() {
        this.__setState(CLIENT_STATES.wsConnecting);
        const uri = (this._blankUri ?
            this._blankUri.replace(/^http/, "ws") :
            (location.protocol === "https:" ? "wss:" : "ws:") + "//" + location.host) + location.pathname +
            `wamp?access_token=${encodeURIComponent(this._accessToken)}`;
        this._wsClient.open(uri);
    }

    __checkAccessToken() {
        const token = this._accessToken;
        if (this._accessToken) {
            return checkToken()
                .then(res => {
                    if (token === this._accessToken && res) {
                        //Token valid, changing state
                        // this.state = CLIENT_STATES.signedIn;
                    } else {
                        throw new Error();
                    }
                })
                .catch(() => {
                    if (token === this._accessToken) {
                        //Invalid token, cleaning up and going offline
                        this._accessToken = null;
                        this.state = CLIENT_STATES.offline;
                        this._wsClient.close();
                        localStorage.removeItem(TOKEN_LS_KEY);
                        this.emit("");
                    }
                });
        }
        return Promise.resolve(false);
    }

    __setState(state) {
        const prev = this.state;
        this.state = state;
        this.emit("change", this.state, prev);
    }

    __onWSOpen() {
        console.log("WS CONNECTED");
        // this.emit("wsopen");
        this.__setState(CLIENT_STATES.wsConnected);
    }

    __onWSError(e) {
        console.log("WS ERROR:", e);
        // this.emit("wserror", e);
    }

    __onWSClose(e) {
        // this.emit("wsclose", e);
    }
}