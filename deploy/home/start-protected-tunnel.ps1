# DPN MemeSpace: protected beta tunnel launcher.
# This launcher never opens local ports, stores Cloudflare tokens in logs, or runs payments.
# If an outside-in unauthenticated request reaches MemeSpace, stop tunnel immediately.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Push-Location $root
$started = $false
try {
    & (Join-Path $PSScriptRoot 'verify-host.ps1')
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw 'Node.js 24 is required for the anonymous Cloudflare Access perimeter check.'
    }
    $tokenFile = Join-Path $PSScriptRoot '.secrets\tunnel-token'
    if (-not (Test-Path -LiteralPath $tokenFile -PathType Leaf) -or
        (Get-Item -LiteralPath $tokenFile).Length -lt 30) {
        throw 'Tunnel token is missing or incomplete. Run set-tunnel-token.ps1 first.'
    }
    $envFile = Join-Path $PSScriptRoot '.env'
    $hostnameLine = @(Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^\s*MEMESPACE_STAGE_HOSTNAME\s*=' })
    if ($hostnameLine.Count -ne 1) { throw 'Staging hostname not uniquely configured.' }
    $hostname = ($hostnameLine[0] -split '=', 2)[1].Trim()

    Write-Host 'Before proceeding, verify Cloudflare Access covers this exact hostname and every route.'
    Write-Host 'Access ALLOW must contain only named testers. No Everyone, bypass, or service exceptions.'
    $confirmation = Read-Host 'Type ACCESS POLICY VERIFIED to start the protected staging tunnel'
    if ($confirmation -cne 'ACCESS POLICY VERIFIED') {
        throw 'No operator Access policy confirmation. Tunnel remains disabled.'
    }

    & docker compose --env-file deploy/home/.env -f deploy/home/compose.yml --profile tunnel up -d app tunnel
    if ($LASTEXITCODE -ne 0) { throw 'Docker Compose launch failed.' }
    $started = $true

    # No credentials, no cookies, no redirects followed, no body printed.
    & node scripts/home-access-boundary.mjs ("https://" + $hostname)
    if ($LASTEXITCODE -ne 0) {
        throw 'Anonymous Access preflight failed; refusing to leave tunnel online.'
    }
    Write-Host 'Anonymous Cloudflare Access redirect checks passed.'
    Write-Host 'Final operator checks still required: denied tester identity, approved tester login, off-PC backup and restore.'
}
catch {
    # Be conservative even if Docker may have started the tunnel before failing.
    Write-Warning 'Protected staging verification failed. Stopping tunnel profile; application data is preserved.'
    & docker compose --env-file deploy/home/.env -f deploy/home/compose.yml --profile tunnel stop tunnel 2>&1 | Out-Null
    throw
}
finally {
    Pop-Location
}
