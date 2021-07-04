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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePost = exports.handleGet = exports.handlePut = exports.genPDFTicket = exports.genWalletTicket = exports.Event = void 0;
var DBManager_1 = require("./DBManager");
var uuid_1 = require("uuid");
var request_1 = __importDefault(require("request"));
var PDFDocument = require("pdfkit");
var qr_image_1 = __importDefault(require("qr-image"));
var passkit_generator_1 = require("passkit-generator");
var Event = /** @class */ (function () {
    function Event(name, vorname, email) {
        this.name = name;
        this.vorname = vorname;
        this.email = email;
        this.uuid = uuid_1.v4();
    }
    Event.prototype.arrived = function (dbm) {
        dbm.updateEvent(this).then(function (value) {
        }).catch(function (err) {
            console.log("arrived Error:" + err);
        });
    };
    Event.prototype.fireWebhook = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var that = _this;
            console.log("Sende Webhook....:" + _this.webhook);
            console.log("Sende Body....:" + JSON.stringify(_this));
            request_1.default.post(_this.webhook, { json: _this }, function (error, response, body) {
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
    };
    Event.prototype.toWallet = function (res) {
        return __awaiter(this, void 0, void 0, function () {
            var examplePass, stream;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, passkit_generator_1.createPass({
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
                        })];
                    case 1:
                        examplePass = _a.sent();
                        // Adding some settings to be written inside pass.json
                        //examplePass.barcode("Test"); 
                        examplePass.barcodes({
                            message: "uuid=" + this.uuid,
                            format: "PKBarcodeFormatQR",
                            altText: "Check in",
                            messageEncoding: "iso-8859-1"
                        });
                        examplePass.headerFields.map(function (item) {
                            _this.repaceValues(item);
                        });
                        examplePass.primaryFields.map(function (item) {
                            _this.repaceValues(item);
                        });
                        examplePass.secondaryFields.map(function (item) {
                            _this.repaceValues(item);
                        });
                        examplePass.auxiliaryFields.map(function (item) {
                            _this.repaceValues(item);
                        });
                        if (this.eventDate) {
                            examplePass.relevantDate(this.eventDate);
                        }
                        stream = examplePass.generate();
                        stream.pipe(res);
                        return [2 /*return*/];
                }
            });
        });
    };
    Event.prototype.repaceValues = function (item) {
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
    };
    Event.prototype.toPDF = function () {
        var doc = new PDFDocument({
            size: "A4",
            autoFirstPage: true,
            margin: 25
        });
        try {
            var img = qr_image_1.default.imageSync("uuid=" + this.uuid, { type: 'png', size: 3 });
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
    };
    return Event;
}());
exports.Event = Event;
/**
 * Ein event Ticket als wallet!
 */
function genWalletTicket(req, res) {
    console.log("Gen Wallet");
    var result = {};
    if (req.query.uuid) {
        var dbm = new DBManager_1.DBManager();
        var event_1 = new Event();
        dbm.getEvent(req.query.uuid.toString()).then(function (e) {
            event_1.name = e.name;
            event_1.vorname = e.vorname;
            event_1.email = e.email;
            event_1.eventName = e.eventName;
            event_1.eventDate = e.eventDate;
            event_1.registered = e.registered;
            event_1.uuid = e.uuid;
            res.set({
                "Content-type": "application/vnd.apple.pkpass",
                "Content-disposition": "attachment; filename=mmbbsevent.pkpass",
            });
            event_1.toWallet(res);
        }).catch(function (err) {
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
    var result = {};
    if (req.query.uuid) {
        var dbm = new DBManager_1.DBManager();
        var event_2 = new Event();
        dbm.getEvent(req.query.uuid.toString()).then(function (e) {
            event_2.name = e.name;
            event_2.vorname = e.vorname;
            event_2.email = e.email;
            event_2.eventName = e.eventName;
            event_2.eventDate = e.eventDate;
            event_2.registered = e.registered;
            event_2.uuid = e.uuid;
            res.set({
                "Content-type": "application/pdf",
                "Content-disposition": "attachment; filename=ticket.pdf",
            });
            event_2.toPDF().pipe(res);
        }).catch(function (err) {
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
    var result = {};
    if (req.query.uuid) {
        var dbm_1 = new DBManager_1.DBManager();
        var e_1 = new Event();
        e_1.uuid = req.query.uuid.toString();
        dbm_1.updateEvent(e_1).then(function (ev) {
            dbm_1.getEvent(e_1.uuid).then(function (ev2) {
                if (ev2 != null) {
                    e_1.name = ev2.name;
                    e_1.vorname = ev2.vorname;
                    e_1.email = ev2.email;
                    e_1.eventName = ev2.eventName;
                    e_1.eventDate = ev2.eventDate;
                    e_1.registered = ev2.registered;
                    e_1.arrival = ev2.arrival;
                    e_1.webhook = ev2.webhook;
                    if (ev2.webhook) {
                        e_1.type = "arrival";
                        e_1.fireWebhook().then(function (ev3) {
                            res.statusCode = 200;
                            res.send(JSON.stringify(ev3));
                        }).catch(function (err) {
                            e_1.success = false;
                            e_1.msg = err;
                            res.statusCode = 500;
                            res.send(JSON.stringify(e_1));
                        });
                    }
                    else {
                        res.statusCode = 200;
                        res.send(JSON.stringify(e_1));
                    }
                }
                else {
                    res.statusCode = 404;
                    res.send(JSON.stringify(ev2));
                }
            }).catch(function (err) {
                res.statusCode = 500;
                result.msg = "SELECT Failed:" + err;
                res.send(JSON.stringify(result));
            });
        }).catch(function (err) {
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
    var result = {};
    if (req.query.uuid) {
        var dbm = new DBManager_1.DBManager();
        dbm.getEvent(req.query.uuid.toString()).then(function (e) {
            if (e == null) {
                res.statusCode = 404;
            }
            else {
                res.statusCode = 200;
            }
            res.send(JSON.stringify(e));
        }).catch(function (err) {
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
    var event = new Event();
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
    event.uuid = uuid_1.v4();
    console.log("UUID=" + event.uuid);
    var dbm = new DBManager_1.DBManager();
    dbm.readEvent(event.name, event.vorname, event.email, event.eventName).then(function (v) {
        console.log("gelesen:" + JSON.stringify(v));
        if (v == null) {
            dbm.setEvent(event).then(function (v1) {
                console.log("Event eingetragen: " + JSON.stringify(v1));
                if (event.webhook) {
                    console.log("Webhook ausführen");
                    event.type = "registration";
                    event.fireWebhook().then(function (v2) {
                        console.log("Webhook erfolgreich:" + JSON.stringify(v2));
                        res.send(JSON.stringify(v2));
                    }).catch(function (err) {
                        console.log("Webhook fehlgeschlagen:" + err);
                        event.success = false;
                        event.msg = JSON.stringify(err);
                        res.send(JSON.stringify(event));
                    });
                }
                else {
                    res.send(JSON.stringify(v1));
                }
            }).catch(function (err) {
                event.success = false;
                event.msg = err;
                res.send(JSON.stringify(event));
            });
        }
        else {
            console.log("Datensatz existiert bereits");
            res.send(JSON.stringify(v));
        }
    }).catch(function (err) {
        console.log("Fehler:" + err);
        res.send(JSON.stringify(event));
    });
}
exports.handlePost = handlePost;
//# sourceMappingURL=Event.js.map