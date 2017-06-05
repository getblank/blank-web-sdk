var WebpackDevServer = require("webpack-dev-server");
var webpack = require("webpack");
var path = require("path");
var url = require("url");
var express = require("express");
var exec = require("child_process").exec;
var chokidar = require("chokidar");
var bodyParser = require("body-parser");
var multer = require("multer");
var multipart = multer();

var config = {
    entry: [
        "whatwg-fetch",
        "./test/BlankClientTest.js",
    ],
    output: {
        path: path.resolve("./test/build"),
        filename: "tests.js",
    },
    module: {
        loaders: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                loader: "babel-loader",
            },
        ],
    },
};

var watcher = chokidar.watch("./src/", {
    ignored: /[\/\\]\./,
    persistent: true,
    ignoreInitial: true,
});
watcher.on("all", function () {
    exec("./node_modules/.bin/babel src --out-dir lib", (e) => {
        console.log(`Babel ${e ? "error:" + e : "done"}`);
    });
    exec("./node_modules/.bin/babel src --out-dir ../blank-web-app/node_modules/blank-web-sdk/lib", (e) => {
        console.log(`Babel 2 ${e ? "error:" + e : "done"}`);
    });
    exec("./node_modules/.bin/babel src --out-dir ../bf-config/hugo/src/node_modules/blank-web-sdk/lib", (e) => {
        console.log(`Babel 2 ${e ? "error:" + e : "done"}`);
    });
});

var compiler = webpack(config);
var server = new WebpackDevServer(compiler, {
    contentBase: config.output.path,
    compress: true,
    publicPath: "/",
    stats: { colors: true },
    setup: function (app) {
        app.use(bodyParser.urlencoded({ extended: true }));
        app.post("/login", multipart.array(), signIn);
    },
});
server.listen(8081, "localhost", function () { });

var crossOriginServer = require("http").createServer();
var WebSocketServer = require("ws").Server;
var wss = new WebSocketServer({ server: crossOriginServer });
var crossOriginApp = express();
crossOriginApp.get("/sso-frame", function (req, res) {
    res.send(getFrameHtml());
});
crossOriginApp.post("/login", multipart.array(), signIn);
crossOriginApp.get("/check-jwt", (req, res) => {
    console.log("TOKEN:", req.get("Authorization"));
    res.json({ valid: false });
});
crossOriginServer.on("request", crossOriginApp);
const crossOriginPort = 8085;
crossOriginServer.listen(crossOriginPort, function () {
    console.log(`crossOriginServer listening on port ${crossOriginPort}`);
});

function getFrameHtml(origin = "http://localhost:8081") {
    return `<!DOCTYPE html>
<html lang="en">
    <head>
        <script type="text/javascript">
            var src, origin, allowed = ["${origin}"];
            function receiveMessage(event) {
                if (allowed.indexOf(event.origin) < 0) { return; }
                if (event.data === "remove") {
                    localStorage.removeItem("tempKey");
                    return;
                }
                src = event.source;
                origin = event.origin;
                src.postMessage(localStorage.getItem("tempKey"), origin);
            }
            window.addEventListener("message", receiveMessage, false);
            var k = localStorage.getItem("tempKey");
            window.setInterval(function () {
                var _k = localStorage.getItem("tempKey");
                if (_k !== k && src && origin) {
                    k = _k;
                    src.postMessage(localStorage.getItem("tempKey"), origin);
                }
            }, 3000);
        </script>
    </head>
    <body></body>
</html>`;
}

function signIn(req, res) {
    if (req.body.password === "ok") {
        res.set("Access-Control-Allow-Origin", "*");
        res.json({
            "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE0NzUwNDA0NTEsImlhdCI6MTQ3NDk1NDA1MSwiaXNzIjoiQmxhbmsgbHRkIiwic2Vzc2lvbklkIjoiMzA4NDVhN2EtY2FkOS00OWUxLWI3NmYtZGQ3NWFkZTRlNzQwIiwidXNlcklkIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAwIn0.XUFKa-eZKDmDBUeUtayADJyDZXweg9sgIvR9NBgg42W4OmNWk1cgOKA4FDqT68si8fkyoS90cPP0NcEh_U-AzhYJRKq7F_vb2uMSOUGoZk0We0gE5X-FHw-NqwHW8EMYgBekkp4kLozBkPV2DADtGnGlr6BanLrZjetiJ-ky_aa2otQPI84vnQy6NjrKIq5q4MVxk2_AdlSjIFUtkSm0-EDP2QNIgXOjeHd8Mxu7UWnuVYcDEhw4FK13ofxNoq2szAfy76DcABoplCU_QmHt-E39VJL6ZKwMnzMgwZg8N7znTlc4myyRPuee_yduO38xYvXgxmC0cbgOZ6qSO2AnVQ",
            "user": {
                "__v": 11,
                "_id": "00000000-0000-0000-0000-000000000000",
                "_ownerId": "system",
                "createdAt": "2016-08-29T10:51:54.541Z",
                "createdBy": "system",
                "isActive": true,
                "lang": "ru",
                "login": "root",
                "profileId": "1e01b474-3023-4f5e-bdeb-3092613c80d7",
                "roles": ["root"],
                "updatedAt": "2016-09-17T16:42:20.557Z",
                "updatedBy": "00000000-0000-0000-0000-000000000000",
                "workspace": "adminWorkspace",
            },
        });
    } else {
        res.status(303).json("User not found");
    }
}
