import { createPass, Pass } from "passkit-generator";
import { Student } from "./Student";
import config from '../config/config.json';
import PDFDocument = require('pdfkit');
import https from "https";
import request = require("request");
import qrImage from "qr-image";
import canvas from 'canvas'
import fs from 'fs'
import qrcode from 'qrcode'
import { format, parse } from "date-fns";

export class WalletBuilder {

    constructor() {
    }


    genPng(res: any, id: string, s: any) {
        console.log("Gen PNG!");
        id = id.split("+").join("%2B");
        res.set({
            "Content-type": "image/png",
            "Content-disposition": `attachment; filename=ausweis.png`,
        });
        //res.setHeader('Content-Type', 'image/png');


        try {
            canvas.registerFont('./src/HelveticaNeue-Medium-11.ttf', { family: 'Sans-serif' })
        }
        catch (err) {
            console.log(err)
        }
        
        const ca = canvas.createCanvas(800, 1005)
        const context = ca.getContext('2d')
        canvas.loadImage('./src/Ausweis_PNG.png').then(image => {
            context.drawImage(image, 0, 0, 800, 1005)
            context.font = 'bold 28pt Sans-serif'
            context.textAlign = 'start'
            context.fillStyle = '#16538C'
            let downloadPath = __dirname + '/../config/img_' + s.did + ".jpg";
            if (!fs.existsSync(downloadPath)) {
                downloadPath = __dirname + "/../web/img/anonym.png"
            }
            canvas.loadImage(downloadPath).then(img => {
                context.drawImage(img,550,120,200,200);
            })

            context.fillText(s.vn.toUpperCase(), 46, 412)
            context.fillText(s.nn.toUpperCase(), 46, 450)
            context.font = 'bold 22pt Sans-serif'
            context.textAlign = "right"
            context.fillText(format(new Date(s.v), "dd.MM.yyyy"), 753, 450)
            context.textAlign = "left"
            if (s.hasOwnProperty("gd")) {
                context.fillText(format(new Date(s.gd), "dd.MM.yyyy"), 46, 595)
            }
            else {
                context.fillText("unknown", 46, 595)
            }

            context.fillStyle = '#FFFFFF'
            context.font = 'bold 28pt Sans-serif'
            context.fillText(s.kl, 600, 85)

            const caqr = canvas.createCanvas(300, 300)
            qrcode.toCanvas(caqr, "https://idcard.mmbbs.de/validate?id=" + id, { width: 350 }, err => {
                if (err) {
                    console.log("Error:" + err);
                }
                console.log("success width=" + caqr.width);
                context.drawImage(caqr, 440, 540);
            })
            ca.createPNGStream().pipe(res);
        })
    }


    genpdf(res: any, id: string, s: any) {
        console.log("Gen PDF");
        id = id.split("+").join("%2B");
        var doc = new PDFDocument({
            size: "A4",
            autoFirstPage: true,
            margin: 25
        });
        //console.log(dateFormat(new Date(s.v), "dd.mm.yyyy"));

        doc.image('src/Ausweis_PDF.png', 20, 20, { width: 440 });
        doc.font('./src/HelveticaNeue-Medium-11.ttf').fontSize(11);
        doc.fillColor("#16538C").text(s.vn.toUpperCase(), 32, 123);
        doc.fillColor("#16538C").text(s.nn.toUpperCase(), 32, 136);
        doc.font('./src/HelveticaNeue-Medium-11.ttf').fontSize(6);
        if (s.hasOwnProperty("gd")) {
            doc.text(format(new Date(s.gd), "dd.MM.yyyy"), 252, 39);
        }
        else {
            doc.text("unknown", 252, 39);
        }

        doc.text(format(new Date(s.v), "dd.MM.yyyy"), 163, 137, {
            width: 65,
            align: 'right'
        });
        doc.font('./src/HelveticaNeue-Medium-11.ttf').fontSize(10);
        doc.fillColor("#FFFFFF").text(s.kl, 190, 35);
        try {
            let img = qrImage.imageSync("https://idcard.mmbbs.de/validate?id=" + id, { type: 'png', size: 3 });
            doc.image(img, 360, 27, { width: 90 })
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

    async genit(res: any, id: string, s: any) {
        try {
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
            });

            // Adding some settings to be written inside pass.json
            //examplePass.barcode("Test"); 
            examplePass.barcodes({
                message: "http://idcard.mmbbs.de/validate?id=" + id.split("+").join("%2B"),
                format: "PKBarcodeFormatQR",
                altText: "Gültigkeit prüfen",
                messageEncoding: "iso-8859-1"
            });

            examplePass.headerFields.map(item => {
                this.repaceVales(item, s);
            });
            examplePass.primaryFields.map(item => {
                this.repaceVales(item, s);
            });
            examplePass.secondaryFields.map(item => {
                this.repaceVales(item, s);
            });
            examplePass.auxiliaryFields.map(item => {
                this.repaceVales(item, s);
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

    private repaceVales(item, s) {
        
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
