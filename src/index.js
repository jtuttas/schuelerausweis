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
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const ID_1 = require("./ID");
const fs_1 = __importDefault(require("fs"));
const node_rsa_1 = __importDefault(require("node-rsa"));
const https_1 = __importDefault(require("https"));
const date_fns_1 = require("date-fns");
const walletBuilder_1 = require("./walletBuilder");
const config_json_1 = __importDefault(require("../config/config.json"));
const qr_image_1 = __importDefault(require("qr-image"));
const Event_1 = require("./Event");
const express_fileupload_1 = __importDefault(require("express-fileupload"));
const sharp_1 = __importDefault(require("sharp"));
const sync_1 = require("csv-parse/sync");
const MailSender_1 = require("./MailSender");
const MailObject_1 = require("./MailObject");
const ImportResult_1 = require("./ImportResult");
const google_auth_library_1 = require("google-auth-library");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
var keys = [];
let students = {};
const { v1: uuidv1, v4: uuidv4, } = require('uuid');
let mailsender;
let adminUUID = uuidv4();
let adminLoginTimestamp = 0;
if (fs_1.default.existsSync("config/students.csv")) {
    console.log("Students.CSV gefunden, importiere Daten");
    let res = importStudents("config/students.csv");
    //console.log(JSON.stringify(students));
    students = res.students;
    console.log(res.imported + " Datensatze von " + res.total + " verarbeitet");
    mailsender = new MailSender_1.MailSender();
}
// Für Testzwecke
//keys.push("geheim");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
let rsakey = fs_1.default.readFileSync("config/ausweis.private");
const key = new node_rsa_1.default(rsakey);
const app = (0, express_1.default)();
const port = 8080; // default port to listen
console.log(__dirname);
app.use((0, express_fileupload_1.default)());
app.use(express_1.default.static(__dirname + '/../web'));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
var wb = new walletBuilder_1.WalletBuilder();
let obj;
function underage(dateString) {
    var d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    d.setHours(0, 0, 0);
    //console.log('Date:'+d);
    if (d > new Date(dateString)) {
        //console.log('Volljährig');
        return false;
    }
    //console.log('Minderjährig');
    return true;
}
function expired(dateString) {
    if (new Date(dateString) > new Date()) {
        //console.log("valid");
        return false;
    }
    //console.log("expired");
    return true;
}
/**
 * Generate Google Walletr
 */
app.post('/requestgwallet', function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const issuerId = process.env.WALLET_ISSUER_ID || config_json_1.default.gwalletIssuerID;
        const classId = process.env.WALLET_CLASS_ID || config_json_1.default.gwalletClass;
        var credentials = JSON.parse(fs_1.default.readFileSync("config/gwallet/ausweis-key.json").toString());
        const httpClient = new google_auth_library_1.GoogleAuth({
            credentials: credentials,
            scopes: "https://www.googleapis.com/auth/wallet_object.issuer",
        });
        const objectUrl = "https://walletobjects.googleapis.com/walletobjects/v1/genericObject/";
        let objectResponse;
        let obj = {};
        if (req.query.id) {
            let sid = req.query.id.toString();
            console.log("ID=" + sid);
            try {
                let decrypted = key.decrypt(req.query.id.toString(), 'utf8');
                let obj = JSON.parse(decrypted);
                console.log("Decrypted:" + decrypted);
                let objectPayload = wb.genGoogleWallet(req, sid, obj);
                console.log("objPayload:" + JSON.stringify(objectPayload));
                objectPayload.id = `${issuerId}.${req.body.email.replace(/[^\w.-]/g, "_")}-${classId}`;
                objectPayload.classId = `${issuerId}.${classId}`;
                try {
                    // Ausweis ausstellen
                    //objectResponse = await httpClient.request({url: objectUrl + objectPayload.id, method: 'GET'});
                    // Ausweis aktualisieren
                    console.log("Sende GET/PUT an: " + objectUrl + objectPayload.id);
                    objectResponse = yield httpClient.request({
                        url: objectUrl + objectPayload.id,
                        method: "PUT",
                        data: objectPayload,
                    });
                    console.log("existing object", objectPayload.id);
                    //console.log("receive:" + JSON.stringify(objectResponse));
                }
                catch (err) {
                    if (err.response && err.response.status === 404) {
                        console.log("Sende POST an:" +
                            objectUrl +
                            " mit BODY: " +
                            JSON.stringify(objectPayload));
                        objectResponse = yield httpClient.request({
                            url: objectUrl,
                            method: "POST",
                            data: objectPayload,
                        });
                        console.log("new object", objectPayload.id);
                    }
                    else {
                        console.error(err);
                        throw err;
                    }
                }
                const claims = {
                    iss: credentials.client_email,
                    aud: "google",
                    origins: ["http://localhost:3000"],
                    typ: "savetowallet",
                    payload: {
                        genericObjects: [{ id: objectPayload.id }],
                    },
                };
                const token = jsonwebtoken_1.default.sign(claims, credentials.private_key, {
                    algorithm: "RS256",
                });
                const saveUrl = `https://pay.google.com/gp/v/save/${token}`;
                res.send(`<a href="${saveUrl}"><img width=\"200px\" src="/img/button.png"></a>`);
            }
            catch (_a) {
                console.log("Failed to Decode!");
                res.setHeader("content-type", "text/htm");
                res.send('<p>Wrong ID parameter</p>');
            }
        }
        else {
            res.setHeader("content-type", "text/htm");
            res.send('<p>No ID parameter</p>');
        }
    });
});
/**
 * Download der CSV Datei für den Admin
 */
app.get('/csvDownload', function (req, res) {
    let uuid = req.query.uuid.toString();
    if (uuid == adminUUID) {
        let dif = Date.now() - adminLoginTimestamp;
        console.log("Login after (ms)" + dif);
        if (dif > 70000) {
            res.setHeader("content-type", "text/html");
            let s = fs_1.default.readFileSync('web/admin.htm', 'utf8');
            res.statusCode = 200;
            s = s.replace("<!--error-->", "Session Timeout");
            res.send(s);
        }
        else {
            const file = `${__dirname}/../config/students.csv`;
            res.download(file); // Set disposition and send it.        
        }
    }
    else {
        res.setHeader("content-type", "text/html");
        let s = fs_1.default.readFileSync('web/admin.htm', 'utf8');
        res.statusCode = 200;
        s = s.replace("<!--error-->", "falsche UUID");
        res.send(s);
    }
});
/**
 * Upload der CSV Datei für den Admin
 */
app.post('/csvUpload', function (req, res) {
    res.setHeader("content-type", "text/html");
    let sampleFile;
    let uploadPath;
    let s = fs_1.default.readFileSync('src/upload.htm', 'utf8');
    if (!req.query.uuid) {
        res.setHeader("content-type", "text/html");
        let s = fs_1.default.readFileSync('web/admin.htm', 'utf8');
        res.statusCode = 200;
        s = s.replace("<!--error-->", "Keine UUID gedeunfen");
        res.send(s);
    }
    let uuid = req.query.uuid.toString();
    if (uuid == adminUUID) {
        let dif = Date.now() - adminLoginTimestamp;
        console.log("Login after (ms)" + dif);
        if (dif > 70000) {
            res.setHeader("content-type", "text/html");
            let s = fs_1.default.readFileSync('web/admin.htm', 'utf8');
            res.statusCode = 200;
            s = s.replace("<!--error-->", "Session Timeout");
            res.send(s);
        }
        else {
            s = s.replace(/<!--uuid-->/g, adminUUID);
            //console.log("Receive:"+JSON.stringify(req.files));
            if (!req.files) {
                res.statusCode = 200;
                s = s.replace("<!--error-->", "Keine Daten hochgeladen");
                res.send(s);
                return;
            }
            if (Object.keys(req.files).length === 0) {
                res.statusCode = 200;
                s = s.replace("<!--error-->", "Keine Daten hochgeladen!");
                res.send(s);
            }
            try {
                // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
                sampleFile = req.files.csv;
                console.log("File name:" + JSON.stringify(sampleFile));
                let filename = sampleFile.name;
                let parts = filename.split(".");
                let suffix = parts[parts.length - 1];
                console.log("Suffix is: " + suffix);
                if (suffix != "csv") {
                    res.statusCode = 200;
                    s = s.replace("<!--error-->", "ungültiges suffix");
                    res.send(s);
                }
                else {
                    uploadPath = __dirname + '/../config/students-upload.csv';
                    // Use the mv() method to place the file somewhere on your server
                    sampleFile.mv(uploadPath, function (err) {
                        if (err) {
                            console.log("Err:" + err);
                            res.statusCode = 200;
                            s = s.replace("<!--error-->", err);
                            res.send(s);
                        }
                        else {
                            try {
                                let ir = importStudents("config/students-upload.csv");
                                fs_1.default.cpSync("config/students-upload.csv", "config/students.csv");
                                console.log(ir.imported + " Datensätze von " + ir.total + " verarbeitet");
                                res.statusCode = 200;
                                students = ir.students;
                                s = s.replace("<!--error-->", "<h5>" + ir.imported + " Datensätze von " + ir.total + " verarbeitet!</h5>" + ir.htmlErrorOutput);
                                res.send(s);
                            }
                            catch (e) {
                                console.log("Exception:" + JSON.stringify(e));
                                res.statusCode = 200;
                                s = s.replace("<!--error-->", "Fehler beim Upload:" + e.code + " " + e.record);
                                res.send(s);
                            }
                            fs_1.default.rmSync("config/students-upload.csv");
                        }
                    });
                }
            }
            catch (error) {
                console.log("Err:" + error);
                res.statusCode = 200;
                s = s.replace("<!--error-->", error);
                res.send(s);
            }
        }
    }
    else {
        res.setHeader("content-type", "text/html");
        let s = fs_1.default.readFileSync('web/admin.htm', 'utf8');
        res.statusCode = 200;
        s = s.replace("<!--error-->", "Wrong UID");
        res.send(s);
    }
});
/**
 * Anmeldung als admin
 */
app.post('/admin', function (req, res) {
    console.log("body:" + JSON.stringify(req.body));
    res.setHeader("content-type", "text/html");
    if (req.body.password == config_json_1.default.adminPassword) {
        let s = fs_1.default.readFileSync('src/upload.htm', 'utf8');
        adminUUID = uuidv4();
        adminLoginTimestamp = Date.now();
        console.log("Generate " + adminUUID + " Timestamp=" + adminLoginTimestamp);
        s = s.replace(/<!--uuid-->/g, adminUUID);
        res.statusCode = 200;
        res.send(s);
    }
    else {
        let s = fs_1.default.readFileSync('web/admin.htm', 'utf8');
        res.statusCode = 200;
        s = s.replace("<!--error-->", "falsches Kennwort");
        res.send(s);
    }
});
/**
 * Endpunkt zum Upload der Schülerbilder
 */
app.post('/image', function (req, res) {
    res.setHeader("content-type", "application/json");
    let sampleFile;
    let uploadPath;
    let scaledPath;
    let result = {
        sucess: false,
        msg: null
    };
    if (!req.files) {
        result.msg = "No files were uploaded!!";
        return res.status(400).send(JSON.stringify(result));
    }
    if (Object.keys(req.files).length === 0) {
        result.msg = "No files were uploaded!";
        return res.status(400).send(JSON.stringify(result));
    }
    try {
        let id = req.query.id.toString();
        id = id.split(" ").join("+");
        console.log("ID is " + id);
        let decrypted = key.decrypt(id, 'utf8');
        let obj = JSON.parse(decrypted);
        console.log("Decrypted:" + decrypted);
        // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
        sampleFile = req.files.image;
        console.log("File name:" + sampleFile);
        let filename = sampleFile.name;
        let parts = filename.split(".");
        let suffix = parts[parts.length - 1];
        console.log("Suffix is: " + suffix);
        ;
        var crypto = require('crypto');
        var name = obj.kl + "_" + obj.nn + "_" + obj.vn;
        var hash = crypto.createHash('md5').update(name).digest('hex');
        console.log(hash);
        uploadPath = __dirname + '/../config/img' + hash + ".jpg";
        scaledPath = __dirname + '/../config/img_' + hash + ".jpg";
        // Use the mv() method to place the file somewhere on your server
        sampleFile.mv(uploadPath, function (err) {
            if (err) {
                result.msg = err;
                return res.status(500).send(JSON.stringify(result));
            }
            console.log("Image uploaded to: " + uploadPath);
            var sizeOf = require('image-size');
            var dimensions = sizeOf(uploadPath);
            console.log(dimensions.width, dimensions.height);
            if (dimensions.width > 5000 || dimensions.height > 5000) {
                console.log("To large Image");
                fs_1.default.unlinkSync(uploadPath);
                result.msg = "Image to large!";
                return res.status(400).send(JSON.stringify(result));
            }
            try {
                let inStream = fs_1.default.createReadStream(uploadPath);
                var transformer = (0, sharp_1.default)()
                    .resize(500, 500)
                    .on('info', function (info) {
                    console.log('Image height is ' + info.height);
                });
                let outStream = fs_1.default.createWriteStream(scaledPath, { flags: "w" });
                var transformer = (0, sharp_1.default)()
                    .resize(500, 500)
                    .on('info', function (info) {
                    console.log('Image height is ' + info.height);
                });
                let err = false;
                transformer.on('error', () => {
                    console.log("error");
                    err = true;
                });
                inStream.pipe(transformer).pipe(outStream);
                outStream.on('close', () => {
                    console.log("close out Stream");
                    if (err) {
                        fs_1.default.unlinkSync(uploadPath);
                        fs_1.default.unlinkSync(scaledPath);
                        res.status(500);
                        result.sucess = false;
                        result.msg = "Fehler beim Upload";
                        res.send(JSON.stringify(result));
                    }
                    else {
                        fs_1.default.unlinkSync(uploadPath);
                        res.status(200);
                        result.sucess = true;
                        result.msg = "Image Uploaded and Scaled";
                        res.send(JSON.stringify(result));
                    }
                });
            }
            catch (error) {
                console.log("Err:" + error);
                res.status(500);
                result.sucess = false;
                result.msg = "Fehler beim Upload";
                res.send(JSON.stringify(result));
            }
        });
    }
    catch (_a) {
        result.sucess = false;
        result.msg = 'Unknown or invalid id';
        res.status(400).send(JSON.stringify(result));
    }
});
/**
 * Endpunkt zur Abfrage der Schülerbilder
 */
app.get('/image', function (req, res) {
    let result = {
        sucess: false,
        msg: null
    };
    try {
        let id = req.query.id.toString();
        id = id.split(" ").join("+");
        console.log("ID is " + id);
        let decrypted = key.decrypt(id, 'utf8');
        console.log("Decrypted:" + decrypted);
        let obj = JSON.parse(decrypted);
        var crypto = require('crypto');
        var name = obj.kl + "_" + obj.nn + "_" + obj.vn;
        var hash = crypto.createHash('md5').update(name).digest('hex');
        console.log(hash);
        let downloadPath = __dirname + '/../config/img_' + hash + ".jpg";
        console.log("return Image:" + downloadPath);
        try {
            if (fs_1.default.existsSync(downloadPath)) {
                if (!req.query.width) {
                    res.setHeader("content-type", "image/jpeg");
                    res.sendFile(path_1.default.resolve(downloadPath));
                }
                else {
                    console.log("Mit Width Parameter");
                    res.setHeader("content-type", "image/jpeg");
                    let w = Number(req.query.width.toString());
                    console.log("Start resize:" + w);
                    let inStream = fs_1.default.createReadStream(downloadPath);
                    var transformer = (0, sharp_1.default)()
                        .resize(w)
                        .on('info', function (info) {
                        console.log('Image height is ' + info.height);
                    });
                    inStream.pipe(transformer).pipe(res);
                }
            }
            else {
                res.setHeader("content-type", "application/json");
                result.sucess = false;
                result.msg = "File Not Found " + downloadPath;
                res.status(404).send(JSON.stringify(result));
            }
        }
        catch (err) {
            res.setHeader("content-type", "application/json");
            result.sucess = false;
            result.msg = err;
            res.status(400).send(JSON.stringify(result));
        }
    }
    catch (err) {
        console.log("Fehler: " + err);
        res.setHeader("content-type", "application/json");
        result.sucess = false;
        result.msg = 'Unknown or invalid ID';
        res.status(400).send(JSON.stringify(result));
    }
});
/**
 * Event Ticket als Wallet
 */
app.get("/eventwallet", Event_1.genWalletTicket);
/**
 * Event Ticket als PDF
 */
app.get("/eventpdf", Event_1.genPDFTicket);
/**
 * Ankunft Arrival
 */
app.put("/event", Event_1.handlePut);
/**
 * Endpunkt Anmeldung zu einem Event abfragen
 */
app.get("/event", Event_1.handleGet);
/**
 * Endpunkt Anmeldung zu einem Event
 */
app.post("/event", Event_1.handlePost);
/**
Endpunkt zum Erzeugen von QR Codes als Image
*/
app.get('/qrcode', function (req, res) {
    if (req.query.data) {
        var code = qr_image_1.default.image(req.query.data.toString(), { type: 'png' });
        res.type('png');
        code.pipe(res);
    }
    else {
        res.statusCode = 406;
        res.send("missing Data Parameter");
    }
});
/**
 * Endpunkt Zum erzeugen eines Schülerausweises als png
 */
app.get("/png", (req, res) => {
    let obj = {};
    if (req.query.id) {
        let sid = req.query.id.toString();
        console.log("ID=" + sid);
        try {
            let decrypted = key.decrypt(req.query.id.toString(), 'utf8');
            console.log("Decrypted:" + decrypted);
            let obj = JSON.parse(decrypted);
            wb.genPng(req, res, sid, obj);
        }
        catch (_a) {
            console.log("Failed to Decode!");
            obj.valid = false;
            obj.msg = "failed to decode id!";
            res.setHeader("content-type", "application/json");
            res.send(JSON.stringify(obj));
        }
    }
    else {
        res.setHeader("content-type", "application/json");
        obj.valid = false;
        obj.msg = "no id Param";
        res.send(JSON.stringify(obj));
    }
});
/**
 * Endpunkt Zum erzeugen eines Schülerausweises als pdf
 */
app.get("/pdf", (req, res) => {
    let obj = {};
    if (req.query.id) {
        let sid = req.query.id.toString();
        console.log("ID=" + sid);
        try {
            let decrypted = key.decrypt(req.query.id.toString(), 'utf8');
            console.log("Decrypted:" + decrypted);
            let obj = JSON.parse(decrypted);
            wb.genpdf(req, res, sid, obj);
        }
        catch (_a) {
            console.log("Failed to Decode!");
            obj.valid = false;
            obj.msg = "failed to decode id!";
            res.setHeader("content-type", "application/json");
            res.send(JSON.stringify(obj));
        }
    }
    else {
        res.setHeader("content-type", "application/json");
        obj.valid = false;
        obj.msg = "no id Param";
        res.send(JSON.stringify(obj));
    }
});
/**
 * Endpunkt Zum erzeugen eines ioS Wallets
 */
app.get("/iwallet", (req, res) => {
    let obj = {};
    if (req.query.id) {
        let sid = req.query.id.toString();
        console.log("ID=" + sid);
        //console.log("Server "+req.get("host"));
        try {
            let decrypted = key.decrypt(req.query.id.toString(), 'utf8');
            console.log("Decrypted:" + decrypted);
            let obj = JSON.parse(decrypted);
            wb.genit(req, res, sid, obj);
        }
        catch (_a) {
            console.log("Failed to Decode!");
            obj.valid = false;
            obj.msg = "failed to decode id!";
            res.setHeader("content-type", "application/json");
            res.send(JSON.stringify(obj));
        }
    }
    else {
        res.setHeader("content-type", "application/json");
        obj.valid = false;
        obj.msg = "no id Param";
        res.send(JSON.stringify(obj));
    }
});
/**
 * Endpunkt zum Einloggen als Schüler
 */
app.post("/wallet", (req, res) => {
    console.log("user:" + req.body.user);
    console.log("body:" + JSON.stringify(req.body));
    let obj = {};
    let obj2 = {};
    let user = req.body.user;
    user = user.trim().toLowerCase();
    let pwd = req.body.pwd;
    //pwd =decodeURIComponent(pwd)
    let data = {
        "benutzer": user,
        "kennwort": pwd
    };
    console.log("data:" + JSON.stringify(data));
    if (fs_1.default.existsSync("config/students.csv")) {
        if (students[data.benutzer] != undefined) {
            console.log("Found " + data.benutzer);
            res.setHeader("content-type", "text/html");
            let s = fs_1.default.readFileSync('web/confirm.htm', 'utf8');
            let student = {};
            student.nn = students[data.benutzer][2];
            student.vn = students[data.benutzer][1];
            student.kl = students[data.benutzer][4];
            student.v = config_json_1.default.validDate;
            student.gd = students[data.benutzer][3];
            student.did = 0;
            console.log("student:" + JSON.stringify(student));
            let id = key.encrypt(JSON.stringify(student), 'base64');
            console.log("id=" + id);
            id = id.split("+").join("%2B");
            let mo = new MailObject_1.MailObject();
            mo.from = config_json_1.default.mailfrom;
            mo.to = data.benutzer;
            mo.subject = config_json_1.default.mailSubject;
            mo.text = config_json_1.default.mailHeader + req.protocol + '://' + req.get('host') + req.url + "?id=" + id + "\r\n\r\n" + config_json_1.default.mailFooter;
            //console.log(mo.text);
            mailsender.sendMail(mo).then(obj => {
                console.log("Then:" + JSON.stringify(obj));
                s = s.replace("<!--msg-->", "eMail gesendet an " + data.benutzer + "!");
                res.statusCode = 200;
                res.send(s);
            }).catch(err => {
                console.log("Catch Err: " + JSON.stringify(err));
                res.statusCode = 400;
                s = s.replace("<!--msg-->", "Fehler beim senden der eMail an " + data.benutzer + "! (" + JSON.stringify(err) + ")");
                res.send(s);
            });
        }
        else {
            console.log("unknown " + data.benutzer);
            res.setHeader("content-type", "text/html");
            let s = fs_1.default.readFileSync('web/index.htm', 'utf8');
            s = s.replace("<!--error-->", "eMail Adresse unbekannt!");
            res.send(s);
            return;
        }
    }
    else {
        let options = {
            hostname: 'diklabu.mm-bbs.de',
            port: 8080,
            path: "/Diklabu/api/v1/auth/login",
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
            }
        };
        if (req.body.pwd == "mmbbs@ExpoPlaza3") {
            console.log("Default Password used");
            res.setHeader("content-type", "text/html");
            let s = fs_1.default.readFileSync('web/index.html', 'utf8');
            s = s.replace("<!--error-->", "Anmeldedaten ungültig!");
            res.send(s);
            return;
        }
        let request = https_1.default.request(options, result => {
            console.log(`statusCode: ${result.statusCode}`);
            result.on('data', d => {
                console.log("data:" + d);
                if (result.statusCode == 200) {
                    obj = JSON.parse(d);
                    if (obj.success == false) {
                        res.setHeader("content-type", "text/html");
                        let s = fs_1.default.readFileSync('web/index.html', 'utf8');
                        s = s.replace("<!--error-->", obj.msg);
                        res.send(s);
                        return;
                    }
                    if (obj.role == "Schueler" && obj.success == true) {
                        console.log("Angemeldet als Schüler! ID=" + obj.ID);
                        let options2 = {
                            hostname: 'diklabu.mm-bbs.de',
                            port: 8080,
                            path: "/Diklabu/api/v1/sauth/" + obj.ID,
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8',
                                'auth_token': obj.auth_token
                            }
                        };
                        let request2 = https_1.default.request(options2, result2 => {
                            console.log(`statusCode: ${result2.statusCode}`);
                            result2.on('data', d2 => {
                                console.log("data2:" + d2);
                                obj2 = JSON.parse(d2);
                                let student = {};
                                student.nn = obj.NNAME;
                                student.vn = obj.VNAME;
                                student.kl = obj.nameKlasse;
                                student.v = config_json_1.default.validDate;
                                student.gd = obj2.gebDatum;
                                student.did = obj.idPlain;
                                let id = key.encrypt(JSON.stringify(student), 'base64');
                                console.log("id=" + id);
                                id = id.split("+").join("%2B");
                                let s = fs_1.default.readFileSync('web/idcards.html', 'utf8');
                                //s = s.replace("<!--wallet-->", "/wallet?id=" + id);
                                s = s.replace("<!--sj-->", config_json_1.default.schuljahr);
                                s = s.replace("<!--pdf-->", "/pdf?id=" + id);
                                s = s.replace("<!--png-->", "/png?id=" + id);
                                s = s.replaceAll("<!--id-->", id);
                                var crypto = require('crypto');
                                var name = student.kl + "_" + student.nn + "_" + student.vn;
                                var hash = crypto.createHash('md5').update(name).digest('hex');
                                console.log(hash);
                                let downloadPath = __dirname + '/../config/img_' + hash + ".jpg";
                                if (fs_1.default.existsSync(downloadPath)) {
                                    console.log("Image Found: " + downloadPath);
                                    s = s.replace("<!--img-->", "/image?id=" + id + "&width=90");
                                }
                                else {
                                    console.log("No Image Found:" + downloadPath);
                                    s = s.replace("<!--img-->", "img/anonym_210x210.jpg");
                                }
                                s = s.replace("<!--wallet-->", "/iwallet?id=" + id);
                                s = s.replace("<!--username-->", student.vn + "&nbsp;" + student.nn);
                                //s = s.replace("<!--link-->", "/validate?id=" + id);
                                s = s.replace("<!--qrcode-->", "/qrcode?data=" + encodeURIComponent(req.protocol + '://' + req.get('host') + "/iwallet?id=" + id));
                                res.setHeader("content-type", "text/html");
                                res.send(s);
                            });
                        });
                        request2.on('error', error => {
                            console.error("Error" + error);
                        });
                        request2.write("");
                        request2.end();
                    }
                    else {
                        res.setHeader("content-type", "text/html");
                        let s = fs_1.default.readFileSync('web/index.html', 'utf8');
                        s = s.replace("<!--error-->", "Anmeldung nur als Schüler möglich");
                        res.send(s);
                    }
                }
                else if (result.statusCode == 400) {
                    res.setHeader("content-type", "text/html");
                    let s = fs_1.default.readFileSync('web/index.html', 'utf8');
                    s = s.replace("<!--error-->", "Error 400");
                    res.send(s);
                }
                else {
                    obj = JSON.parse(d);
                    res.setHeader("content-type", "text/html");
                    let s = fs_1.default.readFileSync('web/index.html', 'utf8');
                    s = s.replace("<!--error-->", "Anmeldedaten ungültig");
                    res.send(s);
                }
            });
        });
        request.on('error', error => {
            console.error(error);
            let s = fs_1.default.readFileSync('web/login.html', 'utf8');
            s = s.replace("<!--error-->", error.message);
            res.send(s);
        });
        request.write(JSON.stringify(data));
        request.end();
    }
});
/**
 * Endpunkt für die Schülerinnen und Schüler abholen des Ausweises
 */
app.get("/wallet", (req, res) => {
    res.setHeader("content-type", "text/html");
    if (req.query.id) {
        try {
            let id = req.query.id.toString();
            let decrypted = key.decrypt(id, 'utf8');
            console.log("Decrypted:" + decrypted);
            id = id.split("+").join("%2B");
            obj = JSON.parse(decrypted);
            let s = fs_1.default.readFileSync("web/idcards.htm", 'utf8');
            //console.log("read:"+s.length);
            s = s.replace("<!--sj-->", config_json_1.default.schuljahr);
            s = s.replace("<!--username-->", obj.vn + "&nbsp;" + obj.nn);
            s = s.replace("<!--pdf-->", "/pdf?id=" + id);
            s = s.replace("<!--png-->", "/png?id=" + id);
            s = s.replace(/<!--id-->/g, id);
            var crypto = require('crypto');
            var name = obj.kl + "_" + obj.nn + "_" + obj.vn;
            var hash = crypto.createHash('md5').update(name).digest('hex');
            console.log(hash);
            let downloadPath = __dirname + '/../config/img_' + hash + ".jpg";
            if (fs_1.default.existsSync(downloadPath)) {
                console.log("Image Found: " + downloadPath);
                s = s.replace("<!--img-->", "/image?id=" + id + "&width=90");
            }
            else {
                console.log("No Image Found:" + downloadPath);
                s = s.replace("<!--img-->", "img/anonym_210x210.jpg");
            }
            s = s.replace("<!--wallet-->", "/iwallet?id=" + id);
            //s = s.replace("<!--link-->", "/validate?id=" + id);
            s = s.replace("<!--qrcode-->", "/qrcode?data=" + encodeURIComponent(req.protocol + '://' + req.get('host') + "/iwallet?id=" + id));
            res.send(s);
            console.log("Sending Welcome Page");
        }
        catch (e) {
            console.log("Exception!!" + JSON.stringify(e));
            let obj = {};
            res.send(fs_1.default.readFileSync("web/404.htm", 'utf8'));
        }
    }
    else {
        res.send(fs_1.default.readFileSync("web/404.htm", 'utf8'));
    }
});
/**
 * Endpunkt für die Schülerinnen und Schüler Überpfüfen des QR Codes
 */
app.post("/validate", (req, res) => {
    console.log("Body:" + JSON.stringify(req.body));
    res.setHeader("content-type", "application/json");
    try {
        let decrypted = key.decrypt(req.body.id, 'utf8');
        console.log("Decrypted:" + decrypted);
        let obj = JSON.parse(decrypted);
        obj.valid = true;
        res.send(JSON.stringify(obj));
    }
    catch (_a) {
        let obj = {};
        obj.valid = false;
        obj.msg = "failed to decode QRCode!";
        res.send(JSON.stringify(obj));
    }
});
/**
 * Endpunkt für die Schülerinnen und Schüler (Anzeige des Ausweises)
 */
app.get("/validate", (req, res) => {
    // render the index template
    let s = fs_1.default.readFileSync('web/validate.html', 'utf8');
    s = s.replace("<!--year-->", "" + new Date().getFullYear());
    if (req.query.id) {
        let sid = req.query.id.toString();
        console.log("ID=" + sid);
        try {
            let decrypted = key.decrypt(req.query.id.toString(), 'utf8');
            console.log("Decrypted:" + decrypted);
            let obj = JSON.parse(decrypted);
            if (expired(obj.v)) {
                let rs = fs_1.default.readFileSync('web/invalid.html', 'utf8');
                rs = rs.replace("<!--comment-->", "Gültigkeitsdauer überschritten");
                rs = rs.replace("<!--nachname-->", obj.nn);
                rs = rs.replace("<!--vorname-->", obj.vn);
                rs = rs.replace("<!--klasse-->", obj.kl);
                if (obj.hasOwnProperty("gd")) {
                    rs = rs.replace("<!--birthday-->", (0, date_fns_1.format)(new Date(obj.gd), "dd.MM.yyyy"));
                }
                else {
                    rs = rs.replace("<!--birthday-->", "unknown");
                }
                rs = rs.replace("<!--date-->", (0, date_fns_1.format)(new Date(obj.v), "dd.MM.yyyy"));
                s = s.replace("<!--result-->", rs);
            }
            else if (fs_1.default.existsSync("config/students.csv") && !validUser(obj, students)) {
                let rs = fs_1.default.readFileSync('web/invalid.html', 'utf8');
                rs = rs.replace("<!--comment-->", "unbekannte Daten");
                rs = rs.replace("<!--nachname-->", obj.nn);
                rs = rs.replace("<!--vorname-->", obj.vn);
                rs = rs.replace("<!--klasse-->", obj.kl);
                if (obj.hasOwnProperty("gd")) {
                    rs = rs.replace("<!--birthday-->", (0, date_fns_1.format)(new Date(obj.gd), "dd.MM.yyyy"));
                }
                else {
                    rs = rs.replace("<!--birthday-->", "unknown");
                }
                rs = rs.replace("<!--date-->", (0, date_fns_1.format)(new Date(obj.v), "dd.MM.yyyy"));
                s = s.replace("<!--result-->", rs);
            }
            else {
                let rs = fs_1.default.readFileSync('web/valid.html', 'utf8');
                if (underage(obj.gd)) {
                    rs = rs.replace("<!--underage-->", "<18");
                }
                else {
                    rs = rs.replace("<!--underage-->", ">18");
                }
                rs = rs.replace("<!--nachname-->", obj.nn);
                rs = rs.replace("<!--vorname-->", obj.vn);
                rs = rs.replace("<!--klasse-->", obj.kl);
                if (obj.hasOwnProperty("gd")) {
                    rs = rs.replace("<!--birthday-->", (0, date_fns_1.format)(new Date(obj.gd), "dd.MM.yyyy"));
                }
                else {
                    rs = rs.replace("<!--birthday-->", "unknown");
                }
                rs = rs.replace("<!--date-->", (0, date_fns_1.format)(new Date(obj.v), "dd.MM.yyyy"));
                s = s.replace("<!--result-->", rs);
            }
        }
        catch (error) {
            console.log(error);
            let rs = fs_1.default.readFileSync('web/invalid.html', 'utf8');
            rs = rs.replace("<!--comment-->", "ID fehlerhaft");
            rs = rs.replace("<!--nachname-->", "---");
            rs = rs.replace("<!--vorname-->", "---");
            rs = rs.replace("<!--klasse-->", "---");
            rs = rs.replace("<!--birthday-->", "---");
            rs = rs.replace("<!--date-->", "---");
            s = s.replace("<!--result-->", rs);
        }
    }
    else {
        console.log("No ID Parameter");
        let rs = fs_1.default.readFileSync('web/invalid.html', 'utf8');
        rs = rs.replace("<!--comment-->", "fehlender id Parameter!");
        rs = rs.replace("<!--nachname-->", "---");
        rs = rs.replace("<!--vorname-->", "---");
        rs = rs.replace("<!--klasse-->", "---");
        rs = rs.replace("<!--birthday-->", "---");
        rs = rs.replace("<!--date-->", "---");
        s = s.replace("<!--result-->", rs);
    }
    let date = new Date();
    s = s.replace("<!--timestamp-->", date.toLocaleString("de-DE"));
    res.statusCode = 200;
    res.send(s);
});
// define a route handler for the default home page
app.get("/log", (req, res) => {
    // render the index template
    res.setHeader("key", obj.auth_token);
    res.send("");
});
/**
 * Endpunkt zum Einloggen als Lehrer
 */
app.post("/log", (req, res) => {
    console.log("user:" + req.body.user);
    console.log("body:" + JSON.stringify(req.body));
    let data = {
        "benutzer": req.body.user,
        "kennwort": req.body.pwd
    };
    let options = {
        hostname: 'diklabu.mm-bbs.de',
        port: 8080,
        path: "/Diklabu/api/v1/auth/login",
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
        }
    };
    let request = https_1.default.request(options, result => {
        console.log(`statusCode: ${result.statusCode}`);
        result.on('data', d => {
            console.log("data:" + d);
            obj = JSON.parse(d);
            if (result.statusCode == 200) {
                if (obj.role != "Schueler") {
                    let s = fs_1.default.readFileSync('src/index.html', 'utf8');
                    s = s.replace("<!--name-->", obj.ID);
                    console.log("Auth-Token:" + obj.auth_token);
                    keys.push(obj.auth_token);
                    res.setHeader("content-type", "text/html");
                    res.setHeader("key", obj.auth_token);
                    res.send(s);
                }
                else {
                    res.setHeader("content-type", "text/html");
                    let s = fs_1.default.readFileSync('web/login.html', 'utf8');
                    s = s.replace("<!--error-->", "Anmeldung nur als Lehrer möglich");
                    res.send(s);
                }
            }
            else {
                res.setHeader("content-type", "text/html");
                let s = fs_1.default.readFileSync('web/login.html', 'utf8');
                s = s.replace("<!--error-->", obj.message);
                res.send(s);
            }
        });
    });
    request.on('error', error => {
        console.error(error);
        let s = fs_1.default.readFileSync('web/login.html', 'utf8');
        s = s.replace("<!--error-->", error.message);
        res.send(s);
    });
    request.write(JSON.stringify(data));
    request.end();
});
/**
 * Dekodieren des QR Codes und Abfrage des Diklabus (nur möglich mit gültigem key im Header)
 */
app.post("/decode", (req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.headers.key) {
        console.log("key=" + req.headers.key);
        if (keys.indexOf(req.headers.key) != -1) {
            console.log("ID:" + req.body.id);
            try {
                res.statusCode = 200;
                let decrypted = key.decrypt(req.body.id, 'utf8');
                console.log("Decrypted:" + decrypted);
                let idcard = new ID_1.ID(decrypted);
                idcard.getStudent(req.headers.key.toString()).then((s) => {
                    //console.log("Result Betrieb" + s.betrieb.NAME);
                    s.idcard = idcard;
                    res.json(s);
                }).catch(err => {
                    console.log("Error: " + err);
                    res.json(err);
                });
            }
            catch (error) {
                console.log(error);
                res.statusCode = 401;
                res.send('{"msg":"error decrypt key"}');
            }
        }
        else {
            res.statusCode = 401;
            res.send('{"msg":"wrong key"}');
        }
    }
    else {
        res.statusCode = 401;
        res.send('{"msg":"no key"}');
    }
});
process.env.TZ = 'Europe/Amsterdam';
https_1.default.createServer({
    key: fs_1.default.readFileSync('config/server.key'),
    cert: fs_1.default.readFileSync('config/server.cert')
}, app).listen(port, function () {
    console.log(`server started at https://localhost:${port}`);
    console.log("Gültigkeitsdatum des Ausweises ist " + config_json_1.default.validDate);
});
function validUser(obj, students) {
    var found = false;
    Object.keys(students).forEach(function (element) {
        if (obj.vn == students[element][1] && obj.nn == students[element][2] && obj.gd == students[element][3] && obj.kl == students[element][4]) {
            found = true;
        }
    });
    return found;
}
function importStudents(path) {
    let ir = new ImportResult_1.ImportResult();
    const records = (0, sync_1.parse)(fs_1.default.readFileSync(path, 'latin1'), {
        delimiter: ';',
        from_line: 2,
        trim: true
    });
    //console.log(JSON.stringify(records));
    var p = 0;
    let st = {};
    ir.total = records.length;
    records.forEach((element) => {
        if (element.length < 5) {
            console.error("Datensatz hat nicht genügend Elemente" + JSON.stringify(element));
            ir.htmlErrorOutput = ir.htmlErrorOutput + "<p>" + "Datensatz hat nicht genügend Elemente " + JSON.stringify(element) + "</p>\r\n";
        }
        else if (element[0].length == 0) {
            console.error("Keine EMail Adresse im Datensatz " + JSON.stringify(element));
            ir.htmlErrorOutput = ir.htmlErrorOutput + "<p>" + "Keine EMail Adresse im Datensatz " + JSON.stringify(element) + "</p>\r\n";
        }
        else if (element[1].length == 0) {
            console.error("Kein Vorname im Datensatz " + JSON.stringify(element));
            ir.htmlErrorOutput = ir.htmlErrorOutput + "<p>" + "Kein Vorname im Datensatz " + JSON.stringify(element) + "</p>\r\n";
        }
        else if (element[2].length == 0) {
            console.error("Kein Nachname im Datensatz " + JSON.stringify(element));
            ir.htmlErrorOutput = ir.htmlErrorOutput + "<p>" + "Kein Nachname im Datensatz " + JSON.stringify(element) + "</p>\r\n";
        }
        else if (element[3].length == 0) {
            console.error("Kein Geburtsdatum im Datensatz " + JSON.stringify(element));
            ir.htmlErrorOutput = ir.htmlErrorOutput + "<p>" + "Kein Geburtsdatum im Datensatz " + JSON.stringify(element) + "</p>\r\n";
        }
        else if (element[3].split("-").length != 3) {
            console.error("Geburtsdatum im falschen Format " + JSON.stringify(element));
            ir.htmlErrorOutput = ir.htmlErrorOutput + "<p>" + "Geburtsdatum im falschen Format " + JSON.stringify(element) + "</p>\r\n";
        }
        else if (element[4].length == 0) {
            console.error("Keine Klassenbezeichnung im Datensatz " + JSON.stringify(element));
            ir.htmlErrorOutput = ir.htmlErrorOutput + "<p>" + "Keine Klassenbezeichnung im Datensatz " + JSON.stringify(element) + "</p>\r\n";
        }
        else {
            st[element[0].toLocaleLowerCase()] = element;
            p++;
        }
    });
    ir.imported = p;
    ir.students = st;
    return ir;
}
//# sourceMappingURL=index.js.map