# DPN MemeSpace // Windows Docker Desktop / Cloudflare Tunnel preflight.
# Read-only: checks prerequisites without opening ports or starting containers.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Push-Location $root
try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Install Docker Desktop for Windows, enable WSL 2 and Linux containers, then start Docker Desktop.'
    }
    $engineOS = (& docker info --format '{{.OSType}}' 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $engineOS -ne 'linux') {
        throw 'Docker Desktop must be running with Linux containers (WSL 2).'
    }
    & docker compose version
    if ($LASTEXITCODE -ne 0) { throw 'The Docker Compose plugin is unavailable.' }
    $envPath = Join-Path $root 'deploy\home\.env'
    if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
        throw 'Missing deploy\home\.env. See docs\home-cloudflare-deployment.md.'
    }
    $lines = @(Get-Content -LiteralPath $envPath)
    $match = @($lines | Where-Object { $_ -match '^\s*MEMESPACE_STAGE_HOSTNAME\s*=' })
    if ($match.Count -ne 1) { throw 'Set MEMESPACE_STAGE_HOSTNAME exactly once in deploy\home\.env.' }
    $hostname = ($match[0] -split '=',2)[1].Trim()
    if ($hostname -notmatch '^(?=.{4,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+$') {
        throw 'MEMESPACE_STAGE_HOSTNAME must be a plain DNS hostname (no scheme, port, quotes, slash or spaces).'
    }
    $teamMatch=@($lines | Where-Object { $_ -match '^\s*MEMESPACE_ACCESS_TEAM_DOMAIN\s*=' })
    if ($teamMatch.Count -ne 1) { throw 'Set MEMESPACE_ACCESS_TEAM_DOMAIN exactly once in deploy\home\.env.' }
    $teamDomain=($teamMatch[0] -split '=',2)[1].Trim()
    if ($teamDomain -cnotmatch '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$') {
        throw 'Access team domain must be exactly your-team.cloudflareaccess.com (lowercase, no scheme or port).'
    }
    & docker compose --env-file deploy/home/.env -f deploy/home/compose.yml config --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Docker Compose configuration failed.' }
    $tokenFile = Join-Path $root 'deploy\home\.secrets\tunnel-token'
    if (Test-Path -LiteralPath $tokenFile) {
        if ((Get-Item -LiteralPath $tokenFile).Length -lt 30) { throw 'Tunnel token file exists but looks incomplete.' }
        Write-Host 'Tunnel token file: present (not printed).'
    } else {
        Write-Host 'Tunnel token file: not set; app can be built locally but the tunnel must remain disabled.'
    }
    Write-Host ("Validated Docker Linux backend and protected hostname: " + $hostname)
    Write-Host 'No containers started, no router ports opened. Access policy must be confirmed in Cloudflare BEFORE enabling tunnel profile.'
} finally {
    Pop-Location
}
