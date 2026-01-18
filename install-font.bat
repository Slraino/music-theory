@echo off
REM Install Noto Color Emoji Font
echo [*] Installing Noto Color Emoji font...

REM Download the font using PowerShell
powershell -Command "& {$url='https://github.com/google/noto-emoji/releases/download/v2.038/NotoColorEmoji-Regular.ttf'; $output='%TEMP%\NotoColorEmoji.ttf'; Invoke-WebRequest -Uri $url -OutFile $output; Copy-Item $output 'C:\Windows\Fonts\NotoColorEmoji-Regular.ttf' -Force; Write-Host '[+] Font installed successfully!'; Write-Host '[!] Restart your browser to see changes'}"

pause
