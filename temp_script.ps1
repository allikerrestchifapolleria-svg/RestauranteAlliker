$tempDir = 'temp_docx'
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
Copy-Item 'Plan_de_Iteraciones (2).docx' "$tempDir\file.zip"
Expand-Archive -Path "$tempDir\file.zip" -DestinationPath "$tempDir\extracted"
$xmlPath = "$tempDir\extracted\word\document.xml"
$content = Get-Content $xmlPath -Raw
$xml = [xml]$content
$ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
$ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
$nodes = $xml.SelectNodes('//w:t', $ns)
$text = ($nodes | ForEach-Object { $_.InnerText }) -join ' '
Write-Output $text
Remove-Item -Recurse -Force $tempDir