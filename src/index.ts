import express from "express";
import uuid from "uuid"
import path from "path";
import { ID } from "./ID";
import fs from 'fs';
import nodeRSA from 'node-rsa';
import https from "https";

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

app.get("/validate", (req, res) => {
    
    // render the index template
    let s: string = fs.readFileSync('src/validate.html', 'utf8');
    
    if (req.query.id) {
        let sid: string = req.query.id.toString();
        console.log("ID="+sid);
        try {
            let decrypted = key.decrypt(req.query.id.toString(), 'utf8');
            console.log("Decrypted:" + decrypted);
            let obj:ID = JSON.parse(decrypted);
            s = s.replace("<!--result-->", "<p style=\"color: green;\">Der Schülerausweis ist gültig!</p>");
            s=s.replace("<!--date-->","Gültig bis "+obj.v);
        }
        catch (error) {
            console.log(error);
            
            s = s.replace("<!--result-->", "<p style=\"color: red;\">Der Schülerausweis ist ungültig!</p>");
        }
    }
    else {
        console.log("No ID Parameter");
        s = s.replace("<!--result-->","<p style=\"color: red;\">Der Schülerausweis ist ungültig (missing ID Parameter)</p>");
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

app.post("/decode", (req, res) => {
    res.setHeader("content-type","application/json");
    if (req.headers.key) {
        console.log("key="+req.headers.key);
        if (keys.indexOf(req.headers.key)!=-1) {
            console.log("ID:" + req.body.id);
            try {
                res.statusCode = 200;
                let decrypted = key.decrypt(req.body.id, 'utf8');
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