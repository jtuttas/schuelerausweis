import cv2
import requests
from pyzbar import pyzbar

oldbarcode_info=""
oldText=""



def read_barcodes(frame):
    barcodes = pyzbar.decode(frame)
    global oldbarcode_info
    global oldText
    for barcode in barcodes:
        x, y , w, h = barcode.rect
        
        barcode_info = barcode.data.decode('utf-8')        
        
        if oldbarcode_info==barcode_info:
            print("Old Code")
            cv2.rectangle(frame, (x, y), (x+w, y+h), (255, 0, 0), 2)
            font = cv2.FONT_HERSHEY_DUPLEX
            cv2.putText(frame, oldText, (x + 6, y - 6),
                        font, 2.0, (255, 255, 255), 1)

        else:
            print("READ:"+barcode_info)
            oldbarcode_info=barcode_info
            txt = str(""+barcode_info)
            txt = str(txt.replace("%2B", "+"))

            if txt.find("id=")!=-1:
                rsa = txt[txt.index("id=")+3:]           
                print("RSA:"+str(rsa))
                r = requests.post('https://localhost:8080/validate', json={"id": rsa}, verify=False)
                data = r.json()
                if data["valid"]:
                    cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
                    font = cv2.FONT_HERSHEY_DUPLEX
                    cv2.putText(frame, data["vn"]+" "+data["nn"], (x + 6, y - 6),
                            font, 2.0, (255, 255, 255), 1)
                    oldText = data["vn"]+" "+data["nn"]
                    r = requests.post(
                        'https://prod-211.westeurope.logic.azure.com:443/workflows/e9aa6443ccf2416fb6ff1f54fe0b4fa8/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=gupicyKVuzEUjlOpO7l-BRLcKZdHubhmkEbY3p386f4', json=data, verify=False)
                else:
                    cv2.rectangle(frame, (x, y), (x+w, y+h), (255, 0, 0), 2)
                    font = cv2.FONT_HERSHEY_DUPLEX
                    cv2.putText(frame, "Invalid", (x + 6, y - 6),
                            font, 2.0, (255, 255, 255), 1)
                    oldText = "Invalid"
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
