import _WSClient from "./client/WSClient";
import {decode} from "./jwt";

export const WSClient = _WSClient;
export const DecodeJWT = decode;