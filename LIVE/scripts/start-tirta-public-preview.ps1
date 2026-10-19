param([switch]$PreviewOnly)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$previewRuntime = Join-Path $PSScriptRoot "tirta-preview-runtime.mjs"
$previewUrl = "http://127.0.0.1:4173"

if ($PreviewOnly) {
  $Host.UI.RawUI.WindowTitle = "TIRTA Production Preview - 4173"
  Push-Location $repoRoot
  try {
    & node $previewRuntime
    exit $LASTEXITCODE
  } finally {
    Pop-Location
  }
}

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
$cloudflaredPath = if ($cloudflared) { $cloudflared.Source } else { "C:\Program Files (x86)\cloudflared\cloudflared.exe" }
if (-not (Test-Path $cloudflaredPath)) {
  throw "cloudflared tidak ditemukan. Pasang paket resmi Cloudflare: winget install --id Cloudflare.cloudflared --exact"
}

$cloudflaredConfig = Join-Path $env:USERPROFILE ".cloudflared\config.yml"
if (Test-Path $cloudflaredConfig) {
  throw "Quick Tunnel tidak berjalan dengan konfigurasi $cloudflaredConfig. Launcher tidak mengubah file konfigurasi tersebut."
}

$listener = Get-NetTCPConnection -State Listen -LocalPort 4173 -ErrorAction SilentlyContinue
if ($listener) {
  $owners = ($listener.OwningProcess | Sort-Object -Unique) -join ", "
  throw "Port 4173 sudah digunakan (PID $owners). Tutup server tersebut sebelum menjalankan launcher."
}

Write-Host "=== BUILD TIRTA PRODUCTION ===" -ForegroundColor Cyan
Push-Location $repoRoot
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw "Production build gagal dengan exit code $LASTEXITCODE." }
  Copy-Item (Join-Path $repoRoot "dist\production.html") (Join-Path $repoRoot "dist\tirta.html") -Force
} finally {
  Pop-Location
}

$powershellPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$childArguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -PreviewOnly"
$previewWindow = $null

try {
  Write-Host "=== MEMULAI TIRTA PRODUCTION PREVIEW ===" -ForegroundColor Cyan
  $previewWindow = Start-Process -FilePath $powershellPath -ArgumentList $childArguments -WorkingDirectory $repoRoot -PassThru

  $ready = $false
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    if ($previewWindow.HasExited) { throw "Jendela production preview berhenti sebelum siap." }
    try {
      $response = Invoke-WebRequest -Uri "$previewUrl/production.html" -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw "Production preview tidak merespons di $previewUrl dalam 30 detik." }

  foreach ($path in @("/", "/production.html", "/tirta.html")) {
    $response = Invoke-WebRequest -Uri "$previewUrl$path" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -ne 200) { throw "Local route $path gagal (HTTP $($response.StatusCode))." }
    Write-Host "LOCAL OK: $previewUrl$path (HTTP $($response.StatusCode))" -ForegroundColor Green
  }

  Write-Host "=== CLOUDFLARE QUICK TUNNEL ===" -ForegroundColor Cyan
  Write-Host "Origin: $previewUrl"
  Write-Host "Biarkan terminal ini terbuka. Tekan Ctrl+C di sini untuk menghentikan tunnel dan preview."
  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & $cloudflaredPath tunnel --url $previewUrl 2>&1 | ForEach-Object {
      $line = $_.ToString()
      Write-Host $line
      $match = [regex]::Match($line, "https://[a-z0-9-]+\.trycloudflare\.com", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
      if ($match.Success) {
        Write-Host "PUBLIC TIRTA URL: $($match.Value)/tirta.html" -ForegroundColor Green
        Write-Host "PUBLIC PRODUCTION URL: $($match.Value)/production.html" -ForegroundColor Green
        Write-Host "PUBLIC ROOT URL: $($match.Value)" -ForegroundColor Green
      }
    }
  } finally {
    $ErrorActionPreference = $previousErrorPreference
  }
} finally {
  if ($previewWindow -and -not $previewWindow.HasExited) {
    Write-Host "Menghentikan jendela production preview..." -ForegroundColor Yellow
    & (Join-Path $env:SystemRoot "System32\taskkill.exe") /PID $previewWindow.Id /T /F 2>$null | Out-Null
  }
}
