import cv2
import requests
from pyzbar import pyzbar
import urllib3
import json
import vlc


oldbarcode_info=""
oldText=""
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
p = vlc.MediaPlayer("file:///web/piep.mp3")

def read_barcodes(frame):
    barcodes = pyzbar.decode(frame)
    global oldbarcode_info
    global oldText
    for barcode in barcodes:
        x, y , w, h = barcode.rect
        
        barcode_info = barcode.data.decode('utf-8')        
        
        if oldbarcode_info==barcode_info:
            #print("Old Code")
            cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 0, 255), 2)
            font = cv2.FONT_HERSHEY_DUPLEX
            cv2.putText(frame, oldText, (x + 6, y - 6),
                        font, 2.0, (255, 255, 255), 1)

        else:
            print("READ:"+barcode_info)
            oldbarcode_info=barcode_info
            txt = str(""+barcode_info)
            #txt = str(txt.replace("%2B", "+"))

            if txt.find("uuid=")!=-1:
                uuid = txt[txt.index("uuid=")+5:]           
                print("UUID:"+str(uuid))
                r = requests.get('https://idcard.mmbbs.de/event?uuid='+str(uuid), verify=False)
                data = r.json()
                if data:
                    print("READ:")
                    print(json.dumps(data, indent=4, sort_keys=True))
                    p.play()
                    if data["uuid"]==uuid:
                        cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
                        font = cv2.FONT_HERSHEY_DUPLEX
                        cv2.putText(frame, data["vorname"]+" "+data["name"], (x + 6, y - 6),
                                font, 2.0, (255, 255, 255), 1)
                        oldText = data["vorname"]+" "+data["name"]
                        r = requests.put(
                            "https://dev.mm-bbs.de:8083/event?uuid="+str(uuid), verify=False)
                        #data = json.load(r.content)
                        print("ARRIVED:")
                        #print(json.dumps(data, indent=4, sort_keys=True))

                    else:
                        cv2.rectangle(frame, (x, y), (x+w, y+h), (255, 0, 0), 2)
                        font = cv2.FONT_HERSHEY_DUPLEX
                        cv2.putText(frame, "Invalid", (x + 6, y - 6),
                                font, 2.0, (255, 255, 255), 1)
                        oldText = "Invalid"
                else:
                    cv2.rectangle(frame, (x, y), (x+w, y+h), (255, 0, 0), 2)
                    font = cv2.FONT_HERSHEY_DUPLEX
                    cv2.putText(frame, "unknown", (x + 6, y - 6),
                            font, 2.0, (255, 0, 0), 1)
                    oldText = "unknown"
            else:
                cv2.rectangle(frame, (x, y), (x+w, y+h), (255, 0, 0), 2)
                font = cv2.FONT_HERSHEY_DUPLEX
                cv2.putText(frame, "Invalid", (x + 6, y - 6),
                            font, 2.0, (255, 255, 255), 1)
                oldText="Invalid"
    return frame

def main():
    #1
    camera = cv2.VideoCapture(1)
    ret, frame = camera.read()
    #2
    while ret:
        ret, frame = camera.read()
        frame = read_barcodes(frame)
        cv2.imshow('Barcode/QR code reader', frame)
        if cv2.waitKey(1) & 0xFF == 27:
            break
    #3
    camera.release()
    cv2.destroyAllWindows()
#4
if __name__ == '__main__':
    main()
