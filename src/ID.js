"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ID = void 0;
const https_1 = require("https");
const iconv_lite_1 = __importDefault(require("iconv-lite"));
class ID {
    constructor(json) {
        let obj = JSON.parse(json);
        this.bpid = obj.bpid;
        this.did = obj.did;
        this.gd = obj.gd;
        this.kl = obj.kl;
        this.nn = obj.nn;
        this.v = obj.v;
        this.vn = obj.vn;
    }
    getStudent(key) {
        console.log("get Student id " + this.did);
        let options = {
            hostname: 'diklabu.mm-bbs.de',
            port: 8080,
            path: "/Diklabu/api/v1/schueler/" + this.did,
            method: 'GET',
            headers: {
                'content-type': 'application/json;charset=iso-8859-1',
                'auth_token': key
            }
        };
        return new Promise((resolve, reject) => {
            (0, https_1.request)(options, (res) => {
                if (res.statusCode == 204) {
                    resolve(JSON.parse("{}"));
                }
                res.on('data', d => {
                    var buffer = Buffer.from(d);
                    var str = iconv_lite_1.default.decode(buffer, 'iso-8859-1');
                    console.log("data:" + str);
                    try {
                        resolve(JSON.parse(str));
                    }
                    catch (_a) {
                        resolve(JSON.parse("{}"));
                    }
                });
                res.on('error', err => {
                    console.log("err:" + err);
                    reject(err);
                });
            }).end();
        });
    }
}
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