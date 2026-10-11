param(
  [ValidateSet('launch','admin','reset')]
  [string]$Action = 'launch'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$App = Join-Path $Root 'app-@@TAG@@'
$Archive = Join-Path $Root 'memespace-@@TAG@@-source.zip'
$SourceCommit = '@@COMMIT@@'
$Download = "https://github.com/DPN-Technology/MemeSpace/archive/$SourceCommit.zip"

function Abort([string]$Reason) {
  Write-Host ""
  Write-Host "MemeSpace could not continue: $Reason" -ForegroundColor Red
  exit 1
}

function CheckNode {
  $Node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $Node) {
    Abort 'Install Node.js 24 or newer from https://nodejs.org/ and run this launcher again.'
  }

  $Version = (& node -p 'process.versions.node').Trim()
  if ($LASTEXITCODE -ne 0 -or [int]($Version.Split('.')[0]) -lt 24) {
    Abort "Node.js $Version was found. MemeSpace requires Node.js 24 or newer."
  }
  Write-Host "Node.js $Version ready." -ForegroundColor Green
}

function PrepareSource {
  if (Test-Path (Join-Path $App 'package.json')) { return }
  if (Test-Path $App) {
    Abort "The app-@@TAG@@ folder already exists but is incomplete. Rename or move it before retrying. Do not delete any existing data."
  }

  if (-not (Test-Path $Archive)) {
    Write-Host 'Downloading the verified @@TAG@@ release source from GitHub...'
    try {
      Invoke-WebRequest -Uri $Download -OutFile $Archive -UseBasicParsing -MaximumRedirection 5
    } catch {
      Abort "GitHub download failed: $($_.Exception.Message). Check internet access and try again."
    }
  }

  $Staging = Join-Path $Root '_extracting_@@TAG@@'
  try {
    if (Test-Path $Staging) { Remove-Item -LiteralPath $Staging -Recurse -Force }
    New-Item -ItemType Directory -Path $Staging -Force | Out-Null
    Expand-Archive -LiteralPath $Archive -DestinationPath $Staging -Force
    $Directories = @(Get-ChildItem -LiteralPath $Staging -Directory)
    if ($Directories.Count -ne 1) { throw 'Unexpected GitHub archive layout.' }
    $SourcePath = $Directories[0].FullName
    $ManifestPath = Join-Path $SourcePath 'package.json'
    if (-not (Test-Path $ManifestPath)) { throw 'package.json is missing from the archive.' }
    $Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
    if ($Manifest.name -ne 'memespace-local') {
      throw 'Downloaded archive does not contain the expected MemeSpace application.'
    }
    Move-Item -LiteralPath $SourcePath -Destination $App
  } catch {
    Abort "Unable to extract release source: $($_.Exception.Message)"
  } finally {
    if (Test-Path $Staging) { Remove-Item -LiteralPath $Staging -Recurse -Force }
  }
  Write-Host 'MemeSpace @@TAG@@ release source downloaded.' -ForegroundColor Green
}

if ($Action -eq 'reset') {
  if (Test-Path (Join-Path $App 'data')) {
    Abort 'Local account/database files exist in app-@@TAG@@/data. Keep them safe; the reset tool will not delete them.'
  }
  if (Test-Path $App) { Remove-Item -LiteralPath $App -Recurse -Force }
  if (Test-Path $Archive) { Remove-Item -LiteralPath $Archive -Force }
  Write-Host 'Downloaded code cleared. No member or administrator data was deleted.' -ForegroundColor Green
  exit 0
}

CheckNode
PrepareSource
Set-Location $App

if (-not (Test-Path 'node_modules/next/dist/bin/next')) {
  Write-Host 'First launch: installing pinned dependencies. This can take several minutes...'
  & node scripts/local.mjs setup
  if ($LASTEXITCODE -ne 0) {
    Abort 'Dependency installation failed. Fix the displayed error and try launching again.'
  }
}

if ($Action -eq 'admin') {
  Write-Host 'MemeSpace Control Center: http://127.0.0.1:5174/' -ForegroundColor Cyan
  Start-Process 'http://127.0.0.1:5174/'
  & node admin/server.mjs
} else {
  Write-Host 'MemeSpace website: http://127.0.0.1:5173/' -ForegroundColor Cyan
  Write-Host 'If the browser opens before the server is ready, refresh the page.'
  Start-Process 'http://127.0.0.1:5173/'
  & node scripts/local.mjs start
}
if ($LASTEXITCODE -ne 0) { Abort 'MemeSpace stopped with an error. See the terminal output above.' }
