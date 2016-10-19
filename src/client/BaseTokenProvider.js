import { decodeToken } from "../jwt";
import EventEmitter from "../utils/events";

export default class BaseTokenProvider extends EventEmitter {
    constructor() {
        super();
    }

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