"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailSender = void 0;
const nodemailer = __importStar(require("nodemailer"));
const config_json_1 = __importDefault(require("../config/config.json"));
class MailSender {
    constructor() {
        console.log("SMTP Config:" + JSON.stringify(config_json_1.default.mailer));
        var opt = config_json_1.default.mailer;
        opt.tls = {
            minVersion: "TLSv1",
            ciphers: "HIGH:MEDIUM:!aNULL:!eNULL:@STRENGTH:!DH:!kEDH"
        };
        MailSender.transporter = nodemailer.createTransport(opt);
        /*
        this.transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: config.emailUser,
                pass: config.emailPassword
            }
        });
        */
        MailSender.transporter.verify(function (error, success) {
            if (error) {
                console.log(error);
            }
            else {
                console.log("SMTP Server is ready to take our messages");
            }
        });
    }
    sendMail(mo) {
        return new Promise(function (resolve, reject) {
            console.log("sendMail: " + JSON.stringify(mo));
            let options = new Object();
            options.from = mo.from;
            options.to = mo.to;
            options.replyTo = mo.from;
            options.subject = mo.subject;
            options.text = mo.text;
            MailSender.transporter.sendMail(options, (err, info) => {
                if (err) {
                    console.log("FEHLER:" + JSON.stringify(err));
                    reject({ msg: "Fehler beim senden der Email an " + mo.to, success: false });
                }
                else {
                    console.log("INFO:" + JSON.stringify(info));
                    resolve({ msg: "EMail gesendet an " + mo.to, success: true });
                }
            });
        });
    }
}
exports.MailSender = MailSender;
/*
let m:Mail = new Mail("itsprechtag");
m.sendMail("tuttas@mmbbs.de",(info)=> {
    console.log(JSON.stringify(info));
});
*/
//# sourceMappingURL=MailSender.js.map