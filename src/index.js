"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var fs_1 = __importDefault(require("fs"));
var node_rsa_1 = __importDefault(require("node-rsa"));
var https_1 = __importDefault(require("https"));
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
app.get("/validate", function (req, res) {
    // render the index template
    var s = fs_1.default.readFileSync('src/validate.html', 'utf8');
    if (req.query.id) {
        var sid = req.query.id.toString();
        console.log("ID=" + sid);
        try {
            var decrypted = key.decrypt(req.query.id.toString(), 'utf8');
            console.log("Decrypted:" + decrypted);
            var obj_1 = JSON.parse(decrypted);
            if (expired(obj_1.v)) {
                var rs = fs_1.default.readFileSync('src/invalid.html', 'utf8');
                rs = rs.replace("<!--comment-->", "Der Schülerausweis ist ungültig (Gültigkeitsdauer überschritten)!");
                s = s.replace("<!--result-->", rs);
            }
            else {
                var rs = fs_1.default.readFileSync('src/valid.html', 'utf8');
                if (underage(obj_1.gd)) {
                    rs = rs.replace("<!--underage-->", "<p style=\"color:red\">minderjährig</p>");
                }
                else {
                    rs = rs.replace("<!--underage-->", "<p style=\"color:green\">volljährig</p>");
                }
                rs = rs.replace("<!--nachname-->", obj_1.nn);
                rs = rs.replace("<!--vorname-->", obj_1.vn);
                rs = rs.replace("<!--klasse-->", obj_1.kl);
                rs = rs.replace("<!--date-->", obj_1.v);
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
                res.json(JSON.parse(decrypted));
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
});
//# sourceMappingURL=index.js.map