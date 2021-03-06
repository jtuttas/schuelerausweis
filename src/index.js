"use strict";
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
var keys = [];
// Für Testzwecke
//keys.push("geheim");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
let rsakey = fs_1.default.readFileSync("config/ausweis.private");
const key = new node_rsa_1.default(rsakey);
const app = express_1.default();
const port = 8080; // default port to listen
console.log(__dirname);
app.use(express_fileupload_1.default());
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
        uploadPath = __dirname + '/../config/img' + obj.did + ".jpg";
        scaledPath = __dirname + '/../config/img_' + obj.did + ".jpg";
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
                var transformer = sharp_1.default()
                    .resize(500, 500)
                    .on('info', function (info) {
                    console.log('Image height is ' + info.height);
                });
                let outStream = fs_1.default.createWriteStream(scaledPath, { flags: "w" });
                var transformer = sharp_1.default()
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
        let downloadPath = __dirname + '/../config/img_' + obj.did + ".jpg";
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
                    var transformer = sharp_1.default()
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
            wb.genPng(res, sid, obj);
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
            wb.genpdf(res, sid, obj);
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
 * Endpunkt Zum erzeugen eines Wallets
 */
app.get("/wallet", (req, res) => {
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
    user = user.trim();
    let pwd = req.body.pwd;
    //pwd =decodeURIComponent(pwd)
    let data = {
        "benutzer": user,
        "kennwort": pwd
    };
    console.log("data:" + JSON.stringify(data));
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
                            let s = fs_1.default.readFileSync('src/idcards.html', 'utf8');
                            //s = s.replace("<!--wallet-->", "/wallet?id=" + id);
                            s = s.replace("<!--sj-->", config_json_1.default.schuljahr);
                            s = s.replace("<!--pdf-->", "/pdf?id=" + id);
                            s = s.replace("<!--png-->", "/png?id=" + id);
                            s = s.replaceAll("<!--id-->", id);
                            let downloadPath = __dirname + '/../config/img_' + student.did + ".jpg";
                            if (fs_1.default.existsSync(downloadPath)) {
                                console.log("Image Found: " + downloadPath);
                                s = s.replace("<!--img-->", "/image?id=" + id + "&width=90");
                            }
                            else {
                                console.log("No Image Found:" + downloadPath);
                                s = s.replace("<!--img-->", "img/anonym_210x210.jpg");
                            }
                            s = s.replace("<!--wallet-->", "/wallet?id=" + id);
                            s = s.replace("<!--username-->", student.vn + "&nbsp;" + student.nn);
                            //s = s.replace("<!--link-->", "/validate?id=" + id);
                            s = s.replace("<!--qrcode-->", "/qrcode?data=" + encodeURIComponent("https://idcard.mmbbs.de/wallet?id=" + id));
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
    let s = fs_1.default.readFileSync('src/validate.html', 'utf8');
    s = s.replace("<!--year-->", "" + new Date().getFullYear());
    if (req.query.id) {
        let sid = req.query.id.toString();
        console.log("ID=" + sid);
        try {
            let decrypted = key.decrypt(req.query.id.toString(), 'utf8');
            console.log("Decrypted:" + decrypted);
            let obj = JSON.parse(decrypted);
            if (expired(obj.v)) {
                let rs = fs_1.default.readFileSync('src/invalid.html', 'utf8');
                rs = rs.replace("<!--comment-->", "Gültigkeitsdauer überschritten");
                rs = rs.replace("<!--nachname-->", obj.nn);
                rs = rs.replace("<!--vorname-->", obj.vn);
                rs = rs.replace("<!--klasse-->", obj.kl);
                if (obj.hasOwnProperty("gd")) {
                    rs = rs.replace("<!--birthday-->", date_fns_1.format(new Date(obj.gd), "dd.MM.yyyy"));
                }
                else {
                    rs = rs.replace("<!--birthday-->", "unknown");
                }
                rs = rs.replace("<!--date-->", date_fns_1.format(new Date(obj.v), "dd.MM.yyyy"));
                s = s.replace("<!--result-->", rs);
            }
            else {
                let rs = fs_1.default.readFileSync('src/valid.html', 'utf8');
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
                    rs = rs.replace("<!--birthday-->", date_fns_1.format(new Date(obj.gd), "dd.MM.yyyy"));
                }
                else {
                    rs = rs.replace("<!--birthday-->", "unknown");
                }
                rs = rs.replace("<!--date-->", date_fns_1.format(new Date(obj.v), "dd.MM.yyyy"));
                s = s.replace("<!--result-->", rs);
            }
        }
        catch (error) {
            console.log(error);
            let rs = fs_1.default.readFileSync('src/invalid.html', 'utf8');
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
        let rs = fs_1.default.readFileSync('src/invalid.html', 'utf8');
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
//# sourceMappingURL=index.js.map