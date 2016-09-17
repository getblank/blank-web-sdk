const WampClient = require("../lib/client/wamp").default;
const assert = require("assert");
const WS_PORT = 44189;

//Test server
var WebSocketServer = require("ws").Server
    , wss = new WebSocketServer({ port: WS_PORT });

wss.on("connection", function connection(ws) {
    ws.on("message", function incoming(message) {
        console.log("received: %s", message);
    });

    ws.send("something");
});
let client = new WampClient();
client.WebSocket = require("ws");

describe("wamp", function () {
    before(function (done) {
        client.onopen = () => {
            done();
        };
        client.connect(`ws://localhost:${WS_PORT}`);
    });
    after(function () {
        client.close();
    });

    describe("call", function () {
        it("should return promise when no callback passed", function () {
            let p = client.call("com.test");
            assert.equal(true, p instanceof Promise);
        });
    });
});