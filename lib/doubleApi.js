"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (cb) {
    if (typeof cb !== "function") {
        var promise = new Promise(function (f, r) {
            cb = function cb(e, d) {
                return e != null ? r(e) : f(d);
            };
        });
        return { promise: promise, cb: cb };
    } else {
        return { promise: null, cb: cb };
    }
};