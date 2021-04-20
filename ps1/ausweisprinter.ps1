class execlRow {
    [string] $nachname=""
    [string] $vorname=""
    [string] $klasse=""
    [string] $gültigkeit=""
    [string] $qr=""
}

# Klasse definieren
class StudentId
{
    [string] $nn=""
    [string] $vn=""
    [string] $kl=""
    #[string] $em=""
    [string] $v=""
    [string] $gd=""
    [int] $did=0
    [int] $bpid=0

    [string] ToString() {
        return ""+$this.vn+" "+$this.nn+ " ("+$this.gd+")"
    }

    [string] getRSA([string]$xmlkey) {
        $rsa = New-Object -TypeName System.Security.Cryptography.RSACryptoServiceProvider
        $rsa.FromXmlString($xmlkey)
        $enc = [system.Text.Encoding]::UTF8
        $str = ConvertTo-Json $this
        $data1 = $enc.GetBytes($str) 
        $endcrypt = $rsa.Encrypt($data1,$true)
        $encString=[System.Convert]::ToBase64String($endcrypt)
        $encString=$encString.Replace("+","%2B")
        Write-Verbose "RSA Encrypted: $encString"  
        return $encString                          
    }

    [string] urlDecode([string]$in) {
        $enc = [system.Text.Encoding]::UTF8
        $data = $enc.GetBytes($in) 
        $encString=[uri]::EscapeDataString($in)    
        Write-Verbose "RSA Encrypted and URL Encoded: $encString"  
        return $encString              
    }
}

<#
.Synopsis
   Erzeugen eines QR Codes
.DESCRIPTION
   Erzeugen eines QR Codes
.EXAMPLE
   Get-QRCode "Hallo"
.EXAMPLE
   "Hallo","Welt" | Get-QRCode
#>
function Get-QRCode
{
    Param
    (
        # Hilfebeschreibung zu Param1
        [Parameter(Mandatory=$true,
                   ValueFromPipeline=$true,
                   Position=0)]
        $data,

        # Ausgabeverzeichnis
        $directory="$env:TEMP"

    )

    Begin
    {
        $number=1;
        [System.Net.ServicePointManager]::ServerCertificateValidationCallback = $null
    }
    Process
    {
       Invoke-WebRequest -Uri "https://chart.googleapis.com/chart?chs=400x400&cht=qr&chl=$data&chld=M|0"  -OutFile "$directory/QRCode$number.png"
       "$env:TEMP/QRCode$number.png"
       $number++;
    }
    End
    {
    }
}

<#
.Synopsis
   Ausdrucken des Ausweises
.DESCRIPTION
   Ausdrucken des Ausweises
.EXAMPLE
   Print-IDCard new-Objekt StudentId
#>
function Print-IDCard
{
    Param
    (
        # Hilfebeschreibung zu Param1
        [Parameter(Mandatory=$true,
                   ValueFromPipeline=$true,
                   Position=0)]
        [StudentId]
        $student,

        # Vollständiger Pfad XML RSA Key
        [Parameter(Mandatory=$false,
                   Position=1)]
        [string]
        $rsakey="$PSScriptRoot/../config/ausweis.xml",

        # Vollständiger Pfad zur Word Vorlage
        [Parameter(Mandatory=$false,
                   Position=2)]
        [string]
        $outfile="d:/Temp/Ausweis3QR.doc",
                
        # Vollständiger Pfad zur Word Vorlage
        [Parameter(Mandatory=$false,
                   Position=3)]
        [string]
        $vorlage="$PSScriptRoot/../Ausweis.doc"


    )

    Begin
    {
        $rsakey = Get-Content $rsakey

        $word = New-Object -ComObject Word.Application
        $wordDocument = $word.Documents.open($vorlage)
        $Selection = $Word.Selection
        #Uncomment to make the Word Document visible
        $Word.Visible = $True 
        
        $Cellcounter=0;
        $maxrid=0
    }
    Process
    {
        $rid=1+[math]::Truncate($Cellcounter/2)
        $cid=($Cellcounter%2)+1
        if ($cid -eq 2) {
            $cid=3
        }
        Write-Verbose "Print Cell $rid / $cid"
        $Cellcounter++;
        
        if ($rid -gt $maxrid) {
            $wordDocument.Tables.Item(1).Rows.add($wordDocument.Tables.Item(1).Rows[$rid])
            $maxrid=$rid;
        }

        $cell=$wordDocument.Tables.Item(1).Rows[$rid].Cells[$cid]

        $Selection = $Word.Selection
        $Selection.Font.Name = "Verdana Pro SemiBold"
        $wordDocument.Select()
            
        $cell.Select()
        $Selection.ParagraphFormat.Alignment = 0
        $Selection.Font.Name = "Verdana Pro SemiBold"
        $img=$Selection.InlineShapes.AddPicture("d:\Temp\logo.png")
        $img.Width=50
        $img.Height=50
        $Selection.Font.Size=12
        $Selection.TypeText("`r`nSchülerausweis")
        $Selection.Font.Name = "Arial"
        $Selection.Font.Size=10
        $Selection.TypeText("`r`n`r`n$($student.vn) $($student.nn)")
        $Selection.TypeText("`r`n`r`n$($student.kl)`r`n")
        $Selection.Font.Name = "Consolas"
        $Selection.Font.Size=8            
        $Selection.TypeText("`r`n`r`ngültig bis $($student.v)")
        $Selection.TypeParagraph()

  
        $Selection = $Word.Selection
        $cell.Select()
            
        $rsaString = $student.getRSA($rsakey)
        $rsaString="http://ausweis.joerg-tuttas.de/validate?id="+$rsaString        
        $rsaString= $student.urlDecode($rsaString)
        Write-Verbose "Get QR Code vor:$rsaString"
        
        $qr = Get-QRCode $rsaString
        #$qr = "$env:TEMP/QRCode2.png"
        
        $img=$Selection.InlineShapes.AddPicture($qr)
        $img.Width=130
        $img.Height=130
        $shape=$img.ConvertToShape()
        $shape.top=5
        $shape.Left=110            
        $Selection.TypeParagraph()
    }
    End
    {     
        Remove-Item "$env:TEMP/QRCode*"
        #Write-Verbose "Save Word Document as $outfile"
        #$saveFormat = [Microsoft.Office.Interop.Word.WdSaveFormat]::wdFormatDocument
        #$wordDocument.SaveAs([ref]$outfile,[ref]$saveFormat)
        #$wordDocument.Close()
        #Cleanup the Word COM Object
        #$word.Quit()       
        #$null = [System.Runtime.InteropServices.Marshal]::ReleaseComObject([System.__ComObject]$word)
        
    }
}



<#
$student=New-Object StudentId;
$student.nn="Mustermann"
$student.vn="Max"
$student.em="Mustermann@mm-bbs.de"
$student.kl="FIAE20J"
$student.did=1234
$student.gd="1997-04-11"
$student.v="2021-08-01"

$student2=New-Object StudentId;
$student2.nn="Musterfrau"
$student2.vn="Simone"
$student2.em="Musterfrau@mm-bbs.de"
$student2.kl="FIAE20J"
$student2.did=1235
$student2.gd="1998-05-12"
$student2.v="2021-08-01"

$student,$student2,$student2 | Print-IDCard -Verbose

#>
