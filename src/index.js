"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var ID_1 = require("./ID");
var fs_1 = __importDefault(require("fs"));
var node_rsa_1 = __importDefault(require("node-rsa"));
var https_1 = __importDefault(require("https"));
var date_fns_1 = require("date-fns");
var walletBuilder_1 = require("./walletBuilder");
var config_json_1 = __importDefault(require("../config/config.json"));
var qr_image_1 = __importDefault(require("qr-image"));
var Event_1 = require("./Event");
var keys = [];
// Für Testzwecke
keys.push("geheim");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
var rsakey = fs_1.default.readFileSync("config/ausweis.private");
var key = new node_rsa_1.default(rsakey);
var app = express_1.default();
var port = 8080; // default port to listen
console.log(__dirname);
app.use(express_1.default.static(__dirname + '/../web'));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
var wb = new walletBuilder_1.WalletBuilder();
var obj;
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
app.get("/png", function (req, res) {
    var obj = {};
    if (req.query.id) {
        var sid = req.query.id.toString();
        console.log("ID=" + sid);
        try {
            var decrypted = key.decrypt(req.query.id.toString(), 'utf8');
            console.log("Decrypted:" + decrypted);
            var obj_1 = JSON.parse(decrypted);
            wb.genPng(res, sid, obj_1);
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
app.get("/pdf", function (req, res) {
    var obj = {};
    if (req.query.id) {
        var sid = req.query.id.toString();
        console.log("ID=" + sid);
        try {
            var decrypted = key.decrypt(req.query.id.toString(), 'utf8');
            console.log("Decrypted:" + decrypted);
            var obj_2 = JSON.parse(decrypted);
            wb.genpdf(res, sid, obj_2);
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
app.get("/wallet", function (req, res) {
    var obj = {};
    if (req.query.id) {
        var sid = req.query.id.toString();
        console.log("ID=" + sid);
        try {
            var decrypted = key.decrypt(req.query.id.toString(), 'utf8');
            console.log("Decrypted:" + decrypted);
            var obj_3 = JSON.parse(decrypted);
            wb.genit(res, sid, obj_3);
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
app.post("/wallet", function (req, res) {
    console.log("user:" + req.body.user);
    console.log("body:" + JSON.stringify(req.body));
    var obj = {};
    var obj2 = {};
    var data = {
        "benutzer": req.body.user,
        "kennwort": req.body.pwd
    };
    var options = {
        hostname: 'diklabu.mm-bbs.de',
        port: 8080,
        path: "/Diklabu/api/v1/auth/login",
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': JSON.stringify(data).length
        }
    };
    var request = https_1.default.request(options, function (result) {
        console.log("statusCode: " + result.statusCode);
        result.on('data', function (d) {
            console.log("data:" + d);
            if (result.statusCode == 200) {
                obj = JSON.parse(d);
                if (obj.success == false) {
                    res.setHeader("content-type", "text/html");
                    var s = fs_1.default.readFileSync('web/index.html', 'utf8');
                    s = s.replace("<!--error-->", obj.msg);
                    res.send(s);
                    return;
                }
                if (obj.role == "Schueler" && obj.success == true) {
                    console.log("Angemeldet als Schüler! ID=" + obj.ID);
                    var options2 = {
                        hostname: 'diklabu.mm-bbs.de',
                        port: 8080,
                        path: "/Diklabu/api/v1/sauth/" + obj.ID,
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'auth_token': obj.auth_token
                        }
                    };
                    var request2 = https_1.default.request(options2, function (result2) {
                        console.log("statusCode: " + result2.statusCode);
                        result2.on('data', function (d2) {
                            console.log("data2:" + d2);
                            obj2 = JSON.parse(d2);
                            var student = {};
                            student.nn = obj.NNAME;
                            student.vn = obj.VNAME;
                            student.kl = obj.nameKlasse;
                            student.v = config_json_1.default.validDate;
                            student.gd = obj2.gebDatum;
                            student.did = obj.idPlain;
                            var id = key.encrypt(JSON.stringify(student), 'base64');
                            console.log("id=" + id);
                            id = id.split("+").join("%2B");
                            var s = fs_1.default.readFileSync('src/idcards.html', 'utf8');
                            s = s.replace("<!--wallet-->", "/wallet?id=" + id);
                            s = s.replace("<!--pdf-->", "/pdf?id=" + id);
                            s = s.replace("<!--link-->", "/validate?id=" + id);
                            s = s.replace("<!--qrcode-->", "/qrcode?data=" + encodeURIComponent("http://idcard.mmbbs.de/validate?id=" + id));
                            res.setHeader("content-type", "text/html");
                            res.send(s);
                        });
                    });
                    request2.on('error', function (error) {
                        console.error("Error" + error);
                    });
                    request2.write("");
                    request2.end();
                }
                else {
                    res.setHeader("content-type", "text/html");
                    var s = fs_1.default.readFileSync('web/index.html', 'utf8');
                    s = s.replace("<!--error-->", "Anmeldung nur als Schüler möglich");
                    res.send(s);
                }
            }
            else if (result.statusCode == 400) {
                res.setHeader("content-type", "text/html");
                var s = fs_1.default.readFileSync('web/index.html', 'utf8');
                s = s.replace("<!--error-->", "Error 400");
                res.send(s);
            }
            else {
                obj = JSON.parse(d);
                res.setHeader("content-type", "text/html");
                var s = fs_1.default.readFileSync('web/index.html', 'utf8');
                s = s.replace("<!--error-->", obj.message);
                res.send(s);
            }
        });
    });
    request.on('error', function (error) {
        console.error(error);
        var s = fs_1.default.readFileSync('web/login.html', 'utf8');
        s = s.replace("<!--error-->", error.message);
        res.send(s);
    });
    request.write(JSON.stringify(data));
    request.end();
});
/**
 * Endpunkt für die Schülerinnen und Schüler Überpfüfen des QR Codes
 */
app.post("/validate", function (req, res) {
    console.log("Body:" + JSON.stringify(req.body));
    res.setHeader("content-type", "application/json");
    try {
        var decrypted = key.decrypt(req.body.id, 'utf8');
        console.log("Decrypted:" + decrypted);
        var obj_4 = JSON.parse(decrypted);
        obj_4.valid = true;
        res.send(JSON.stringify(obj_4));
    }
    catch (_a) {
        var obj_5 = {};
        obj_5.valid = false;
        obj_5.msg = "failed to decode QRCode!";
        res.send(JSON.stringify(obj_5));
    }
});
/**
 * Endpunkt für die Schülerinnen und Schüler (Anzeige des Ausweises)
 */
app.get("/validate", function (req, res) {
    // render the index template
    var s = fs_1.default.readFileSync('src/validate.html', 'utf8');
    s = s.replace("<!--year-->", "" + new Date().getFullYear());
    if (req.query.id) {
        var sid = req.query.id.toString();
        console.log("ID=" + sid);
        try {
            var decrypted = key.decrypt(req.query.id.toString(), 'utf8');
            console.log("Decrypted:" + decrypted);
            var obj_6 = JSON.parse(decrypted);
            if (expired(obj_6.v)) {
                var rs = fs_1.default.readFileSync('src/invalid.html', 'utf8');
                rs = rs.replace("<!--comment-->", "Der Schülerausweis ist ungültig (Gültigkeitsdauer überschritten)!");
                s = s.replace("<!--result-->", rs);
            }
            else {
                var rs = fs_1.default.readFileSync('src/valid.html', 'utf8');
                if (underage(obj_6.gd)) {
                    rs = rs.replace("<!--underage-->", "<p class=\"col-12 col-sm-4 fs-5 underage fw-light\" style=\"color: #ff3131\">minderjährig</p>");
                }
                else {
                    rs = rs.replace("<!--underage-->", "<p class=\"col-12 col-sm-4 fs-5 underage fw-light\" style=\"color: #05b936\">volljährig</p>");
                }
                rs = rs.replace("<!--nachname-->", obj_6.nn);
                rs = rs.replace("<!--vorname-->", obj_6.vn);
                rs = rs.replace("<!--klasse-->", obj_6.kl);
                rs = rs.replace("<!--birthday-->", obj_6.gd);
                rs = rs.replace("<!--date-->", date_fns_1.format(new Date(obj_6.v), "dd.MM.yyyy"));
                s = s.replace("<!--result-->", rs);
            }
        }
        catch (error) {
            console.log(error);
            var rs = fs_1.default.readFileSync('src/invalid.html', 'utf8');
            rs = rs.replace("<!--comment-->", "Der Schülerausweis ist ungültig!");
            s = s.replace("<!--result-->", rs);
        }
    }
    else {
        console.log("No ID Parameter");
        var rs = fs_1.default.readFileSync('src/invalid.html', 'utf8');
        rs = rs.replace("<!--comment-->", "Der Schülerausweis ist ungültig! (missing id Parameter!)");
        s = s.replace("<!--result-->", rs);
    }
    res.statusCode = 200;
    res.send(s);
});
// define a route handler for the default home page
app.get("/log", function (req, res) {
    // render the index template
    res.setHeader("key", obj.auth_token);
    res.send("");
});
/**
 * Endpunkt zum Einloggen als Lehrer
 */
app.post("/log", function (req, res) {
    console.log("user:" + req.body.user);
    console.log("body:" + JSON.stringify(req.body));
    var data = {
        "benutzer": req.body.user,
        "kennwort": req.body.pwd
    };
    var options = {
        hostname: 'diklabu.mm-bbs.de',
        port: 8080,
        path: "/Diklabu/api/v1/auth/login",
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': JSON.stringify(data).length
        }
    };
    var request = https_1.default.request(options, function (result) {
        console.log("statusCode: " + result.statusCode);
        result.on('data', function (d) {
            console.log("data:" + d);
            obj = JSON.parse(d);
            if (result.statusCode == 200) {
                if (obj.role != "Schueler") {
                    var s = fs_1.default.readFileSync('src/index.html', 'utf8');
                    s = s.replace("<!--name-->", obj.ID);
                    console.log("Auth-Token:" + obj.auth_token);
                    keys.push(obj.auth_token);
                    res.setHeader("content-type", "text/html");
                    res.setHeader("key", obj.auth_token);
                    res.send(s);
                }
                else {
                    res.setHeader("content-type", "text/html");
                    var s = fs_1.default.readFileSync('web/login.html', 'utf8');
                    s = s.replace("<!--error-->", "Anmeldung nur als Lehrer möglich");
                    res.send(s);
                }
            }
            else {
                res.setHeader("content-type", "text/html");
                var s = fs_1.default.readFileSync('web/login.html', 'utf8');
                s = s.replace("<!--error-->", obj.message);
                res.send(s);
            }
        });
    });
    request.on('error', function (error) {
        console.error(error);
        var s = fs_1.default.readFileSync('web/login.html', 'utf8');
        s = s.replace("<!--error-->", error.message);
        res.send(s);
    });
    request.write(JSON.stringify(data));
    request.end();
});
/**
 * Dekodieren des QR Codes und Abfrage des Diklabus (nur möglich mit gültigem key im Header)
 */
app.post("/decode", function (req, res) {
    res.setHeader("content-type", "application/json");
    if (req.headers.key) {
        console.log("key=" + req.headers.key);
        if (keys.indexOf(req.headers.key) != -1) {
            console.log("ID:" + req.body.id);
            try {
                res.statusCode = 200;
                var decrypted = key.decrypt(req.body.id, 'utf8');
                console.log("Decrypted:" + decrypted);
                var idcard_1 = new ID_1.ID(decrypted);
                idcard_1.getStudent(req.headers.key.toString()).then(function (s) {
                    //console.log("Result Betrieb" + s.betrieb.NAME);
                    s.idcard = idcard_1;
                    res.json(s);
                }).catch(function (err) {
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
https_1.default.createServer({
    key: fs_1.default.readFileSync('config/server.key'),
    cert: fs_1.default.readFileSync('config/server.cert')
}, app).listen(port, function () {
    console.log("server started at https://localhost:" + port);
    console.log("Gültigkeitsdatum des Ausweises ist " + config_json_1.default.validDate);
});
//# sourceMappingURL=index.js.map