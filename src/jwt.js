export function decodeToken(token, options = {}) {
    if (typeof token !== "string") {
        throw new Error("token must be a string");
    }
    const pos = options.header === true ? 0 : 1;
    const base64Data = token.split(".")[pos];
    const encodedData = atob(base64Data).replace(/(.)/g, function (m, p) {
        var code = p.charCodeAt(0).toString(16).toUpperCase();
        if (code.length < 2) {
            code = "0" + code;
        }
        return "%" + code;
    });
    try {
        const stringData = decodeURIComponent(encodedData);
        const data = JSON.parse(stringData);
        return data;
    } catch (e) {
        throw new Error("invalid token specified: " + e.message);
    }
}

export function isTokenInvalid(token, serverUri = "") {
    return fetch(`${serverUri}/check-jwt`, {
        method: "POST",
        headers: {
            Authorization: token,
        },
    })
        .then(response => {
            if (response.status >= 200 && response.status < 300) {
                return response.json();
            }
        })
        .then(data => {
            if (data && data.valid === false) {
                return true;
            }
        });
}