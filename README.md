# elektronisch lesbarer Schülerausweis

Die Hauptentwicklungspunkte bei dieser Anwendung war es einen **elektronisch lesbaren** und **fälschungssicheren** Schülerausweis zu erzeugen!

Der Ausweis enthält daher ein als RSA verschlüsseltes JSON, welches die folgenden Daten beinhaltet.

```JSON
{
  "nn": "Mustermann", // Nachname
  "vn": "Max", // Vorname
  "kl": "FIAE20J", // Klasse
  "v": "2021-08-01", // Gültigkeitsdatum
  "gd": "1997-04-11", // Geburtsdatum
  "did": 1234, // Diklabu ID
  "bpid": 5678, // BBS Planung ID
}
```

Der Schlüssel zum Entschlüsseln dieses JSON befindet sich auf dem Server. Über eine Anfrage https://IP-des-Servers/validate?id=geheim können die Daten durch den Server entschlüsselt werden. Das Ergebnis wird als HTLM Seite angezeigt.

![valid](ScreenshotValid.png)
![invalid](ScreenshotInvalid.png)

Der Ausweis wird in Form einer Grafik (png), als pdf oder als IOS Wallet heraus gegeben und enthält den QR Code der zum validieren des Ausweises genutzt wird.
![Auseis](ausweisMaxMustermann.png)

![seqSchueler](seqSchueler.png)

## Konfiguration

Alle wichtigen Dateien befinden sich im Ordner **config**. Hier finden sich die notwendigen Schlüssel für die Ver- / Entschlüsselung, wie auch die Zertifikate für die https Verbindung und die Dateien für das Apple Wallet im Ordner **student.pass**.

![config](configFiles.png)

- **ausweis.private** RSA Key
- **ausweis.xml** XML Version des RSA Keys (wird für die Powershell Scripte benötigt)
- **server.cert** und **server.key** für die https-Verschlüsselung notwendig
- **config.json** mit Parametern in Form einer JSON Datei

Die Datei **config.json** hat dabei folgende Einträge.

```JSON
{
    "validDate": "2022-08-30",
    "schuljahr": "21/22",
    "mailer": {
        "host": "ex.mmbbs.de",
        "port": 587,
        "logger": true,
        "secure": false,
        "auth": {
            "user": "Tuttas",
            "pass": "geheim"
        }
    },
    "mailfrom":"tuttas@mmbbs.de",
    "mailSubject":"Ihr Schülerausweis",
    "mailHeader":"Hallo,\r\nmit dieser Mail erhalten Sie ihren Schülerausweis!\r\n\r\n",
    "mailFooter":"Mit freundlichen Grüßen\r\n\r\nIhre MMBbS",
    "png": {
    },
    "pdf": {
    }
}
```

- **validDate**: Das Daten an dem der Ausweis abläuft.
- **schuljkahr**: Das Schuljahr in dem der Ausweis gültig ist
- **mailer**: SMTP Konfiguration für den Node Mailer
- **mailfrom**: Absender Adresse
- **mailSubject**: Betreff der eMail
- **mailHeader**: Anfang der eMail
- **mailTail**: Ende der eMail. Zwischen Anfang und Ende der eMail wir die URL zum Abrufen des Ausweises eingefügt
- **png**: Configuration für die PNG Ansicht
- **pdf**: Configuration für die pdf Ansicht!

Befindet sich im Ordner config eine Datei **students.csv**, so wird diese Datei als Datenbasis genommen. Fehlt diese Datei so erfolgt die Authentifizierung über das diklabu. Die Datei muss dabei folgende Einträge (in der jeweiligen Reihenfolge) aufweisen und als latin1 (ISO 8859-1) gespeichert sein.

![studnets](students.png)

- Spalte A: Email Adresse des Schülers (über diese weist er sich aus und bekommt einen Einladungslink zugesandt)
- Spalte B: Vorname
- Spalte C: Nachname
- Spalte D: Geburtstag im Format YYYY-MM-DD
- Spalte E: Klasse

## Starten des Server

Zunächst müssen die notwendigen Abhängigkeiten installiert werden. Dieses geschieht über:

```
npm install
```

Anschließend kann der Server gestartet werden über:

```
npm run start
```

## Docker Container

Der Docker Container arbeitet default auf Port 8080 über https. Der RSA Schlüssel **ausweis.private** und die SSH Schlüssel **server.cert** und **server.key** liegen außerhalb des Docker Containers in einem Volume *config*, welche die entsprechenden Dateien enthält. 

Alle statischen und damit anpassbaren Webinhalt befinden sich ebenso in einem externen Verzeichnis außerhalb des Containers. Dazu ist ein Volume zu erzeugen.Wichtig dabei ist, dass dieses Verzeichnis zunächst leer ist:

```
docker volume create --driver local --opt type=none --opt device=c:/web --opt o=bind web
```

Anschließend kann der Container wie folgt gestartet werden.

```
docker run --rm -v c:/config:/usr/src/app/config -v web:/usr/src/app/web -it -p 8080:8080 service.joerg-tuttas.de:5555/root/schuelerausweis
```

## Use Case 1 - Der MMBbS Scanner

Über eine spezielle Webapp kann der Ausweis ausgelesen werden. Exemplarisch finden Sie diese WebApp in einem Docker Container z.B. unter [https://130.61.61.100:8082/login.html](https://130.61.61.100:8082/login.html)! Der Anwender Authentifiziert sich mit seinen MMBBS AD Credentials beim Server. Wenn er als registrierter (Lehrer) einen QR Code eines Schüler scannt, so werden ihm über diese App zusätzliche Informationen präsentiert wie Ausbildungsbetrieb und Ansprechpartner!

![Funktionsweise](Sequenzdiagramm.png)

## Use Case 2 - Anwendung mit Anbindung an MS Powerautomate

Über eine Anwendung (in Python) wird der QR Code gescannt und auf dem Server verifiziert. Bei erfolgreicher Verifikation werden die Daten über MS Power Automate (via HTTP POST) weiter verarbeitet.

![powerAutomate](seqPowerautomate.png)

![powerautomate](powerautomate.png)


