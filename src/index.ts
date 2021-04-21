import express from "express";
import uuid from "uuid"
import path from "path";
import { ID } from "./ID";
import fs from 'fs';
import nodeRSA from 'node-rsa';
import https from "https";
import { Student } from "./Student";

var keys=[];

// Für Testzwecke
keys.push("geheim");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';


let rsakey = fs.readFileSync("config/ausweis.private");
const key = new nodeRSA(rsakey);

const app = express();
const port = 8080; // default port to listen
console.log(__dirname);

app.use(express.static(__dirname + '/../web'));
app.use(express.json())
app.use(express.urlencoded({ extended: true }));


let obj;
function underage(dateString:string):boolean {
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
function expired(dateString:string):boolean {
    if (new Date(dateString) > new Date()) {
        //console.log("valid");
        return false;
    }
    //console.log("expired");
    return true;
}


/**
 * Endpunkt für die Schülerinnen und Schüler Überpfüfen des QR Codes
 */
app.post("/validate", (req, res) => {
    console.log("Body:"+JSON.stringify(req.body));    
    res.setHeader("content-type", "application/json");
    try {
        let decrypted = key.decrypt(req.body.id, 'utf8');
        console.log("Decrypted:" + decrypted);
        let obj = JSON.parse(decrypted);
        obj.valid=true;
        res.send(JSON.stringify(obj));
    }
    catch {
        let obj:any={};
        obj.valid=false;
        obj.msg="failed to decode QRCode!"
        res.send(JSON.stringify(obj));
    }

});

/**
 * Endpunkt für die Schülerinnen und Schüler (Anzeige des Ausweises) 
 */
app.get("/validate", (req, res) => {
    
    // render the index template
    let s: string = fs.readFileSync('src/validate.html', 'utf8');
    s = s.replace("<!--year-->", new Date()).getFullYear());
    
    if (req.query.id) {
        let sid: string = req.query.id.toString();
        console.log("ID="+sid);
        try {
            let decrypted = key.decrypt(req.query.id.toString(), 'utf8');
            console.log("Decrypted:" + decrypted);
            let obj:ID = JSON.parse(decrypted);
            if (expired(obj.v)) {
                let rs: string = fs.readFileSync('src/invalid.html', 'utf8');
                rs = rs.replace("<!--comment-->", "Der Schülerausweis ist ungültig (Gültigkeitsdauer überschritten)!");
                s = s.replace("<!--result-->", rs);
            }
            else {
                let rs: string = fs.readFileSync('src/valid.html', 'utf8');
                if (underage(obj.gd)) {
                    rs = rs.replace("<!--underage-->", "<p class=\"col-12 col-sm-4 fs-5 underage fw-light\" style=\"color: #ff3131\">minderjährig</p>");
                }
                else {
                    rs = rs.replace("<!--underage-->", "<p class=\"col-12 col-sm-4 fs-5 underage fw-light\" style=\"color: #05b936\">volljährig</p>");

                }
                rs = rs.replace("<!--nachname-->", obj.nn);
                rs = rs.replace("<!--vorname-->", obj.vn);
                rs = rs.replace("<!--klasse-->", obj.kl);
                rs = rs.replace("<!--date-->", obj.v);
                s = s.replace("<!--result-->",rs);
            }
        }
        catch (error) {
            console.log(error);
            let rs: string = fs.readFileSync('src/invalid.html', 'utf8');
            rs = rs.replace("<!--comment-->", "Der Schülerausweis ist ungültig!");
            s = s.replace("<!--result-->", rs);
        }
    }
    else {
        console.log("No ID Parameter");
        let rs: string = fs.readFileSync('src/invalid.html', 'utf8');
        rs = rs.replace("<!--comment-->", "Der Schülerausweis ist ungültig! (missing id Parameter!)");
        s = s.replace("<!--result-->", rs);
    }
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
    console.log("user:"+req.body.user);
    console.log("body:"+JSON.stringify(req.body));
  
    let data = {
        "benutzer":req.body.user,
        "kennwort":req.body.pwd
    }

    let options = {
        hostname: 'diklabu.mm-bbs.de',
        port: 8080,
        path: "/Diklabu/api/v1/auth/login",
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': JSON.stringify(data).length
        }
    }

    let request = https.request(options, result => {
        console.log(`statusCode: ${result.statusCode}`)

        result.on('data', d => {
            console.log("data:"+d);
            obj = JSON.parse(d);
            if (result.statusCode==200) {
                if (obj.role!="Schueler") {
                    let s: string = fs.readFileSync('src/index.html', 'utf8');
                    s = s.replace("<!--name-->", obj.ID);
                    console.log("Auth-Token:"+obj.auth_token);
                    
                    keys.push(obj.auth_token);
                    res.setHeader("content-type", "text/html");
                    res.setHeader("key", obj.auth_token);
                    res.send(s);
                }
                else {
                    res.setHeader("content-type", "text/html");
                    let s: string = fs.readFileSync('web/login.html', 'utf8');
                    s = s.replace("<!--error-->", "Anmeldung nur als Lehrer möglich");
                    res.send(s);
                }
            }
            else {
                res.setHeader("content-type", "text/html");
                let s: string = fs.readFileSync('web/login.html', 'utf8');
                s = s.replace("<!--error-->", obj.message);
                res.send(s);
            }

        })
    })

    request.on('error', error => {
        console.error(error)
        let s: string = fs.readFileSync('web/login.html', 'utf8');
        s = s.replace("<!--error-->", error.message);
        res.send(s);
    })

    request.write(JSON.stringify(data))
    request.end()

});

/**
 * Dekodieren des QR Codes und Abfrage des Diklabus (nur möglich mit gültigem key im Header)
 */
app.post("/decode", (req, res) => {
    res.setHeader("content-type","application/json");
    if (req.headers.key) {
        console.log("key="+req.headers.key);
        if (keys.indexOf(req.headers.key)!=-1) {
            console.log("ID:" + req.body.id);
            try {
                res.statusCode = 200;
                let decrypted = key.decrypt(req.body.id, 'utf8');
                console.log("Decrypted:"+decrypted);
                
                let idcard:ID=new ID(decrypted);                
                idcard.getStudent(req.headers.key.toString()).then((s: Student) => {
                    //console.log("Result Betrieb" + s.betrieb.NAME);
                    s.idcard=idcard;
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
        res.statusCode=401;
        res.send('{"msg":"no key"}');
    }
});



https.createServer({
    key: fs.readFileSync('config/server.key'),
    cert: fs.readFileSync('config/server.cert')
}, app).listen(port, function () {
        console.log(`server started at https://localhost:${port}`);
    });