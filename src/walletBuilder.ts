import { createPass, Pass } from "passkit-generator";
import { Student } from "./Student";
//import config from '../config/config.json';
import PDFDocument = require('pdfkit');
import https from "https";
import request = require("request");
import qrImage from "qr-image";
import canvas from 'canvas'
import fs, { appendFile } from 'fs'
import qrcode from 'qrcode'
import { format, parse } from "date-fns";
import fetch from "node-fetch";
import { getTrailingCommentRanges } from "typescript";

export class WalletBuilder {

    constructor() {
    }

    genPng(req:any, res: any, id: string, s: any) {
        console.log("Gen PNG!");
        var config = JSON.parse(fs.readFileSync("config/config.json",'utf8'));
        
        id = id.split("+").join("%2B");
        res.set({
            "Content-type": "image/png",
            "Content-disposition": `attachment; filename=ausweis.png`,
        });
        //res.setHeader('Content-Type', 'image/png');

        try {
            canvas.registerFont('./web/HelveticaNeue-Medium-11.ttf', { family: 'Sans-serif' })
        }
        catch (err) {
            console.log("Font Error:"+err)
        }

        const ca = canvas.createCanvas(config.png.width || 800, config.png.height || 1005)
        const context = ca.getContext('2d')
        canvas.loadImage('./web/img/Ausweis_PNG.png').then(image => {
            context.drawImage(image, 0, 0, config.png.width || 800, config.png.height || 1005)
            let downloadPath =  getDownloadPath(s);
            console.log("Download: "+downloadPath);
            
            if (fs.existsSync(downloadPath)) {
                console.log("Load Image");
                
                canvas.loadImage(downloadPath).then(img => {
                    context.drawImage(img, config.png.idImageX || 535, config.png.idImageY || 147, config.png.idImageWidth || 217, config.png.idImageHeight || 217);
                })
            }

            context.font = config.png.nameFont || 'bold 28pt Sans-serif'
            genAlignment(context, config.png.nameAlign || "start")
            context.fillStyle = config.png.nameColor || '#16538C'
            context.fillText(s.vn.toUpperCase(), config.png.vnameX || 46, config.png.vnameY || 412)
            context.fillText(s.nn.toUpperCase(), config.png.nnameX || 46, config.png.nnameY || 450)
            
            context.font = config.png.validFont || 'bold 22pt Sans-serif'
            genAlignment(context, config.png.validAlign || "start")
            context.fillStyle = config.png.validColor || '#16538C'
            context.fillText(format(new Date(s.v), "dd.MM.yyyy"), config.png.validX || 753, config.png.validY || 450)

            context.font = config.png.birthFont || 'bold 22pt Sans-serif'
            genAlignment(context, config.png.birthAlign || "start")
            context.fillStyle = config.png.birthColor || '#16538C'
            if (s.hasOwnProperty("gd")) {
                context.fillText(format(new Date(s.gd), "dd.MM.yyyy"), config.png.birthX || 46, config.png.birthY || 595)
            }
            else {
                context.fillText("unknown", config.png.birthX || 46, config.png.birthY || 595)
            }

            context.font = config.png.courseFont || 'bold 22pt Sans-serif'
            genAlignment(context, config.png.courseAlign || "start")
            context.fillStyle = config.png.courseColor || '#16538C'
            context.fillText(s.kl, config.png.courseX || 600, config.png.courseY || 85)

            const caqr = canvas.createCanvas(config.png.qrImageWidth || 300, config.png.qrImageWidth || 300)
            qrcode.toCanvas(caqr, req.protocol + '://' + req.get('host') + "/validate?id=" + id, { width: config.png.qrImageWidth || 350 }, err => {
                if (err) {
                    console.log("Error:" + err);
                }
                console.log("success width=" + caqr.width);
                context.drawImage(caqr, config.png.qrImageX || 440, config.png.qrImageY || 540);
            })
            ca.createPNGStream().pipe(res);
        })
    }


    genpdf(req:any, res: any, id: string, s: any) {
        console.log("Gen PDF");
        var config = JSON.parse(fs.readFileSync("config/config.json", 'utf8'));
        id = id.split("+").join("%2B");
        var doc = new PDFDocument({
            size: "A4",
            autoFirstPage: true,
            margin: 25
        });
        //console.log(dateFormat(new Date(s.v), "dd.mm.yyyy"));

        doc.image('./web/img/Ausweis_PDF.png', 20, 20, { width: config.pdf.width || 440 });
        
        let downloadPath = getDownloadPath(s)
        if (fs.existsSync(downloadPath)) {
            doc.image(downloadPath, config.pdf.idImageX || 167.2, config.pdf.idImageY || 60.4, { width: config.pdf.idImageWidth || 59.7, height: config.pdf.idImageHeight || 59.7 });
        }
        
        doc.font(config.pdf.nameFont || './web/HelveticaNeue-Medium-11.ttf').fontSize(config.pdf.nameFontSize || 11);
        console.log("Font loaded!");
        doc.fillColor(config.pdf.nameColor || "#16538C").text(s.vn.toUpperCase(), config.pdf.vnameX || 32, config.pdf.vnameY || 123);
        doc.fillColor(config.pdf.nameColor || "#16538C").text(s.nn.toUpperCase(), config.pdf.nnameX || 32, config.pdf.nnameY || 136);


        doc.font( config.pdf.birthFont || './web/HelveticaNeue-Medium-11.ttf').fontSize( config.pdf.birthFontSize || 6);
        if (s.hasOwnProperty("gd")) {
            doc.text(format(new Date(s.gd), "dd.MM.yyyy"),config.pdf.birthX || 252, config.pdf.birthY || 39);
        }
        else {
            doc.text("unknown", config.pdf.birthX || 252, config.pdf.birthY || 39);
        }

        doc.text(format(new Date(s.v), "dd.MM.yyyy"), config.pdf.validX || 163, config.pdf.validY || 137, {
            width: config.pdf.validWidth || 65,
            align: config.pdf.validAlign || 'right'
        });

        doc.font(config.pdf.courseFont || './web/HelveticaNeue-Medium-11.ttf').fontSize(config.pdf.courseFontSize || 10);
        doc.fillColor(config.pdf.courseColor || "#FFFFFF").text(s.kl, config.pdf.courseX || 190, config.pdf.courseY ||  35);
        try {
            let img = qrImage.imageSync(req.protocol + '://' + req.get('host') +"/validate?id=" + id, { type: 'png', size: 3 });
            doc.image(img, config.pdf.qrImageX || 360, config.pdf.qrImageY || 27, { width: config.pdf.qrImageWidth || 90 })
        }
        catch (err) {
            console.log("Exception:" + err);

        }
        //doc.text("Schuljahr " + config.schuljahr, 29, 158);
        //doc.roundedRect(20, 20, 240, 152, 5);
        //doc.stroke();

        doc.end();
        res.set({
            "Content-type": "application/pdf",
            "Content-disposition": `attachment; filename=ausweis.pdf`,
        });
        doc.pipe(res);

    }

    async genit(req: any, res: any, id: string, s: any) {
        var config = JSON.parse(fs.readFileSync("config/config.json", 'utf8'));
        try {

            const avatar = await fetch(
                req.protocol + "://" + req.get("host") + "/image?id=" + id + "&width=90",
            ).then((re) => re.buffer());

            const additionalBuffers = {
                "thumbnail@2x.png": avatar,
            };
            const examplePass = await createPass({
                model: "./student.pass",
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
            }, additionalBuffers);

            // Adding some settings to be written inside pass.json
            //examplePass.barcode("Test"); 
            examplePass.barcodes({
                message: req.protocol + '://' + req.get('host') + "/validate?id=" + id.split("+").join("%2B"),
                format: "PKBarcodeFormatQR",
                altText: "Gültigkeit prüfen",
                messageEncoding: "iso-8859-1"
            });

            examplePass.headerFields.map(item => {
                this.repaceVales(config,item, s);
            });
            examplePass.primaryFields.map(item => {
                this.repaceVales(config,item, s);
            });
            examplePass.secondaryFields.map(item => {
                this.repaceVales(config,item, s);
            });
            examplePass.auxiliaryFields.map(item => {
                this.repaceVales(config,item, s);
            });

            let d: Date = new Date(config.validDate);
            console.log("Set Wallet expiration Date to " + d);
            examplePass.expiration(d)


            // Generate the stream .pkpass file stream
            const stream = examplePass.generate();
            res.set({
                "Content-type": "application/vnd.apple.pkpass",
                "Content-disposition": `attachment; filename=mmbbs.pkpass`,
            });
            stream.pipe(res);
        } catch (err) {
            console.log('Error:' + err);
        }
    }

    private repaceVales(config,item, s) {

        if (item.key == "valid") {
            console.log("Found Valid and set it to " + config.schuljahr);
            item.value = config.schuljahr;
        }
        if (item.key == "name") {
            console.log("Found Name and set it to " + s.nn);
            item.value = s.nn;
        }
        if (item.key == "surname") {
            console.log("Found Surname and set it to " + s.vn);
            item.value = s.vn;
        }
        if (item.key == "class") {
            console.log("Found class and set it to " + s.kl);
            item.value = s.kl;
        }
        if (item.key == "birthday") {
            if (s.hasOwnProperty("gd")) {
                console.log("Found birthday and set it to " + s.gd);
                item.value = format(new Date(s.gd), "dd.MM.yyyy");
            }
            else {
                console.log("No birthday set !");
                item.value = "unknown";
            }

        }

    }
}
function genAlignment(context: any, arg1: string) {
    switch (arg1) {
        case "start":
            context.textAlign = "start"
            break;
        case "left":
            context.textAlign = "left"
            break;
        case "right":
            context.textAlign = "right"
            break;
        case "center":
            context.textAlign = "center"
            break;
        case "end":
            context.textAlign = "end"
            break;
        default:
            context.textAlign = "start"
            break;
    }
}

function getDownloadPath(s: any):string {
    var crypto = require('crypto');
    var name =  s.kl + "_" + s.nn + "_" + s.vn;
    var hash = crypto.createHash('md5').update(name).digest('hex');
    console.log(hash); 
    return __dirname + '/../config/img_' + hash + ".jpg";
}

