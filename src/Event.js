"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePost = exports.handleGet = exports.handlePut = exports.genPDFTicket = exports.genWalletTicket = exports.Event = void 0;
const DBManager_1 = require("./DBManager");
const uuid_1 = require("uuid");
const request_1 = __importDefault(require("request"));
const PDFDocument = require("pdfkit");
const qr_image_1 = __importDefault(require("qr-image"));
const passkit_generator_1 = require("passkit-generator");
class Event {
    constructor(name, vorname, email) {
        this.name = name;
        this.vorname = vorname;
        this.email = email;
        this.uuid = (0, uuid_1.v4)();
    }
    arrived(dbm) {
        dbm.updateEvent(this).then((value) => {
        }).catch(err => {
            console.log("arrived Error:" + err);
        });
    }
    fireWebhook() {
        return new Promise((resolve, reject) => {
            let that = this;
            console.log("Sende Webhook....:" + this.webhook);
            console.log("Sende Body....:" + JSON.stringify(this));
            request_1.default.post(this.webhook, { json: this }, function (error, response, body) {
                if (error) {
                    console.log("Webhook error:" + error);
                    that.webhookStatus = 404;
                    that.webhookErrormessage = error;
                    that.success = false;
                    reject(that);
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
    toWallet(res) {
        return __awaiter(this, void 0, void 0, function* () {
            const examplePass = yield (0, passkit_generator_1.createPass)({
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
            if (this.eventDate) {
                examplePass.relevantDate(this.eventDate);
            }
            const stream = examplePass.generate();
            stream.pipe(res);
        });
    }
    repaceValues(item) {
        if (item.key == "Name") {
            console.log("Found Name and set it to " + this.name);
            item.value = this.name;
        }
        if (item.key == "Vorname") {
            console.log("Found Surname and set it to " + this.vorname);
            item.value = this.vorname;
        }
        if (item.key == "event") {
            if (this.eventName && this.eventName != "undefined") {
                console.log("Found eventName and set it to " + this.eventName);
                item.value = this.eventName;
            }
        }
        if (item.key == "Date") {
            if (this.eventDate) {
                console.log("Found eventDate and set it to " + this.eventDate);
                item.value = this.eventDate.getDate() + "." + (this.eventDate.getMonth() + 1) + "." + this.eventDate.getFullYear() + " " + this.eventDate.getHours() + ":" + this.eventDate.getMinutes();
            }
        }
        if (item.key == "registered") {
            console.log("Found registered and set it to " + this.registered);
            item.value = this.registered.getDate() + "." + (this.registered.getMonth() + 1) + "." + this.registered.getFullYear() + " " + this.registered.getHours() + ":" + this.registered.getMinutes();
        }
    }
    toPDF() {
        var doc = new PDFDocument({
            size: "A4",
            autoFirstPage: true,
            margin: 25
        });
        try {
            let img = qr_image_1.default.imageSync("uuid=" + this.uuid, { type: 'png', size: 3 });
            doc.image(img, 160, 90, { width: 80 });
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
        doc.text(this.registered.getDate() + "." + (this.registered.getMonth() + 1) + "," + this.registered.getFullYear() + " " + this.registered.getHours() + ":" + this.registered.getMinutes(), 29, 154);
        if (this.eventDate) {
            console.log("eventDate=" + this.eventDate);
            doc.text(this.eventDate.getDate() + "." + (this.eventDate.getMonth() + 1) + "." + this.eventDate.getFullYear() + " um " + this.eventDate.getHours() + ":" + this.eventDate.getMinutes(), 30, 80);
        }
        doc.roundedRect(20, 20, 240, 152, 5);
        doc.stroke();
        doc.end();
        console.log("PDF erzeugt");
        return doc;
    }
}
exports.Event = Event;
/**
 * Ein event Ticket als wallet!
 */
function genWalletTicket(req, res) {
    console.log("Gen Wallet");
    let result = {};
    if (req.query.uuid) {
        let dbm = new DBManager_1.DBManager();
        let event = new Event();
        dbm.getEvent(req.query.uuid.toString()).then((e) => {
            event.name = e.name;
            event.vorname = e.vorname;
            event.email = e.email;
            event.eventName = e.eventName;
            event.eventDate = e.eventDate;
            event.registered = e.registered;
            event.uuid = e.uuid;
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
        });
    }
    else {
        res.statusCode = 400;
        result.msg = "missing uuid Parameter";
        res.send(JSON.stringify(result));
    }
}
exports.genWalletTicket = genWalletTicket;
/**
 * Ein event Ticket als pdf!
 */
function genPDFTicket(req, res) {
    console.log("Gen PDF");
    let result = {};
    if (req.query.uuid) {
        let dbm = new DBManager_1.DBManager();
        let event = new Event();
        dbm.getEvent(req.query.uuid.toString()).then((e) => {
            event.name = e.name;
            event.vorname = e.vorname;
            event.email = e.email;
            event.eventName = e.eventName;
            event.eventDate = e.eventDate;
            event.registered = e.registered;
            event.uuid = e.uuid;
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
        });
    }
    else {
        res.statusCode = 400;
        result.msg = "missing uuid Parameter";
        res.send(JSON.stringify(result));
    }
}
exports.genPDFTicket = genPDFTicket;
/**
 * Anlegen eines Eventeintrages und ggf. Senden des Webhooks
 */
function handlePut(req, res) {
    res.setHeader("content-type", "application/json");
    let result = {};
    if (req.query.uuid) {
        let dbm = new DBManager_1.DBManager();
        let e = new Event();
        e.uuid = req.query.uuid.toString();
        dbm.updateEvent(e).then((ev) => {
            dbm.getEvent(e.uuid).then((ev2) => {
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
                        e.fireWebhook().then((ev3) => {
                            res.statusCode = 200;
                            res.send(JSON.stringify(ev3));
                        }).catch(err => {
                            e.success = false;
                            e.msg = err;
                            res.statusCode = 500;
                            res.send(JSON.stringify(e));
                        });
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
        });
    }
    else {
        res.statusCode = 400;
        result.msg = "missing uuid Parameter";
        res.send(JSON.stringify(result));
    }
}
exports.handlePut = handlePut;
/**
 * Anlegen eines Eventeintrages und ggf. Senden des Webhooks
 */
function handleGet(req, res) {
    res.setHeader("content-type", "application/json");
    let result = {};
    if (req.query.uuid) {
        let dbm = new DBManager_1.DBManager();
        dbm.getEvent(req.query.uuid.toString()).then((e) => {
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
        });
    }
    else {
        res.statusCode = 400;
        result.msg = "missing uuid Parameter";
        res.send(JSON.stringify(result));
    }
}
exports.handleGet = handleGet;
;
/**
 * Anlegen eines Eventeintrages und ggf. Senden des Webhooks
 */
function handlePost(req, res) {
    res.setHeader("content-type", "application/json");
    console.log("body:" + JSON.stringify(req.body));
    let event = new Event();
    event.name = req.body.name;
    event.vorname = req.body.vorname;
    event.email = req.body.email;
    event.eventName = req.body.eventName;
    event.eventDate = req.body.eventDate;
    event.webhook = req.body.webhook;
    req.body;
    if (req.body.name == undefined || req.body.vorname == undefined || req.body.email == undefined || req.body.name == "" || req.body.vorname == "" || req.body.email == "") {
        event.success = false;
        event.msg = "Pflichtattribute name,vorname oder email fehlt!";
        res.statusCode = 400;
        res.send(JSON.stringify(event));
        return;
    }
    event.uuid = (0, uuid_1.v4)();
    console.log("UUID=" + event.uuid);
    let dbm = new DBManager_1.DBManager();
    dbm.readEvent(event.name, event.vorname, event.email, event.eventName).then((v) => {
        console.log("gelesen:" + JSON.stringify(v));
        if (v == null) {
            dbm.setEvent(event).then((v1) => {
                console.log("Event eingetragen: " + JSON.stringify(v1));
                if (event.webhook) {
                    console.log("Webhook ausführen");
                    event.type = "registration";
                    event.fireWebhook().then((v2) => {
                        console.log("Webhook erfolgreich:" + JSON.stringify(v2));
                        res.send(JSON.stringify(v2));
                    }).catch(err => {
                        console.log("Webhook fehlgeschlagen:" + err);
                        event.success = false;
                        event.msg = JSON.stringify(err);
                        res.send(JSON.stringify(event));
                    });
                }
                else {
                    res.send(JSON.stringify(v1));
                }
            }).catch(err => {
                event.success = false;
                event.msg = err;
                res.send(JSON.stringify(event));
            });
        }
        else {
            console.log("Datensatz existiert bereits");
            res.send(JSON.stringify(v));
        }
    }).catch(err => {
        console.log("Fehler:" + err);
        res.send(JSON.stringify(event));
    });
}
exports.handlePost = handlePost;
//# sourceMappingURL=Event.js.map