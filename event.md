# Event Ticket Verwaltung
Neben dem erzeugen des Schülerausweises kann das System verwendet werden, um Eventtickets für Veranstaltungen zu erzeugen.
Die Teilnahme an einem Event hat zwei wichtig Ereignisse, die Anmeldung und ggf. die Akkreditierung. 
## Anmeldung (Registration)
Für den Anmeldung ein einem Event schickt man den Teilnehmern einen Link mit folgenden Inhalt.
```
http://idcard.mmbbs.de/eventAnmeldung.html?event=eventname&webhook=url
```
Die Parameter **event** und **webhook** sind zwar optional, deren Anwendung wird jedoch dringend empfohlen:
- **event**: Name des Events, dieser erscheint sowohl auf der Anmeldeseite für den Event, also auch später auf dem Wallet.
- **date**: Datum des Events im Format YYYY-MM-DD HH:MM
- **webhook**: Adresse eines Dienstes (z.B. MS Power Automate o.ä.) der ein JSON des Anmeldeprozesses enthält und genutzt werden kann für die Weiterverarbeitung der Anmeldung z.B. in O365. Achtung dabei muss die Adresse natürlich URLEncoded sein, z.B. über diesen Dienst hier: [URL Encoder Online](https://meyerweb.com/eric/tools/dencoder/)

Ein vollständiger Link könnte also z.B. wie folgt aussehen: [https://idcard.mmbbs.de/eventAnmeldung.html?event=Cisco%20Akademientag%202021&date=2021-07-03T12:15:00&webhook=https%3A%2F%2Fprod-140.westeurope.logic.azure.com%3A443%2Fworkflows%2F01acc4885c2a4075bbcc0f3a5b1ca97f%2Ftriggers%2Fmanual%2Fpaths%2Finvoke%3Fapi-version%3D2016-06-01%26sp%3D%252Ftriggers%252Fmanual%252Frun%26sv%3D1.0%26sig%3DCLbmOOO1qehi_7SWRicP4ZgTAI7JG4RECuqBxVY1aO8](https://idcard.mmbbs.de/eventAnmeldung.html?event=Cisco%20Akademientag%202021&date=2021-07-03T12:15:00&webhook=https%3A%2F%2Fprod-140.westeurope.logic.azure.com%3A443%2Fworkflows%2F01acc4885c2a4075bbcc0f3a5b1ca97f%2Ftriggers%2Fmanual%2Fpaths%2Finvoke%3Fapi-version%3D2016-06-01%26sp%3D%252Ftriggers%252Fmanual%252Frun%26sv%3D1.0%26sig%3DCLbmOOO1qehi_7SWRicP4ZgTAI7JG4RECuqBxVY1aO8)

Hat der Teilnehmer das Anmeldeformular ausgefüllt, so erhält er ein pdf mit einem QR Code, der seine eindeutige UUID enthält, bzw. ein Wallet, welches neben seien Daten auch den QR Code mit der UUID enthält.

Wurde als Parameter eine Webhook Adresse angegeben, so wird kurz vor Abschluss der Registrierung ein HTTP-POST an diese Adresse geschickt, mit folgenden Daten:
```JSON
{
  "name": "Mustermann",
  "vorname": "Max",
  "email": "mustermann@mmbbs.de",
  "eventName": "Cisco",
  "eventDate": "2021-07-17 12:00",
  "type": "registration",
  "webhook": "https://prod-140.westeurope.logic.azure.com:443/workflows/01acc4885c2a4075bbcc0f3a5b1ca97f/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=CLbmOOO1qehi_7SWRicP4ZgTAI7JG4RECuqBxVY1aO8",
  "success": true,
  "uuid": "eeedd5e4-60a7-4720-b1ae-77d1a0c4aa7b",
  "msg": "ggf. eine Fehler und Warnmeldung"
}
```

## Akkreditierung (Arrival) - Optional
Am Tag der Veranstaltung zeigen die Teilnehmer ihren QR vor, dieser wird mit einer speziellen **ScannerApp.py** gescannt. Diese prüft die die im QR Code enthaltene UUID auf Gültigkeit und senden dann, sofern bei der Anmeldung ein Webhook angegeben wurde einen HTTP-POST Befehl an den Webhook, mit folgenden Daten.
```JSON
{
  "name": "Mustermann",
  "vorname": "Max",
  "email": "mustermann@mmbbs.de",
  "eventName": "Cisco",
  "eventDate": "2021-07-17 12:00",  
  "type": "arrival",
  "webhook": "https://prod-140.westeurope.logic.azure.com:443/workflows/01acc4885c2a4075bbcc0f3a5b1ca97f/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=CLbmOOO1qehi_7SWRicP4ZgTAI7JG4RECuqBxVY1aO8",
  "success": true,
  "uuid": "eeedd5e4-60a7-4720-b1ae-77d1a0c4aa7b",
  "msg": "ggf. eine Fehler und Warnmeldung"
}
```
Diese Webhook, der sich im Attribut **type** vom ersten Webhook unterscheidet, kann genutzt werden um z.B. die anwesenden Teilnehmer in einer Tabelle zu speichern.
