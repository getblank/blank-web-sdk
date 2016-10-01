const BlankClient = require("../lib/client/BlankClient").default;
const CLIENT_STATES = require("../lib/const").CLIENT_STATES;
const TOKEN_LS_KEY = require("../lib/const").TOKEN_LS_KEY;
const VALID_TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk0NzUwNDA0NTEsImlhdCI6MTQ3NDk1NDA1MSwiaXNzIjoiQmxhbmsgbHRkIiwic2Vzc2lvbklkIjoiMzA4NDVhN2EtY2FkOS00OWUxLWI3NmYtZGQ3NWFkZTRlNzQwIiwidXNlcklkIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAwIn0.HqfE3utSG9T0x0eVkvkwzW-5T3Sa7ucIaO0fNWs3V__TvQD4Z0BGvoSsaRATJaZ04s2hnqJ-JsCaPqWqAA62O_x_Cm8Woq6dKsNMqVsOtrkdkhoGh6LuhqPfsv0Hok5u-aBupFPVLfUbdljugQvaknalxROnUhHGnWs1ml6sCVYg3dAA29PrLyn9kKWOEEiD6lOyNjghJiHPIMjj8pZtzP2xABMTfyff3Co4YZQUI187ucdMgKqcR2_OHRFBnFn3K47NQHVo4isv4hVKLSsa3XFnJxWzUxKcoUuw-r1m7GvqcHS3_i1Jl8_Kzu-yWrrrlfFMAxlwtdtLgaeMQKYPUg";
const EXPIRED_TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjQ3NTA0MDQ1MSwiaWF0IjoxNDc0OTU0MDUxLCJpc3MiOiJCbGFuayBsdGQiLCJzZXNzaW9uSWQiOiIzMDg0NWE3YS1jYWQ5LTQ5ZTEtYjc2Zi1kZDc1YWRlNGU3NDAiLCJ1c2VySWQiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAifQ.m8sgxo3mn9ZtAFGDWLbR9ZCsKLGX2FinEgPD2lxnMTQWfotmDRPSw4Tp3TFGUNMrwSGJ-1zd3Qjt6kKtOzkaIEg_qB0JaIUR7SIDE00IZdFbd5_FgF8TGLQi1uXrl_UblFKPqmu5jYNJPacd_LGDGqngQ-Zff1BsgqZqTM-RsaUHFRaZ7x4bVVHYASN-elkGKeSczVcqzQ8FboeFpT8mmAVL4R8CFZi03iTFhUQBCMeE7oUkrDoNKJVbhr_SNWJVXd4xtHQ0obOBpgW3lmlmaE9R1tZNLJs0aC7Ju1MAqY_itW1w34ivbWVKvjhXKbnhO5p3vd2lPs0Yi5c_-aEzCw";
const assert = require("assert");

describe("BlankClient", function () {
    before(function () {

    });
    after(function () {

    });

    // it("should properly connect using this API", function () {
    //     const client = new BlankClient();
    //     client.on("stateDidChange", (state, prevState) => {

    //     });
    //     client.init()
    //         .then(state => {
    //             if (state !== "online") {
    //                 return
    //             }
    //         });
    // });

    describe("constructor", function () {
        beforeEach(function () {
            localStorage.clear();
        });
        it("should create client in 'authorization' state", function () {
            const client = new BlankClient();
            assert.equal(CLIENT_STATES.authorization, client.state);
        });
        it("should switch to 'unauthorized' state after creation when no token", function (done) {
            let k = 0;
            const sameOriginClient = new BlankClient();
            sameOriginClient.on("init", function () {
                assert.equal(sameOriginClient.state, CLIENT_STATES.unauthorized);
                k++;
                if (k === 2) { done(); }
            });
            const crossOriginClient = new BlankClient("http://localhost:8085");
            crossOriginClient.on("init", function () {
                assert.equal(crossOriginClient.state, CLIENT_STATES.unauthorized);
                k++;
                if (k === 2) { done(); }
            });
        });
    });
    describe("signIn", function () {
        beforeEach(function () {
            localStorage.clear();
        });
        it("should switch client state to 'wsConnecting' if success", function (done) {
            const client = new BlankClient();
            client.on("init", () => {
                assert.equal(client.state, CLIENT_STATES.unauthorized);
                client.signIn("test", "ok").then(res => {
                    assert.equal(client.state, CLIENT_STATES.wsConnecting);
                    done();
                });
            });
        });
        it("should switch client state to 'signedIn' if success and ws turned off", function (done) {
            const client = new BlankClient("", false);
            client.on("init", () => {
                assert.equal(client.state, CLIENT_STATES.unauthorized);
                client.signIn("test", "ok").then(res => {
                    assert.equal(client.state, CLIENT_STATES.ready);
                    done();
                });
            });
        });
        it("should switch client state to 'unauthorized' if failure", function (done) {
            const client = new BlankClient();
            client.on("init", () => {
                assert.equal(CLIENT_STATES.unauthorized, client.state);
                client.signIn("test", "fail").then(res => {
                }, err => {
                    assert.equal(CLIENT_STATES.unauthorized, client.state);
                    done();
                });
            });
        });
    });
});