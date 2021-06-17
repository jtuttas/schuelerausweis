import { createPass, Pass } from "passkit-generator";
import { Student } from "./Student";
import config from '../config/config.json';
import PDFDocument = require('pdfkit');
import https from "https";
import request = require("request");
import qrImage from "qr-image";

export class WalletBuilder {
    constructor() {
    }


    genpdf(res: any, id: string, s: any) {
        console.log("Gen PDF");
        id = id.split("+").join("%2B");
        var doc = new PDFDocument({
            size: "A4",
            autoFirstPage: true,
            margin: 25
        });

        try {
            let img = qrImage.imageSync("http://idcard.mmbbs.de/validate?id=" + id, { type: 'png',size: 3 });
            doc.image(img, 120, 48, { width: 125 })
        }
        catch(err) {
            console.log("Exception:"+err);
            
        }

        doc.image('web/img/ms-icon-70x70.png', 22, 22, { width: 30 });
        doc.font('Helvetica-Bold').fontSize(16);
        doc.text("Schülerausweis MMBbS", 60, 22);
        doc.font('Helvetica-Bold').fontSize(6);
        doc.text("Multi-Media Berufsbildende Schulen, Expo Plaza 3", 60, 38);
        doc.text("30539 Hannover, Tel.: 0511/64 61 98-11", 60, 44);
        doc.font('Helvetica-Bold').fontSize(8);
        doc.text("Name:", 25, 60);
        doc.text("Vorname:", 25, 82);
        doc.text("Klasse:", 25, 104);
        doc.text("Geb. Datum:", 25, 126);
        doc.text("Gültigkeit:", 25, 148);
        doc.font('Helvetica').fontSize(8).fillColor("0x888888");
        doc.text(s.nn, 29, 70);
        doc.text(s.vn, 29, 92);
        doc.text(s.kl, 29, 114);
        doc.text(s.gd, 29, 136);
        doc.text("Schuljahr " + config.schuljahr, 29, 158);
        doc.roundedRect(20, 20, 240, 152, 5);
        doc.stroke();

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
            console.log("Found birthday and set it to " + s.gd);
            item.value = s.gd;
        }

    }
}

