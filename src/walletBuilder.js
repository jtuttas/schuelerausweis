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
exports.WalletBuilder = void 0;
const passkit_generator_1 = require("passkit-generator");
const config_json_1 = __importDefault(require("../config/config.json"));
const PDFDocument = require("pdfkit");
const qr_image_1 = __importDefault(require("qr-image"));
const canvas_1 = __importDefault(require("canvas"));
const fs_1 = __importDefault(require("fs"));
const qrcode_1 = __importDefault(require("qrcode"));
const date_fns_1 = require("date-fns");
const node_fetch_1 = __importDefault(require("node-fetch"));
class WalletBuilder {
    constructor() {
    }
    genPng(res, id, s) {
        console.log("Gen PNG!");
        id = id.split("+").join("%2B");
        res.set({
            "Content-type": "image/png",
            "Content-disposition": `attachment; filename=ausweis.png`,
        });
        //res.setHeader('Content-Type', 'image/png');
        try {
            canvas_1.default.registerFont('./src/HelveticaNeue-Medium-11.ttf', { family: 'Sans-serif' });
        }
        catch (err) {
            console.log(err);
        }
        const ca = canvas_1.default.createCanvas(800, 1005);
        const context = ca.getContext('2d');
        canvas_1.default.loadImage('./src/Ausweis_PNG.png').then(image => {
            context.drawImage(image, 0, 0, 800, 1005);
            context.font = 'bold 28pt Sans-serif';
            context.textAlign = 'start';
            context.fillStyle = '#16538C';
            let downloadPath = __dirname + '/../config/img_' + s.did + ".jpg";
            if (!fs_1.default.existsSync(downloadPath)) {
                downloadPath = __dirname + "/../web/img/anonym.png";
            }
            canvas_1.default.loadImage(downloadPath).then(img => {
                context.drawImage(img, 550, 120, 200, 200);
            });
            context.fillText(s.vn.toUpperCase(), 46, 412);
            context.fillText(s.nn.toUpperCase(), 46, 450);
            context.font = 'bold 22pt Sans-serif';
            context.textAlign = "right";
            context.fillText(date_fns_1.format(new Date(s.v), "dd.MM.yyyy"), 753, 450);
            context.textAlign = "left";
            if (s.hasOwnProperty("gd")) {
                context.fillText(date_fns_1.format(new Date(s.gd), "dd.MM.yyyy"), 46, 595);
            }
            else {
                context.fillText("unknown", 46, 595);
            }
            context.fillStyle = '#FFFFFF';
            context.font = 'bold 28pt Sans-serif';
            context.fillText(s.kl, 600, 85);
            const caqr = canvas_1.default.createCanvas(300, 300);
            qrcode_1.default.toCanvas(caqr, "https://idcard.mmbbs.de/validate?id=" + id, { width: 350 }, err => {
                if (err) {
                    console.log("Error:" + err);
                }
                console.log("success width=" + caqr.width);
                context.drawImage(caqr, 440, 540);
            });
            ca.createPNGStream().pipe(res);
        });
    }
    genpdf(res, id, s) {
        console.log("Gen PDF");
        id = id.split("+").join("%2B");
        var doc = new PDFDocument({
            size: "A4",
            autoFirstPage: true,
            margin: 25
        });
        //console.log(dateFormat(new Date(s.v), "dd.mm.yyyy"));
        doc.image('src/Ausweis_PDF.png', 20, 20, { width: 440 });
        let downloadPath = __dirname + '/../config/img_' + s.did + ".jpg";
        if (!fs_1.default.existsSync(downloadPath)) {
            downloadPath = __dirname + "/../web/img/anonym.png";
        }
        doc.image(downloadPath, 180, 60, { width: 50, height: 50 });
        doc.font('./src/HelveticaNeue-Medium-11.ttf').fontSize(11);
        doc.fillColor("#16538C").text(s.vn.toUpperCase(), 32, 123);
        doc.fillColor("#16538C").text(s.nn.toUpperCase(), 32, 136);
        doc.font('./src/HelveticaNeue-Medium-11.ttf').fontSize(6);
        if (s.hasOwnProperty("gd")) {
            doc.text(date_fns_1.format(new Date(s.gd), "dd.MM.yyyy"), 252, 39);
        }
        else {
            doc.text("unknown", 252, 39);
        }
        doc.text(date_fns_1.format(new Date(s.v), "dd.MM.yyyy"), 163, 137, {
            width: 65,
            align: 'right'
        });
        doc.font('./src/HelveticaNeue-Medium-11.ttf').fontSize(10);
        doc.fillColor("#FFFFFF").text(s.kl, 190, 35);
        try {
            let img = qr_image_1.default.imageSync("https://idcard.mmbbs.de/validate?id=" + id, { type: 'png', size: 3 });
            doc.image(img, 360, 27, { width: 90 });
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
    genit(res, id, s) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const avatar = yield node_fetch_1.default("/image?id=" + id + "&width=90").then((re) => re.buffer());
                const additionalBuffers = {
                    "thumbnail@2x.png": avatar,
                };
                const examplePass = yield passkit_generator_1.createPass({
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
                let d = new Date(config_json_1.default.validDate);
                console.log("Set Wallet expiration Date to " + d);
                examplePass.expiration(d);
                // Generate the stream .pkpass file stream
                const stream = examplePass.generate();
                res.set({
                    "Content-type": "application/vnd.apple.pkpass",
                    "Content-disposition": `attachment; filename=mmbbs.pkpass`,
                });
                stream.pipe(res);
            }
            catch (err) {
                console.log('Error:' + err);
            }
        });
    }
    repaceVales(item, s) {
        if (item.key == "valid") {
            console.log("Found Valid and set it to " + config_json_1.default.schuljahr);
            item.value = config_json_1.default.schuljahr;
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
                item.value = date_fns_1.format(new Date(s.gd), "dd.MM.yyyy");
            }
            else {
                console.log("No birthday set !");
                item.value = "unknown";
            }
        }
    }
}
exports.WalletBuilder = WalletBuilder;
//# sourceMappingURL=walletBuilder.js.map