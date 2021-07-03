"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DBManager = void 0;
var sqlite3_1 = __importDefault(require("sqlite3"));
var Event_1 = require("./Event");
var DBManager = /** @class */ (function () {
    function DBManager() {
    }
    DBManager.prototype.updateEvent = function (event) {
        return new Promise(function (resolve, reject) {
            var db = new sqlite3_1.default.Database('event.db', function (err) {
                var sql = "UPDATE register SET arrival=datetime('now','localtime') where uuid=\"" + event.uuid + "\";";
                console.log("sql:" + sql);
                db.run(sql, function (err) {
                    if (err) {
                        console.log("Update failed" + err);
                        reject(err);
                        return;
                    }
                    resolve(event);
                });
            });
            db.close();
        });
    };
    DBManager.prototype.setEvent = function (event) {
        return new Promise(function (resolve, reject) {
            var db = new sqlite3_1.default.Database('event.db', function (err) {
                if (err) {
                    reject(err);
                }
                var sql = "INSERT INTO register(email, name, vorname, event, webhook,registered, uuid,eventDate) VALUES (\"" + event.email + "\",\"" + event.name + "\",\"" + event.vorname + "\"," + ((event.eventName == undefined) ? null : "\"" + event.eventName + "\"") + "," + ((event.webhook == undefined) ? null : "\"" + event.webhook + "\"") + ",datetime(\'now\',\'localtime\'),\"" + event.uuid + "\"," + ((event.eventDate == undefined) ? null : "\"" + event.eventDate + "\"") + ");";
                console.log("SQL=" + sql);
                db.run(sql, function (err) {
                    if (err) {
                        console.log("Insert failed" + err);
                        reject(err);
                        return;
                    }
                    resolve(event);
                });
            });
            db.close();
        });
    };
    DBManager.prototype.getEvent = function (uuid) {
        var event = new Event_1.Event();
        event.uuid = uuid;
        return new Promise(function (resolve, reject) {
            var db = new sqlite3_1.default.Database('event.db', function (err) {
                if (err) {
                    reject(err);
                }
                var sql = "select * from register where uuid=\"" + uuid + "\";";
                console.log("sql:" + sql);
                db.all(sql, [], function (err, rows) {
                    if (err) {
                        console.log("SELECT * caused Error");
                        reject(err);
                    }
                    console.log("read:" + JSON.stringify(rows));
                    if (rows.length > 0) {
                        event.name = rows[0].name;
                        event.vorname = rows[0].vorname;
                        event.eventName = rows[0].event;
                        event.eventDate = rows[0].eventDate;
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
            db.close();
        });
    };
    DBManager.prototype.readEvent = function (name, vorname, email, eventName) {
        var event = new Event_1.Event();
        return new Promise(function (resolve, reject) {
            var db = new sqlite3_1.default.Database('event.db', function (err) {
                if (err) {
                    reject(err);
                }
                var sql = "select * from register where name=\"" + name + "\" AND vorname=\"" + vorname + "\" AND email=\"" + email + "\" AND event=\"" + eventName + "\";";
                console.log("sql:" + sql);
                db.all(sql, [], function (err, rows) {
                    if (err) {
                        console.log("SELECT caused Error");
                        reject(err);
                    }
                    console.log("read:" + JSON.stringify(rows));
                    if (rows.length > 0) {
                        event.name = rows[0].name;
                        event.vorname = rows[0].vorname;
                        event.eventName = rows[0].event;
                        event.eventDate = rows[0].eventDate;
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
            db.close();
        });
    };
    return DBManager;
}());
exports.DBManager = DBManager;
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
//# sourceMappingURL=DBManager.js.map