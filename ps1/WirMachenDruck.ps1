Import-Module diklabu
. $PSScriptRoot/ausweisprinter.ps1
$valid=get-Date "1.8.2021" 
Get-Keystore $HOME\diklabu-scharf.json


$rsakey = Get-Content D:\Temp\Schülerausweis\config\ausweis.xml
Login-Diklabu
$courses = Get-Courses
$rows=@()
foreach ($course in $courses) {
    $members = Get-Coursemember -id $course.id 
    #$members = Get-Coursemember -id 3085
    foreach($m in $members) {
        if ($m.ABGANG -eq "N") {
            
            Write-Host $m

            $student=New-Object StudentId;
            $student.nn=$m.NNAME
            $student.vn=$m.VNAME
            #$student.em=$m.EMAIL
            $student.kl=$course.KNAME
            $student.did=$m.id
            $student.bpid=$m.ID_MMBBS
            $student.gd=$m.GEBDAT
            $student.v="$($global:valid.Year)-$($global:valid.Month)-$($global:valid.Day)"

            $row = New-Object execlRow
            $row.gültigkeit=$global:valid
            $d=get-Date $student.gd
            $row.gebdat=$d
            $row.klasse=$student.kl
            $row.nachname=$student.nn
            $row.vorname=$student.vn
            $rsaString = $student.getRSA($rsakey)
            #$rsaString= $student.urlDecode($rsaString)
            $rsaString="http://idcard.mmbbs.de/validate?id="+$rsaString        
            $row.qr=$rsaString
            $rows+=$row
             
            
        }
    }     
}
$rows | Export-Excel
