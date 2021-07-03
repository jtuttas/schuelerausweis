import { DBManager } from "./DBManager";
import { v4 } from 'uuid';
import request from "request";
import express = require('express');
import PDFDocument = require('pdfkit');
import qrImage from "qr-image";
import { Database } from "sqlite3";
import { createPass, Pass } from "passkit-generator";


export class Event {
    name: string;
    vorname: string;
    email: string;
    eventName: string;
    type: string;
    webhook: string;
    success: boolean;
    msg: string;
    uuid: string;
    registered: Date;
    arrival: Date;
    eventDate: Date;
    webhookStatus: number;
    webhookErrormessage: string;
    webhookBody: string;


    constructor()
    constructor(name: string, vorname: string, email: string)
    constructor(name?: string, vorname?: string, email?: string) {
        this.name = name;
        this.vorname = vorname;
        this.email = email;
        this.uuid = v4();
    }

    public arrived(dbm: DBManager): void {
        dbm.updateEvent(this).then((value: Event) => {

        }).catch(err => {
            console.log("arrived Error:" + err);

        })
    }

    public fireWebhook(): Promise<Event> {
        return new Promise((resolve, reject) => {
            let that: Event = this;
            console.log("Sende Webhook....:" + this.webhook);
            console.log("Sende Body....:" + JSON.stringify(this));
            request.post(
                this.webhook,
                { json: this },
                function (error, response, body) {
                    if (error) {
                        console.log("Webhook error:" + error);
                        that.webhookStatus = 404;
                        that.webhookErrormessage = error;
                        that.success = false;
                        reject(that)
                    }
                    else {
                        console.log("Webhook result:" + response.statusCode);
                        that.webhookStatus = response.statusCode;
                        that.success = true;
                        //this.webhookBody = body;
                        //console.log(body);
                        resolve(that);
                    }
                });
        });
    }

    public async toWallet(res: express.Response) {
        const examplePass = await createPass({
            model: "./event.pass",
            certificates: {
                wwdr: "./config/AppleWWDRCA.pem",
                signerCert: "./config/signerCert.pem",
                signerKey: {
                    keyFile: "./config/passkey.pem",
                    passphrase: "123456"
                }
            },
            overrides: {
                // keys to be added or overridden
                serialNumber: "AAGH44625236dddaffbda"
            }
        });

        // Adding some settings to be written inside pass.json
        //examplePass.barcode("Test"); 
        examplePass.barcodes({
            message: "uuid=" + this.uuid,
            format: "PKBarcodeFormatQR",
            altText: "Check in",
            messageEncoding: "iso-8859-1"
        });

        examplePass.headerFields.map(item => {
            this.repaceValues(item);
        });
        examplePass.primaryFields.map(item => {
            this.repaceValues(item);
        });
        examplePass.secondaryFields.map(item => {
            this.repaceValues(item);
        });
        examplePass.auxiliaryFields.map(item => {
            this.repaceValues(item);
        });
        const stream = examplePass.generate();
        stream.pipe(res);
    }

    private repaceValues(item) {
        if (item.key == "name") {
            console.log("Found Name and set it to " + this.name);
            item.value = this.name;
        }
        if (item.key == "surname") {
            console.log("Found Surname and set it to " + this.vorname);
            item.value = this.vorname;
        }
        if (item.key == "eventName") {
            if (this.eventName && this.eventName != "undefined") {
                console.log("Found eventName and set it to " + this.eventName);
                item.value = this.eventName;
            }
        }
        if (item.key == "eventDate") {
            if (this.eventDate) {
                console.log("Found eventDate and set it to " + this.eventDate);
                item.value = this.eventDate;
            }
        }
        if (item.key == "registered") {
            console.log("Found registered and set it to " + this.registered);
            item.value = this.registered.getTime.toString();
        }

    }



    public toPDF(): PDFKit.PDFDocument {
        var doc = new PDFDocument({
            size: "A4",
            autoFirstPage: true,
            margin: 25
        });
        try {
            let img = qrImage.imageSync("uuid=" + this.uuid, { type: 'png', size: 3 });
            doc.image(img, 160, 90, { width: 80 })

        }
        catch (err) {
            console.log("Exception:" + err);
        }

        doc.image('web/img/ms-icon-70x70.png', 22, 22, { width: 30 });
        doc.font('Helvetica-Bold').fontSize(16);
        doc.text("Event Ticket", 60, 22);
        if (this.eventName && this.eventName != "undefined") {
            doc.text(this.eventName, 25, 60);
        }
        doc.font('Helvetica-Bold').fontSize(6);
        doc.text("Multi-Media Berufsbildende Schulen, Expo Plaza 3", 60, 38);
        doc.text("30539 Hannover, Tel.: 0511/64 61 98-11", 60, 44);
        doc.font('Helvetica-Bold').fontSize(8);
        doc.text("Name:", 25, 100);
        doc.text("Vorname:", 25, 122);
        doc.text("Registriert:", 25, 144);
        doc.font('Helvetica').fontSize(8).fillColor("0x888888");
        doc.text(this.name, 29, 110);
        doc.text(this.vorname, 29, 132);
        doc.text(this.registered.toString(), 29, 154);
        
        if (this.eventDate) {
            console.log("eventDate="+this.eventDate);            
            doc.text(""+this.eventDate,30,80);
        }
        
        doc.roundedRect(20, 20, 240, 152, 5);
        doc.stroke();

        doc.end();
        console.log("PDF erzeugt");

        return doc;

    }

}
/**
 * Ein event Ticket als wallet!
 */
export function genWalletTicket(req: express.Request, res: express.Response) {
    console.log("Gen Wallet");
    let result: any = {};
    if (req.query.uuid) {
        let dbm: DBManager = new DBManager();
        let event: Event = new Event();
        dbm.getEvent(req.query.uuid.toString()).then((e: Event) => {
            event.name = e.name;
            event.vorname = e.vorname;
            event.email = e.email;
            event.eventName = e.eventName;
            event.eventDate = e.eventDate;
            event.registered = e.registered;
            event.uuid = e.uuid

            res.set({
                "Content-type": "application/vnd.apple.pkpass",
                "Content-disposition": `attachment; filename=mmbbsevent.pkpass`,
            });
            event.toWallet(res);
        }).catch(err => {
            res.set({
                "Content-type": "application/json",
            });
            result.success = false;
            result.msg = err;
            res.send(JSON.stringify(result));
        })
    }
    else {
        res.statusCode = 400;
        result.msg = "missing uuid Parameter";
        res.send(JSON.stringify(result));
    }
}


/**
 * Ein event Ticket als pdf!
 */
export function genPDFTicket(req: express.Request, res: express.Response) {
    console.log("Gen PDF");
    let result: any = {};
    if (req.query.uuid) {
        let dbm: DBManager = new DBManager();
        let event: Event = new Event();
        dbm.getEvent(req.query.uuid.toString()).then((e: Event) => {
            event.name = e.name;
            event.vorname = e.vorname;
            event.email = e.email;
            event.eventName = e.eventName;
            event.eventDate = e.eventDate;
            event.registered = e.registered;
            event.uuid = e.uuid
            res.set({
                "Content-type": "application/pdf",
                "Content-disposition": `attachment; filename=ticket.pdf`,
            });
            event.toPDF().pipe(res);
        }).catch(err => {
            res.set({
                "Content-type": "application/json",
            });
            result.success = false;
            result.msg = err;
            res.send(JSON.stringify(result));
        })
    }
    else {
        res.statusCode = 400;
        result.msg = "missing uuid Parameter";
        res.send(JSON.stringify(result));
    }
}

/**
 * Anlegen eines Eventeintrages und ggf. Senden des Webhooks
 */
export function handlePut(req: express.Request, res: express.Response) {
    res.setHeader("content-type", "application/json");
    let result: any = {};
    if (req.query.uuid) {
        let dbm: DBManager = new DBManager();
        let e: Event = new Event();
        e.uuid = req.query.uuid.toString();
        dbm.updateEvent(e).then((ev: Event) => {
            dbm.getEvent(e.uuid).then((ev2: Event) => {
                if (ev2 != null) {
                    e.name = ev2.name;
                    e.vorname = ev2.vorname;
                    e.email = ev2.email;
                    e.eventName = ev2.eventName;
                    e.eventDate = ev2.eventDate;
                    e.registered = ev2.registered;
                    e.arrival = ev2.arrival;
                    e.webhook = ev2.webhook;

                    if (ev2.webhook) {
                        e.type = "arrival";
                        e.fireWebhook().then((ev3: Event) => {
                            res.statusCode = 200;
                            res.send(JSON.stringify(ev3));
                        }).catch(err => {
                            e.success = false;
                            e.msg = err;
                            res.statusCode = 500;
                            res.send(JSON.stringify(e));
                        })
                    }
                    else {
                        res.statusCode = 200;
                        res.send(JSON.stringify(e));
                    }
                }
                else {
                    res.statusCode = 404;
                    res.send(JSON.stringify(ev2));

                }
            }).catch(err => {
                res.statusCode = 500;
                result.msg = "SELECT Failed:" + err;
                res.send(JSON.stringify(result));
            });
        }).catch(err => {
            res.statusCode = 500;
            result.msg = "UPDATE Failed:" + err;
            res.send(JSON.stringify(result));
        })
    }
    else {
        res.statusCode = 400;
        result.msg = "missing uuid Parameter";
        res.send(JSON.stringify(result));
    }
}




/**
 * Anlegen eines Eventeintrages und ggf. Senden des Webhooks
 */
export function handleGet(req: express.Request, res: express.Response) {
    res.setHeader("content-type", "application/json");
    let result: any = {};
    if (req.query.uuid) {
        let dbm: DBManager = new DBManager();
        dbm.getEvent(req.query.uuid.toString()).then((e: Event) => {
            if (e == null) {
                res.statusCode = 404;
            }
            else {
                res.statusCode = 200;
            }
            res.send(JSON.stringify(e));
        }).catch(err => {
            res.statusCode = 500;
            result.msg = "SELECT Failed:" + err;
            res.send(JSON.stringify(result));
        })
    }
    else {
        res.statusCode = 400;
        result.msg = "missing uuid Parameter";
        res.send(JSON.stringify(result));
    }
};

/**
 * Anlegen eines Eventeintrages und ggf. Senden des Webhooks
 */
export function handlePost(req: express.Request, res: express.Response) {
    res.setHeader("content-type", "application/json");
    console.log("body:" + JSON.stringify(req.body));
    let event: Event = new Event();
    event.name = req.body.name
    event.vorname = req.body.vorname
    event.email = req.body.email
    event.eventName = req.body.eventName
    event.eventDate = req.body.eventDate
    event.webhook = req.body.webhook

    req.body;

    if (req.body.name == undefined || req.body.vorname == undefined || req.body.email == undefined || req.body.name == "" || req.body.vorname == "" || req.body.email == "") {
        event.success = false;
        event.msg = "Pflichtattribute name,vorname oder email fehlt!";
        res.statusCode = 400;
        res.send(JSON.stringify(event));
        return;

    }
    event.uuid = v4();
    console.log("UUID=" + event.uuid);
    let dbm: DBManager = new DBManager();
    dbm.readEvent(event.name, event.vorname, event.email, event.eventName).then((v: Event) => {
        console.log("gelesen:" + JSON.stringify(v));
        if (v == null) {
            dbm.setEvent(event).then((v1: Event) => {
                console.log("Event eingetragen: " + JSON.stringify(v1));
                if (event.webhook) {
                    console.log("Webhook ausführen");
                    event.type = "registration"
                    event.fireWebhook().then((v2: Event) => {
                        console.log("Webhook erfolgreich:" + JSON.stringify(v2));
                        res.send(JSON.stringify(v2));
                    }).catch(err => {
                        console.log("Webhook fehlgeschlagen:" + err);
                        event.success = false;
                        event.msg = JSON.stringify(err);
                        res.send(JSON.stringify(event));
                    })
                }
                else {
                    res.send(JSON.stringify(v1));
                }
            }).catch(err => {
                event.success = false;
                event.msg = err;
                res.send(JSON.stringify(event));
            })
        }
        else {
            console.log("Datensatz existiert bereits");

            res.send(JSON.stringify(v));
        }
    }).catch(err => {
        console.log("Fehler:" + err);
        res.send(JSON.stringify(event));

    })

}