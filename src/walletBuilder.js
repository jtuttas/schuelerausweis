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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletBuilder = void 0;
var passkit_generator_1 = require("passkit-generator");
var config_json_1 = __importDefault(require("../config/config.json"));
var PDFDocument = require("pdfkit");
var qr_image_1 = __importDefault(require("qr-image"));
var canvas_1 = __importDefault(require("canvas"));
var WalletBuilder = /** @class */ (function () {
    function WalletBuilder() {
    }
    WalletBuilder.prototype.genPng = function (res, id, s) {
        console.log("Gen PNG");
        res.setHeader('Content-Type', 'image/png');
        var ca = canvas_1.default.createCanvas(400, 600);
        var context = ca.getContext('2d');
        canvas_1.default.loadImage('./src/ausweis.png').then(function (image) {
            context.drawImage(image, 0, 0, 400, 600);
            context.font = 'bold 20pt Arial';
            context.textAlign = 'start';
            context.fillStyle = '#00';
            context.fillText(s.nn, 10, 155);
            ca.createPNGStream().pipe(res);
        });
    };
    WalletBuilder.prototype.genpdf = function (res, id, s) {
        console.log("Gen PDF");
        id = id.split("+").join("%2B");
        var doc = new PDFDocument({
            size: "A4",
            autoFirstPage: true,
            margin: 25
        });
        //console.log(dateFormat(new Date(s.v), "dd.mm.yyyy"));
        doc.image('src/Blanko_gesamt.jpg', 20, 20, { width: 440 });
        doc.font('Helvetica-Bold').fontSize(12);
        doc.fillColor("#16538C").text(s.vn, 32, 126);
        doc.fillColor("#16538C").text(s.nn, 32, 138);
        doc.font('Helvetica').fontSize(8);
        doc.text(this.formatDate(new Date(s.gd)), 252, 39);
        doc.text(this.formatDate(new Date(s.v)), 163, 139);
        doc.font('Helvetica').fontSize(10);
        doc.fillColor("#FFFFFF").text(s.kl, 190, 35);
        try {
            var img = qr_image_1.default.imageSync("http://idcard.mmbbs.de/validate?id=" + id, { type: 'png', size: 3 });
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
            "Content-disposition": "attachment; filename=ausweis.pdf",
        });
        doc.pipe(res);
    };
    WalletBuilder.prototype.formatDate = function (v) {
        return "" + v.getDate() + "." + (v.getMonth() + 1) + "." + v.getFullYear();
    };
    WalletBuilder.prototype.genit = function (res, id, s) {
        return __awaiter(this, void 0, void 0, function () {
            var examplePass, d, stream, err_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, passkit_generator_1.createPass({
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
                            })];
                    case 1:
                        examplePass = _a.sent();
                        // Adding some settings to be written inside pass.json
                        //examplePass.barcode("Test"); 
                        examplePass.barcodes({
                            message: "http://idcard.mmbbs.de/validate?id=" + id.split("+").join("%2B"),
                            format: "PKBarcodeFormatQR",
                            altText: "Gültigkeit prüfen",
                            messageEncoding: "iso-8859-1"
                        });
                        examplePass.headerFields.map(function (item) {
                            _this.repaceVales(item, s);
                        });
                        examplePass.primaryFields.map(function (item) {
                            _this.repaceVales(item, s);
                        });
                        examplePass.secondaryFields.map(function (item) {
                            _this.repaceVales(item, s);
                        });
                        examplePass.auxiliaryFields.map(function (item) {
                            _this.repaceVales(item, s);
                        });
                        d = new Date(config_json_1.default.validDate);
                        console.log("Set Wallet expiration Date to " + d);
                        examplePass.expiration(d);
                        stream = examplePass.generate();
                        res.set({
                            "Content-type": "application/vnd.apple.pkpass",
                            "Content-disposition": "attachment; filename=mmbbs.pkpass",
                        });
                        stream.pipe(res);
                        return [3 /*break*/, 3];
                    case 2:
                        err_1 = _a.sent();
                        console.log('Error:' + err_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    WalletBuilder.prototype.repaceVales = function (item, s) {
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
            console.log("Found birthday and set it to " + s.gd);
            item.value = s.gd;
        }
    };
    return WalletBuilder;
}());
exports.WalletBuilder = WalletBuilder;
//# sourceMappingURL=walletBuilder.js.map