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
        this.state = CLIENT_STATES.authorization;

        this.accessTokenProvider = new AccessTokenProvider(blankUri);
        this.accessTokenProvider.get()
            .then(token => {
                if (token) {
                    ws ? this.openWS() : this.__setState(CLIENT_STATES.ready);
                } else {
                    this.__setState(CLIENT_STATES.notAuthorized);
                }
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
                this.state = CLIENT_STATES.http;
                cb(null, data.access_token);
            })
            .catch(err => {
                cb(err, null);
            });

        return promise;
    }

    signOut() {

    }

    openWS() {
        if (this.state === CLIENT_STATES.init) { throw new Error("please wait for initialization"); }
        if (this.state === CLIENT_STATES.offline) { throw new Error("need to sign in first"); }
        if (this.state === CLIENT_STATES.online) { return; }
        const uri = (this._blankUri ?
            this._blankUri.replace(/^http/, "ws") :
            (location.protocol === "https:" ? "wss:" : "ws:") + "//" + location.host) +
            `/wamp?access_token=${encodeURIComponent(this._accessToken)}`;
        this._wsClient.open(uri);
    }

    closeWS() {
        this._wsClient.close();
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
        // this.emit("wsopen");
    }

    __onWSError(e) {
        // this.emit("wserror", e);
    }

    __onWSClose(e) {
        // this.emit("wsclose", e);
    }
}