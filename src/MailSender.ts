
import * as nodemailer from "nodemailer"
import * as fs from "fs"
import config from '../config/config.json';
import { MailObject } from "./MailObject";
import StreamTransport from "nodemailer/lib/stream-transport";
import SMTPTransport from "nodemailer/lib/smtp-transport";

export class MailSender {

    public static transporter: nodemailer.Transporter;

    constructor() {
        console.log("SMTP Config:" + JSON.stringify(config.mailer));
        var opt: SMTPTransport.Options = config.mailer;

        opt.tls = {
            minVersion: "TLSv1",
            ciphers: "HIGH:MEDIUM:!aNULL:!eNULL:@STRENGTH:!DH:!kEDH"
        }
        MailSender.transporter = nodemailer.createTransport(opt
        );
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
            } else {
                console.log("SMTP Server is ready to take our messages");
            }
        });
    }

    public sendMail(mo: MailObject): Promise<any> {
        return new Promise(function (resolve, reject) {
            console.log("sendMail: " + JSON.stringify(mo));
            let options: nodemailer.SendMailOptions = new Object();
            options.from = mo.from;
            options.to = mo.to;
            options.replyTo = mo.from;
            options.subject = mo.subject
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
        })
    }
}




/*
let m:Mail = new Mail("itsprechtag");
m.sendMail("tuttas@mmbbs.de",(info)=> {
    console.log(JSON.stringify(info));
});
*/
