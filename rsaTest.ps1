$rsa = New-Object -TypeName System.Security.Cryptography.RSACryptoServiceProvider
$rsa.FromXmlString("<RSAKeyValue><Modulus>tdk6T9hPVeHqwhS5AADIHwsvwlwPdb5tSWEFsXSDLzynlG6l6oC2/u8dbpHf0ur/4a1MTZHgxI4h4o1dKP8JS2nsHwsaUqnuu9m0QNwA/7s59ZyiG79bWdHkdO8HOa3pEP7bq38ShO4545KXEqum2ca9eMJhU8KJuDon5ST8NEvdKlP7Zf/jiFv+CjQjwsDO91Se+B3J8bDpJSesH4Xn+zwlw3QLxh+VWbGsf68A1Vnh3CT0UVZRcXny8gpCw2/Xir3oPiaHua/2aXt2fhDd0eqCvQdjoHNlX2HVze2FDAAfv86dT0o/o8MiP4n1RHf+3MjRNRA3kHVrQA4rupemvQ==</Modulus><Exponent>AQAB</Exponent><P>4HSiWROT9O1sducTe+lRgx+1lkYiCVLJkCY/hT+Jjpo6ad1zK5AXjbdSjOiU5A4kAEfxpHoCY2N+etpr4idhe4JHV5SRhPEUXEnTVEmrTTdQvzG1rLRFWefRY+g/PhA2d8y99yCgBnM/52DQkTweIvBio8m1QyOiMvMpfuGS9l8=</P><Q>z2eyDQDzqnaTzZA1G2HfgjFQ/v4qepvbcH5OCdclv1Ik2H/d7bXkquDwFvH8S3xj/TVPhMjYz3uQdrNUpaJzlvxAUdOnu/qDkg6Cb6xnICdbmHzUiGqoUO7VOfnHVM1BOnKgqZHQjWg6W1BNyLrEu8MnavhVaogxf+2t1FqZoGM=</Q><DP>NuoSNjzl/AyCduy+BZjlynDdmnB6L1HD4rKY497RpsPw+qmlXckZGiD532Of2dPj1vXDFvyKzQowjZoWvvPnk7IiBjlhCOd6lcGyJHMJqBCafsyIqEJKnV5sCkduAZ8x1EmRSH8A59MWlWNIY+ATd3TcjTnyUQTM0C5Rvqstq30=</DP><DQ>PgpyxFkIinE1/UOp3ysDxNojtGMrKcn9dkUR6veknvpfczOsmzLR2Bu5NePk6F+pOVD9HGdIE6iOqjMymulhUkTaqJ97iUuCl+onMmiL4J5lU9Pjb3sYJj2LIvCIo+FSJb2sOY0YqXQIINCAtA7KUrAp1mG6i0d6Jx5d5SvE0Kk=</DQ><InverseQ>qUTD+taorzN8qTsa3AwPjC4J5XpZZYg4C0iFx1xIZ9exVfdTMNEmZk7BiJdcDVE5yF69ByAgiK0OZ96HRZ4Y08QYomSRU4PdUQGe2ojA/XESoMusZdL+87TPGEtBxhO3M3SrN3/ItkYt6G1mCWVagDfWEoRLq3sMOxixkpuFoLw=</InverseQ><D>i/6IsrFPGknK5dD4PzVa2vNMuC8RQ87u6X/E10FgQLxMMqwgFPE0b/x7RwUML570kLNOO6VjSU42befwYUA90o3f1mJAyITEIl/OMeRs7HMhgqEr93qQhAxe+VqO0Gu/MnNRf6xbAHU5oaXXoer9j0g90zqpnMb2KRq0XebkNgko6ZQqSsbwhqEKsz2dLOpIDjyjoYgpguzm+CIs2gIEJg8NDTM4R0dyAARPvnW/Cv+c9SQeza4g8g1oy+ErDT+GFQmpxB1f1geQJktELwfFYCLrGMNsSxA9c0fWHEj2BrbGvgr4iXPVmGHpoQXcUJTOZpJHNi98YcPSYZKihmg7rQ==</D></RSAKeyValue>")

$enc = [system.Text.Encoding]::UTF8
$obj= @{
    nn="Mustermann"
    vn="Max"
    kl="FIAE20J"
    em="mustermann@mm-bbs.de"
    v="2021-08-01"
    gd="1998-04-11"
    did=1234
}
$string1 = ConvertTo-Json $obj
$data1 = $enc.GetBytes($string1) 

$endcrypt = $rsa.Encrypt($data1,$true)
$encString=[System.Convert]::ToBase64String($endcrypt)
Write-Host "RSA Encrypted: $encString"
$uencString=[uri]::EscapeDataString($encString)
Write-Host "RSA Encrypted URL Encoded: $uencString"

$encByte = [System.Convert]::FromBase64String($encString)

$decryptedBytes = $rsa.Decrypt($encByte, $true)
[System.Text.Encoding]::ASCII.GetString($decryptedBytes)




# don't forget to dispose when you're done!
$rsa.Dispose() 
