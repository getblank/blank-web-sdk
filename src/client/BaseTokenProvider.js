import {decodeToken} from "../jwt";

export default class BaseTokenProvider {
    __isValidToken(token) {
        if (token) {
            try {
                const tokenInfo = decodeToken(token);
                if (tokenInfo.exp > Math.floor(Date.now() / 1000)) {
                    return true;
                }
            } catch (e) {
                return false;
            }
        }
        return false;
    }
}