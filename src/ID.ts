import { Student } from "./Student";
import { request, RequestOptions } from "https";
import iconv from "iconv-lite"

export class ID {
    // Nachname
    nn: string;
    // Vorname
    vn: string;
    // Klasse
    kl: string;
    // EMail
    //em:string;
    // Gültigkeitsdatum
    v: string;
    // Geburtsdatum
    gd: string;
    // Diklabuid
    did: number;
    // BBS Planung ID
    bpid: number;

    constructor (json:string) {
        let obj:ID=JSON.parse(json);
        this.bpid=obj.bpid;
        this.did=obj.did
        this.gd=obj.gd
        this.kl=obj.kl
        this.nn=obj.nn
        this.v=obj.v
        this.vn=obj.vn
    }

    getStudent(key: string): Promise<Student> {
        console.log("get Student id "+this.did);
        let options: RequestOptions = {
            hostname: 'diklabu.mm-bbs.de',
            port: 8080,
            path: "/Diklabu/api/v1/schueler/"+this.did,
            method: 'GET',
            
            headers: {
                'content-type': 'application/json;charset=iso-8859-1',
                'auth_token': key
            }
        }

        return new Promise((resolve, reject) => {
            request(options, (res) => {
                if (res.statusCode==204) {
                    resolve(JSON.parse("{}"));
                }
                res.on('data', d => {                    
                    var buffer = Buffer.from(d);
                    var str = iconv.decode(buffer, 'iso-8859-1');
                    console.log("data:" + str);
                    let obj = JSON.parse(str)
                    resolve(JSON.parse(str));
                });
                res.on('error', err => {
                    console.log("err:" + err);
                    reject(err);

                })
            }
            ).end();
        });
    }

}

/*
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
let id: ID = new ID("{}");
id.did = 7960
id.getStudent("c6ef540c-84d1-4f3f-87a1-088241519c3f").then((s: Student) => {
    console.log("Result Betrieb" + s.betrieb.NAME);
}).catch(err => {
    console.log("Error: " + err);

});
*/
