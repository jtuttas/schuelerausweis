import { createPass, Pass } from "passkit-generator";
import { Student } from "./Student";
import config from '../config/config.json';

export class WalletBuilder {
    constructor() {
    }

    async genit(res:any,id:string,s:any) {
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
                altText: "your idCard",
                messageEncoding: "iso-8859-1"
            });

            examplePass.headerFields.map(item => {
                this.repaceVales(item,s);
            });
            examplePass.primaryFields.map(item => {
                this.repaceVales(item,s);
            });
            examplePass.secondaryFields.map(item => {
                this.repaceVales(item,s);
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

    private repaceVales(item,s) {
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

