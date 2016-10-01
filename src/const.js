export const TOKEN_LS_KEY = "blank-access-token";
export const CLIENT_STATES = Enum("authorization", "unauthorized", "ready", "wsConnecting", "wsReady");

function Enum() {
    let res = {};
    for (let i = 0; i < arguments.length; i++) {
        res[arguments[i]] = arguments[i];
    }
    return res;
}