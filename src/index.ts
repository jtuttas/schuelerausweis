import express from "express";
import uuid from "uuid"
import path from "path";
import { ID } from "./ID";
import fs from 'fs';
import nodeRSA from 'node-rsa';
import https from "https";
import { Student } from "./Student";
import { format } from "date-fns";
import { WalletBuilder } from "./walletBuilder";
import config from '../config/config.json';
import qrImage from "qr-image";
import { v4 } from 'uuid';
import sqlite3 from "sqlite3";
import { registerFont } from "pdfkit/js/mixins/fonts";
import { readShort } from "pdfkit/js/data";
import request from "request";
import { genPDFTicket, genWalletTicket, handleGet, handlePost, handlePut } from "./Event";
import fileUpload from "express-fileupload"
import sh from "sharp"
import { parse } from 'csv-parse/sync';
import { MailSender } from "./MailSender";
import { MailObject } from "./MailObject";

var keys = [];
let students: any = {
};
let mailsender: MailSender;

if (fs.existsSync("config/students.csv")) {
    console.log("Students.CSV gefunden, importiere Daten");
    const records = parse(fs.readFileSync("config/students.csv", 'latin1'), {
        delimiter: ';',
        from_line: 2,
        trim: true
    });
    //console.log(JSON.stringify(records));
    var p=0;
    records.forEach((element:string) => {
        if (element[0].length==0) {
            console.log("Keine EMail Adresse im Datensatz "+JSON.stringify(element));            
        }
        else if (element[1].length==0) {
            console.log("Kein Vorname im Datensatz " + JSON.stringify(element));            
        }
        else if (element[2].length==0) {
            console.log("Kein Nachname im Datensatz " + JSON.stringify(element));            
        }
        else if (element[3].length==0) {
            console.log("Kein Geburtsdatum im Datensatz " + JSON.stringify(element));            
        }
        else if (element[4].length==0) {
            console.log("Keine Klassenbezeichnung im Datensatz " + JSON.stringify(element));            
        }
        else {
            students[element[0]] = element;
            p++;
        }
    });
    //console.log(JSON.stringify(students));
    console.log(p+" Datensatze von "+records.length+" verareitet");
    
    mailsender = new MailSender();

}

// Für Testzwecke
//keys.push("geheim");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';


let rsakey = fs.readFileSync("config/ausweis.private");
const key = new nodeRSA(rsakey);

const app = express();
const port = 8080; // default port to listen
console.log(__dirname);

app.use(fileUpload());
app.use(express.static(__dirname + '/../web'));
app.use(express.json())
app.use(express.urlencoded({ extended: true }));

var wb: WalletBuilder = new WalletBuilder();

let obj;
function underage(dateString: string): boolean {
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
function expired(dateString: string): boolean {
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
    }
    if (!req.files) {
        result.msg = "No files were uploaded!!"
        return res.status(400).send(JSON.stringify(result));
    }
    if (Object.keys(req.files).length === 0) {
        result.msg = "No files were uploaded!"
        return res.status(400).send(JSON.stringify(result));
    }

    try {
        let id: string = req.query.id.toString()
        id = id.split(" ").join("+");
        console.log("ID is " + id);
        let decrypted = key.decrypt(id, 'utf8');
        let obj = JSON.parse(decrypted);
        console.log("Decrypted:" + decrypted);

        // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
        sampleFile = req.files.image;
        console.log("File name:" + sampleFile);
        let filename: string = sampleFile.name;

        let parts = filename.split(".")
        let suffix = parts[parts.length - 1];
        console.log("Suffix is: " + suffix);;
        var crypto = require('crypto');
        var name = obj.kl + "_" + obj.nn + "_" + obj.vn;
        var hash = crypto.createHash('md5').update(name).digest('hex');
        console.log(hash);

        uploadPath = __dirname + '/../config/img' + hash + ".jpg";
        scaledPath = __dirname + '/../config/img_' + hash +  ".jpg";

        // Use the mv() method to place the file somewhere on your server
        sampleFile.mv(uploadPath, function (err) {
            if (err) {
                result.msg = err
                return res.status(500).send(JSON.stringify(result));
            }
            console.log("Image uploaded to: " + uploadPath);
            var sizeOf = require('image-size');
            var dimensions = sizeOf(uploadPath);
            console.log(dimensions.width, dimensions.height);
            if (dimensions.width > 5000 || dimensions.height > 5000) {
                console.log("To large Image");
                fs.unlinkSync(uploadPath)
                result.msg = "Image to large!"
                return res.status(400).send(JSON.stringify(result));

            }

            try {

                let inStream = fs.createReadStream(uploadPath);
                var transformer = sh()
                    .resize(500, 500)
                    .on('info', function (info) {
                        console.log('Image height is ' + info.height);
                    });
                let outStream = fs.createWriteStream(scaledPath, { flags: "w" });

                var transformer = sh()
                    .resize(500, 500)

                    .on('info', function (info) {
                        console.log('Image height is ' + info.height);
                    });

                let err: boolean = false;
                transformer.on('error', () => {
                    console.log("error");
                    err = true;
                })
                inStream.pipe(transformer).pipe(outStream)
                outStream.on('close', () => {
                    console.log("close out Stream");
                    if (err) {
                        fs.unlinkSync(uploadPath)
                        fs.unlinkSync(scaledPath)
                        res.status(500)
                        result.sucess = false
                        result.msg = "Fehler beim Upload"
                        res.send(JSON.stringify(result));
                    }
                    else {
                        fs.unlinkSync(uploadPath)
                        res.status(200)
                        result.sucess = true
                        result.msg = "Image Uploaded and Scaled"
                        res.send(JSON.stringify(result));

                    }
                })
            } catch (error) {
                console.log("Err:" + error);
                res.status(500)
                result.sucess = false
                result.msg = "Fehler beim Upload"
                res.send(JSON.stringify(result));
            }

        });
    }
    catch {
        result.sucess = false
        result.msg = 'Unknown or invalid id'
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
    }

    try {
        let id: string = req.query.id.toString()
        id = id.split(" ").join("+");
        console.log("ID is " + id);
        let decrypted = key.decrypt(id, 'utf8');
        console.log("Decrypted:" + decrypted);
        let obj = JSON.parse(decrypted);

        var crypto = require('crypto');
        var name = obj.kl + "_" + obj.nn + "_" + obj.vn;
        var hash = crypto.createHash('md5').update(name).digest('hex');
        console.log(hash);

        let downloadPath = __dirname + '/../config/img_' + hash +  ".jpg";
        console.log("return Image:" + downloadPath);

        try {

            if (fs.existsSync(downloadPath)) {
                if (!req.query.width) {
                    res.setHeader("content-type", "image/jpeg");
                    res.sendFile(path.resolve(downloadPath));
                }
                else {
                    console.log("Mit Width Parameter");
                    res.setHeader("content-type", "image/jpeg");
                    let w: number = Number(req.query.width.toString());
                    console.log("Start resize:" + w);


                    let inStream = fs.createReadStream(downloadPath);
                    var transformer = sh()
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
        } catch (err) {
            res.setHeader("content-type", "application/json");
            result.sucess = false;
            result.msg = err;
            res.status(400).send(JSON.stringify(result));
        }
    }
    catch (err) {
        console.log("Fehler: " + err);

        res.setHeader("content-type", "application/json");
        result.sucess = false
        result.msg = 'Unknown or invalid ID'
        res.status(400).send(JSON.stringify(result));

    }
});


/**
 * Event Ticket als Wallet
 */
app.get("/eventwallet", genWalletTicket);

/**
 * Event Ticket als PDF
 */
app.get("/eventpdf", genPDFTicket);
/**
 * Ankunft Arrival
 */
app.put("/event", handlePut);

/**
 * Endpunkt Anmeldung zu einem Event abfragen
 */
app.get("/event", handleGet);

/**
 * Endpunkt Anmeldung zu einem Event
 */
app.post("/event", handlePost);

/**
Endpunkt zum Erzeugen von QR Codes als Image
*/
app.get('/qrcode', function (req, res) {
    if (req.query.data) {
        var code = qrImage.image(req.query.data.toString(), { type: 'png' });
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
    let obj: any = {};
    if (req.query.id) {
        let sid: string = req.query.id.toString();
        console.log("ID=" + sid);
        try {
            let decrypted = key.decrypt(req.query.id.toString(), 'utf8');
            console.log("Decrypted:" + decrypted);
            let obj = JSON.parse(decrypted);
            wb.genPng(req,res, sid, obj);
        }
        catch {
            console.log("Failed to Decode!");

            obj.valid = false;
            obj.msg = "failed to decode id!"
            res.setHeader("content-type", "application/json");
            res.send(JSON.stringify(obj));
        }
    }
    else {
        res.setHeader("content-type", "application/json");
        obj.valid = false;
        obj.msg = "no id Param"
        res.send(JSON.stringify(obj));
    }
});

/**
 * Endpunkt Zum erzeugen eines Schülerausweises als pdf
 */
app.get("/pdf", (req, res) => {
    let obj: any = {};
    if (req.query.id) {
        let sid: string = req.query.id.toString();
        console.log("ID=" + sid);
        try {
            let decrypted = key.decrypt(req.query.id.toString(), 'utf8');
            console.log("Decrypted:" + decrypted);
            let obj = JSON.parse(decrypted);
            wb.genpdf(req,res, sid, obj);
        }
        catch {
            console.log("Failed to Decode!");

            obj.valid = false;
            obj.msg = "failed to decode id!"
            res.setHeader("content-type", "application/json");
            res.send(JSON.stringify(obj));
        }
    }
    else {
        res.setHeader("content-type", "application/json");
        obj.valid = false;
        obj.msg = "no id Param"
        res.send(JSON.stringify(obj));
    }
});

/**
 * Endpunkt Zum erzeugen eines ioS Wallets
 */
app.get("/iwallet", (req, res) => {
    let obj: any = {};
    if (req.query.id) {
        let sid: string = req.query.id.toString();
        console.log("ID=" + sid);
        //console.log("Server "+req.get("host"));

        try {
            let decrypted = key.decrypt(req.query.id.toString(), 'utf8');
            console.log("Decrypted:" + decrypted);
            let obj = JSON.parse(decrypted);
            wb.genit(req, res, sid, obj);
        }
        catch {
            console.log("Failed to Decode!");

            obj.valid = false;
            obj.msg = "failed to decode id!"
            res.setHeader("content-type", "application/json");
            res.send(JSON.stringify(obj));
        }
    }
    else {
        res.setHeader("content-type", "application/json");
        obj.valid = false;
        obj.msg = "no id Param"
        res.send(JSON.stringify(obj));
    }

});

/**
 * Endpunkt zum Einloggen als Schüler 
 */
app.post("/wallet", (req, res) => {
    console.log("user:" + req.body.user);
    console.log("body:" + JSON.stringify(req.body));



    let obj: any = {};
    let obj2: any = {};

    let user: string = req.body.user
    user = user.trim()
    let pwd: string = req.body.pwd
    //pwd =decodeURIComponent(pwd)
    let data = {
        "benutzer": user,
        "kennwort": pwd
    }
    console.log("data:" + JSON.stringify(data));


    if (students.size != 0) {
        if (students[data.benutzer] != undefined) {
            console.log("Found " + data.benutzer);
            res.setHeader("content-type", "text/html");
            let s: string = fs.readFileSync('web/confirm.htm', 'utf8');
            let student: any = {};
            student.nn = students[data.benutzer][2];
            student.vn = students[data.benutzer][1];
            student.kl = students[data.benutzer][4];
            student.v = config.validDate;
            student.gd = students[data.benutzer][3];
            student.did = 0;
            console.log("student:" + JSON.stringify(student));

            let id = key.encrypt(JSON.stringify(student), 'base64');
            console.log("id=" + id);
            id = id.split("+").join("%2B");

            let mo: MailObject = new MailObject();
            mo.from = config.mailfrom
            mo.to = data.benutzer;
            mo.subject = config.mailSubject;
            mo.text = config.mailHeader + req.protocol + '://' + req.get('host') + req.url + "?id=" + id + "\r\n\r\n" + config.mailFooter;

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
            let s: string = fs.readFileSync('web/index.htm', 'utf8');
            s = s.replace("<!--error-->", "eMail Adresse unbekannt!");
            res.send(s);
            return
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
        }

        if (req.body.pwd == "mmbbs@ExpoPlaza3") {
            console.log("Default Password used");

            res.setHeader("content-type", "text/html");
            let s: string = fs.readFileSync('web/index.html', 'utf8');
            s = s.replace("<!--error-->", "Anmeldedaten ungültig!");
            res.send(s);
            return
        }
        let request = https.request(options, result => {
            console.log(`statusCode: ${result.statusCode}`)

            result.on('data', d => {
                console.log("data:" + d);

                if (result.statusCode == 200) {
                    obj = JSON.parse(d);
                    if (obj.success == false) {
                        res.setHeader("content-type", "text/html");
                        let s: string = fs.readFileSync('web/index.html', 'utf8');
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
                        }
                        let request2 = https.request(options2, result2 => {
                            console.log(`statusCode: ${result2.statusCode}`)
                            result2.on('data', d2 => {
                                console.log("data2:" + d2);
                                obj2 = JSON.parse(d2);

                                let student: any = {};
                                student.nn = obj.NNAME;
                                student.vn = obj.VNAME;
                                student.kl = obj.nameKlasse;
                                student.v = config.validDate;
                                student.gd = obj2.gebDatum;
                                student.did = obj.idPlain;

                                let id = key.encrypt(JSON.stringify(student), 'base64');
                                console.log("id=" + id);
                                id = id.split("+").join("%2B");

                                let s: string = fs.readFileSync('web/idcards.html', 'utf8');
                                //s = s.replace("<!--wallet-->", "/wallet?id=" + id);
                                s = s.replace("<!--sj-->", config.schuljahr);
                                s = s.replace("<!--pdf-->", "/pdf?id=" + id);
                                s = s.replace("<!--png-->", "/png?id=" + id);
                                s = s.replaceAll("<!--id-->", id);
                                var crypto = require('crypto');
                                var name = student.kl + "_" + student.nn + "_" + student.vn;
                                var hash = crypto.createHash('md5').update(name).digest('hex');
                                console.log(hash);

                                let downloadPath = __dirname + '/../config/img_' + hash + ".jpg";
                                if (fs.existsSync(downloadPath)) {
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
                            })

                        })

                        request2.on('error', error => {
                            console.error("Error" + error)
                        })
                        request2.write("")
                        request2.end()

                    }
                    else {
                        res.setHeader("content-type", "text/html");
                        let s: string = fs.readFileSync('web/index.html', 'utf8');
                        s = s.replace("<!--error-->", "Anmeldung nur als Schüler möglich");
                        res.send(s);
                    }
                }
                else if (result.statusCode == 400) {
                    res.setHeader("content-type", "text/html");
                    let s: string = fs.readFileSync('web/index.html', 'utf8');
                    s = s.replace("<!--error-->", "Error 400");
                    res.send(s);

                }
                else {
                    obj = JSON.parse(d);
                    res.setHeader("content-type", "text/html");
                    let s: string = fs.readFileSync('web/index.html', 'utf8');
                    s = s.replace("<!--error-->", "Anmeldedaten ungültig");
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
            let decrypted:any = key.decrypt(id, 'utf8');

            console.log("Decrypted:" + decrypted);
            id = id.split("+").join("%2B");

            obj = JSON.parse(decrypted);
            let s:string = fs.readFileSync("web/idcards.htm",'utf8');
            //console.log("read:"+s.length);
            
            s = s.replace("<!--sj-->", config.schuljahr);
            s = s.replace("<!--username-->", obj.vn +"&nbsp;"+obj.nn);
            s = s.replace("<!--pdf-->", "/pdf?id=" + id);
            s = s.replace("<!--png-->", "/png?id=" + id);
            s = s.replace(/<!--id-->/g, id);
            
            var crypto = require('crypto');
            var name = obj.kl + "_" + obj.nn + "_" + obj.vn;
            var hash = crypto.createHash('md5').update(name).digest('hex');
            console.log(hash);

            let downloadPath = __dirname + '/../config/img_' + hash + ".jpg";
            if (fs.existsSync(downloadPath)) {
                console.log("Image Found: " + downloadPath);
                s = s.replace("<!--img-->", "/image?id=" + id + "&width=90");
            }
            else {
                console.log("No Image Found:" + downloadPath);
                s = s.replace("<!--img-->", "img/anonym_210x210.jpg");

            }

            s = s.replace("<!--wallet-->", "/iwallet?id=" + id);
            //s = s.replace("<!--link-->", "/validate?id=" + id);
           s = s.replace("<!--qrcode-->", "/qrcode?data=" + encodeURIComponent(req.protocol + '://' + req.get('host') + "/iwallet?id="+ id));
            res.send(s);
            console.log("Sending Welcome Page");
            

        }
       
        catch (e) {
            console.log("Exception!!"+JSON.stringify(e));
            
            let obj: any = {};
            res.send(fs.readFileSync("web/404.htm", 'utf8'));
        }
    
    }
    else {
        res.send(fs.readFileSync("web/404.htm", 'utf8'));
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
    catch {
        let obj: any = {};
        obj.valid = false;
        obj.msg = "failed to decode QRCode!"
        res.send(JSON.stringify(obj));
    }

});

/**
 * Endpunkt für die Schülerinnen und Schüler (Anzeige des Ausweises) 
 */
app.get("/validate", (req, res) => {

    // render the index template
    let s: string = fs.readFileSync('web/validate.html', 'utf8');
    s = s.replace("<!--year-->", "" + new Date().getFullYear());

    if (req.query.id) {
        let sid: string = req.query.id.toString();
        console.log("ID=" + sid);
        try {
            let decrypted = key.decrypt(req.query.id.toString(), 'utf8');
            console.log("Decrypted:" + decrypted);
            let obj: ID = JSON.parse(decrypted);
            if (expired(obj.v)) {
                let rs: string = fs.readFileSync('web/invalid.html', 'utf8');
                rs = rs.replace("<!--comment-->", "Gültigkeitsdauer überschritten");
                rs = rs.replace("<!--nachname-->", obj.nn);
                rs = rs.replace("<!--vorname-->", obj.vn);
                rs = rs.replace("<!--klasse-->", obj.kl);
                if (obj.hasOwnProperty("gd")) {
                    rs = rs.replace("<!--birthday-->", format(new Date(obj.gd), "dd.MM.yyyy"));
                }
                else {
                    rs = rs.replace("<!--birthday-->", "unknown");
                }
                rs = rs.replace("<!--date-->", format(new Date(obj.v), "dd.MM.yyyy"));
                s = s.replace("<!--result-->", rs);
            }
            else {
                let rs: string = fs.readFileSync('web/valid.html', 'utf8');
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
                    rs = rs.replace("<!--birthday-->", format(new Date(obj.gd), "dd.MM.yyyy"));
                }
                else {
                    rs = rs.replace("<!--birthday-->", "unknown");
                }
                rs = rs.replace("<!--date-->", format(new Date(obj.v), "dd.MM.yyyy"));
                s = s.replace("<!--result-->", rs);
            }
        }
        catch (error) {
            console.log(error);
            let rs: string = fs.readFileSync('web/invalid.html', 'utf8');
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
        let rs: string = fs.readFileSync('web/invalid.html', 'utf8');
        rs = rs.replace("<!--comment-->", "fehlender id Parameter!");
        rs = rs.replace("<!--nachname-->", "---");
        rs = rs.replace("<!--vorname-->", "---");
        rs = rs.replace("<!--klasse-->", "---");
        rs = rs.replace("<!--birthday-->", "---");
        rs = rs.replace("<!--date-->", "---");

        s = s.replace("<!--result-->", rs);
    }
    let date: Date = new Date()
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
    }

    let options = {
        hostname: 'diklabu.mm-bbs.de',
        port: 8080,
        path: "/Diklabu/api/v1/auth/login",
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
        }
    }

    let request = https.request(options, result => {
        console.log(`statusCode: ${result.statusCode}`)

        result.on('data', d => {
            console.log("data:" + d);
            obj = JSON.parse(d);
            if (result.statusCode == 200) {
                if (obj.role != "Schueler") {
                    let s: string = fs.readFileSync('src/index.html', 'utf8');
                    s = s.replace("<!--name-->", obj.ID);
                    console.log("Auth-Token:" + obj.auth_token);

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
    res.setHeader("content-type", "application/json");
    if (req.headers.key) {
        console.log("key=" + req.headers.key);
        if (keys.indexOf(req.headers.key) != -1) {
            console.log("ID:" + req.body.id);
            try {
                res.statusCode = 200;
                let decrypted = key.decrypt(req.body.id, 'utf8');
                console.log("Decrypted:" + decrypted);

                let idcard: ID = new ID(decrypted);
                idcard.getStudent(req.headers.key.toString()).then((s: Student) => {
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



process.env.TZ = 'Europe/Amsterdam'
https.createServer({
    key: fs.readFileSync('config/server.key'),
    cert: fs.readFileSync('config/server.cert')
}, app).listen(port, function () {
    console.log(`server started at https://localhost:${port}`);
    console.log("Gültigkeitsdatum des Ausweises ist " + config.validDate);

});