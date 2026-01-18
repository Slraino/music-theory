@echo off
REM Remove version parameters from HTML files
cd c:\Users\Admin\Desktop\music website

REM Use PowerShell to remove ?v=X.X.X from all HTML files
powershell -Command "& {$files = Get-ChildItem '*.html'; foreach($f in $files) { $content = Get-Content $f.FullName -Encoding UTF8; $content = $content -replace '\?v=1\.0\.\d+', ''; Set-Content $f.FullName $content -Encoding UTF8; Write-Host '[+] Cleaned: '$f.Name }; Write-Host '[SUCCESS] Removed all version parameters'}"

REM Delete bump-version.ps1
powershell -Command "& {if(Test-Path 'bump-version.ps1') { Remove-Item 'bump-version.ps1'; Write-Host '[+] Deleted bump-version.ps1' }}"

REM Commit changes
git add -A
git commit -m "Remove version parameters and delete bump-version script"
git push

echo [SUCCESS] Complete! All version parameters removed.
pause
