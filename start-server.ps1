# Simple HTTP Server in PowerShell
$port = 8000
$folder = $PSScriptRoot

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "Server started at http://localhost:$port"
Write-Host "Serving files from: $folder"
Write-Host "Press Ctrl+C to stop"

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    
    $urlPath = $request.Url.LocalPath
    if ($urlPath -eq "/") { $urlPath = "/index.html" }
    
    $filePath = Join-Path $folder $urlPath.TrimStart("/")
    
    if (Test-Path $filePath) {
        $fileBytes = [System.IO.File]::ReadAllBytes($filePath)
        $response.ContentLength64 = $fileBytes.Length
        
        # Set content type
        if ($filePath -like "*.html") { $response.ContentType = "text/html" }
        elseif ($filePath -like "*.css") { $response.ContentType = "text/css" }
        elseif ($filePath -like "*.js") { $response.ContentType = "application/javascript" }
        elseif ($filePath -like "*.mp3") { $response.ContentType = "audio/mpeg" }
        elseif ($filePath -like "*.json") { $response.ContentType = "application/json" }
        
        $response.OutputStream.Write($fileBytes, 0, $fileBytes.Length)
    } else {
        $response.StatusCode = 404
        $response.ContentType = "text/plain"
        $bytes = [Text.Encoding]::UTF8.GetBytes("404 Not Found")
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    
    $response.OutputStream.Close()
}

$listener.Stop()
