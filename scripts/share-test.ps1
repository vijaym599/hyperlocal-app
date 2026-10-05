param([switch]$Stop)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$runtimeDir = Join-Path $projectRoot '.test-share'
$stateFile = Join-Path $runtimeDir 'tunnel.json'

if ($Stop) {
    if (Test-Path -LiteralPath $stateFile) {
        $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
        $process = Get-Process -Id $state.pid -ErrorAction SilentlyContinue
        if ($process -and $process.ProcessName -eq 'cloudflared' -and $process.StartTime.ToUniversalTime().ToString('o') -eq $state.started) {
            Stop-Process -Id $process.Id
        }
        if ($state.previewPid) {
            $preview = Get-Process -Id $state.previewPid -ErrorAction SilentlyContinue
            if ($preview -and $preview.ProcessName -eq 'node' -and $preview.StartTime.ToUniversalTime().ToString('o') -eq $state.previewStarted) {
                Stop-Process -Id $preview.Id
            }
        }
        Remove-Item -LiteralPath $stateFile
    }
    Write-Output 'Temporary sharing stopped. The local backend is left running.'
    exit 0
}

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
if (Test-Path -LiteralPath $stateFile) {
    $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    $process = Get-Process -Id $state.pid -ErrorAction SilentlyContinue
    if ($process -and $process.ProcessName -eq 'cloudflared' -and $process.StartTime.ToUniversalTime().ToString('o') -eq $state.started) {
        Write-Output "Already sharing: $($state.url)"
        exit 0
    }
}

try { $health = Invoke-RestMethod 'http://localhost:5000/api/health' -TimeoutSec 5 }
catch { throw 'Start the local backend first: npm start (from a terminal in backend/).' }
if ($health.status -ne 'ok') { throw 'The local backend database is unavailable.' }

# Override only this build; do not change any local or production .env files.
$previousApi = $env:VITE_API_BASE_URL
Push-Location $projectRoot
try {
    $env:VITE_API_BASE_URL = '/'
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
} finally {
    $env:VITE_API_BASE_URL = $previousApi
    Pop-Location
}

$binary = Join-Path $runtimeDir 'cloudflared.exe'
if (!(Test-Path -LiteralPath $binary)) {
    Write-Output 'Downloading the official Cloudflare tunnel executable...'
    $download = Join-Path $runtimeDir 'cloudflared.download'
    $previousProgress = $ProgressPreference
    try {
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile $download -UseBasicParsing -TimeoutSec 300
        Move-Item -LiteralPath $download -Destination $binary -Force
    } finally { $ProgressPreference = $previousProgress }
}
$log = Join-Path $runtimeDir 'tunnel.log'
$stdout = Join-Path $runtimeDir 'tunnel-stdout.log'
$previewScript = Join-Path $PSScriptRoot 'test-preview.js'
$preview = Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @(('"' + $previewScript + '"')) -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -RedirectStandardError (Join-Path $runtimeDir 'preview-error.log') -RedirectStandardOutput (Join-Path $runtimeDir 'preview.log') -PassThru
try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 15; $attempt++) {
        Start-Sleep -Seconds 1
        if ($preview.HasExited) { throw 'Test preview stopped. Check .test-share/preview-error.log.' }
        try { $response = Invoke-RestMethod 'http://127.0.0.1:5001/api/health' -TimeoutSec 2; $ready = $response.status -eq 'ok' } catch { }
        if ($ready) { break }
    }
    if (!$ready) { throw 'Test preview did not become ready.' }
    $tunnel = Start-Process -FilePath $binary -ArgumentList @('tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', 'http://127.0.0.1:5001') -WorkingDirectory $runtimeDir -WindowStyle Hidden -RedirectStandardError $log -RedirectStandardOutput $stdout -PassThru
} catch {
    Stop-Process -Id $preview.Id -ErrorAction SilentlyContinue
    throw
}
$state = @{ pid = $tunnel.Id; started = $tunnel.StartTime.ToUniversalTime().ToString('o'); url = $null; previewPid = $preview.Id; previewStarted = $preview.StartTime.ToUniversalTime().ToString('o') }
$state | ConvertTo-Json | Set-Content -LiteralPath $stateFile
for ($attempt = 0; $attempt -lt 90; $attempt++) {
    Start-Sleep -Seconds 1
    if ($tunnel.HasExited) { Stop-Process -Id $preview.Id -ErrorAction SilentlyContinue; throw "Tunnel stopped. Check $log" }
    $content = Get-Content -LiteralPath $log -Raw -ErrorAction SilentlyContinue
    if ($content -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
        $state.url = $Matches[0]
        $state | ConvertTo-Json | Set-Content -LiteralPath $stateFile
        Write-Output "TEST LINK: $($state.url)"
        Write-Output 'Keep your laptop, internet and backend running. To revoke the link: npm run share:stop'
        exit 0
    }
}
Stop-Process -Id $tunnel.Id -ErrorAction SilentlyContinue
Stop-Process -Id $preview.Id -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $stateFile
throw "No test link received. Check $log"
