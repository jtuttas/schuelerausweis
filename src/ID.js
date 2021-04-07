"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var https_1 = require("https");
var iconv_lite_1 = __importDefault(require("iconv-lite"));
var ID = /** @class */ (function () {
    function ID(json) {
        var obj = JSON.parse(json);
        this.bpid = obj.bpid;
        this.did = obj.did;
        this.gd = obj.gd;
        this.kl = obj.kl;
        this.nn = obj.nn;
        this.v = obj.v;
        this.vn = obj.vn;
    }
    ID.prototype.getStudent = function (key) {
        console.log("get Student id " + this.did);
        var options = {
            hostname: 'diklabu.mm-bbs.de',
            port: 8080,
            path: "/Diklabu/api/v1/schueler/" + this.did,
            method: 'GET',
            headers: {
                'content-type': 'application/json;charset=iso-8859-1',
                'auth_token': key
            }
        };
        return new Promise(function (resolve, reject) {
            https_1.request(options, function (res) {
                if (res.statusCode == 204) {
                    resolve(JSON.parse("{}"));
                }
                res.on('data', function (d) {
                    var buffer = Buffer.from(d);
                    var str = iconv_lite_1.default.decode(buffer, 'iso-8859-1');
                    console.log("data:" + str);
                    var obj = JSON.parse(str);
                    resolve(JSON.parse(str));
                });
                res.on('error', function (err) {
                    console.log("err:" + err);
                    reject(err);
                });
            }).end();
        });
    };
    return ID;
}());
exports.ID = ID;
/*
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
let id: ID = new ID("{}");
id.did = 7960
id.getStudent("c6ef540c-84d1-4f3f-87a1-088241519c3f").then((s: Student) => {
    console.log("Result Betrieb" + s.betrieb.NAME);
}).catch(err => {
    console.log("Error: " + err);

});
*/
//# sourceMappingURL=ID.js.map