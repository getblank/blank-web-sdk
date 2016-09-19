export default function (cb) {
    if (typeof cb !== "function") {
        const promise = new Promise((f, r) => {
            cb = (e, d) => (setImmediate || setTimeout)(() => {
                e != null ? r(e) : f(d);
            });
        });
        return { promise, cb };
    } else {
        return { promise: null, cb };
    }
}