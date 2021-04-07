import { Ausbilder } from "./Ausbilder";
import { Betrieb } from "./Betrieb";
import { ID } from "./ID";

export class Student {
    ID_MMBBS:number;
    abgang:string="";
    ausbilder:Ausbilder;
    betrieb:Betrieb;
    email:string;
    gebDatum:string;
    id:number;
    name:string;
    vorname:string;
    idcard:ID;

}