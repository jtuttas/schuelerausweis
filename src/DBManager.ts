import sqlite3 from "sqlite3";
import { Event } from "./Event"

export class DBManager {

    public updateEvent(event: Event): Promise<Event> {
        return new Promise((resolve, reject) => {
            let db = new sqlite3.Database('event.db', (err) => {
                let sql = "UPDATE register SET arrival=datetime('now','localtime') where uuid=\"" + event.uuid + "\";";
                console.log("sql:" + sql);
                db.run(sql, (err) => {
                    if (err) {
                        console.log("Update failed" + err);
                        reject(err)
                        return;
                    }
                    resolve(event);
                });
            });
            db.close()
        });
    }

    public setEvent(event: Event): Promise<Event> {
        return new Promise((resolve, reject) => {
            let db = new sqlite3.Database('event.db', (err) => {
                if (err) {
                    reject(err)
                }
                let sql = "INSERT INTO register(email, name, vorname, event, webhook,registered, uuid) VALUES (\"" + event.email + "\",\"" + event.name + "\",\"" + event.vorname + "\"," + ((event.eventName == undefined) ? null : "\"" + event.eventName + "\"") + "," + ((event.webhook == undefined) ? null : "\"" + event.webhook + "\"") + ",datetime(\'now\',\'localtime\'),\"" + event.uuid + "\");";
                console.log("SQL="+sql);
                
                
                db.run(sql, (err) => {
                    if (err) {
                        console.log("Insert failed" + err);
                        reject(err)
                        return;
                    }
                    resolve(event);
                });
            });
            db.close()
        });
    }


    public getEvent(uuid: string): Promise<Event> {
        let event: Event = new Event();
        event.uuid = uuid;
        return new Promise((resolve, reject) => {
            let db = new sqlite3.Database('event.db', (err) => {
                if (err) {
                    reject(err)
                }
                let sql = "select * from register where uuid=\"" + uuid + "\";";
                console.log("sql:" + sql);
                db.all(sql, [], (err, rows) => {
                    if (err) {
                        console.log("SELECT * caused Error");
                        reject(err)
                    }
                    console.log("read:" + JSON.stringify(rows));
                    if (rows.length > 0) {
                        event.name = rows[0].name;
                        event.vorname = rows[0].vorname;
                        event.eventName = rows[0].event;
                        event.webhook = rows[0].webhook;
                        event.email = rows[0].email;
                        event.registered = rows[0].registered;
                        event.arrival = rows[0].arrival;
                        resolve(event);
                    }
                    else {
                        resolve(null);
                    }
                });
            });
            db.close()
        });
    }

    public readEvent(name: string,vorname:string,email:String,eventName:string): Promise<Event> {
        let event: Event = new Event();
        return new Promise((resolve, reject) => {
            let db = new sqlite3.Database('event.db', (err) => {
                if (err) {
                    reject(err)
                }
                let sql = "select * from register where name=\"" + name + "\" AND vorname=\""+vorname+"\" AND email=\""+email+"\" AND event=\""+eventName+"\";";
                console.log("sql:" + sql);
                db.all(sql, [], (err, rows) => {
                    if (err) {
                        console.log("SELECT caused Error");
                        reject(err)
                    }
                    console.log("read:" + JSON.stringify(rows));
                    if (rows.length > 0) {
                        event.name = rows[0].name;
                        event.vorname = rows[0].vorname;
                        event.eventName = rows[0].event;
                        event.uuid = rows[0].uuid;
                        event.webhook = rows[0].webhook;
                        event.email = rows[0].email;
                        event.registered = rows[0].registered;
                        event.arrival = rows[0].arrival;
                        resolve(event);
                    }
                    else {
                        resolve(null);
                    }
                });
            });
            db.close()
        });
    }
}

/*
let dbm: DBManager = new DBManager();
let e: Event = new Event("Test", "Demo", "test@Demo.de");
e.uuid = "12345"
e.eventName = "MMBBS"
e.webhook = "https://prod-140.westeurope.logic.azure.com:443/workflows/01acc4885c2a4075bbcc0f3a5b1ca97f/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=CLbmOOO1qehi_7SWRicP4ZgTAI7JG4RECuqBxVY1aO8"
//console.log(JSON.stringify(e));

e.fireWebhook().then((ev: Event) => {
    console.log("!!WebHook" + JSON.stringify(ev));
}).catch(err => {

    console.log("Fehler:" + err);
});
*/
/*
dbm.getEvent("eeedd5e4-60a7-4720-b1ae-77d1a0c4aa7b").then((e:Event)=> {
    console.log("Habe Event gelesen: "+JSON.stringify(e));

}).catch(err => {
    console.log(err);

});
*/