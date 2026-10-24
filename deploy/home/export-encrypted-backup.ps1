# MemeSpace disaster-recovery export.
# The only plaintext staging copy is temporary and always deleted in finally.
# Destination MUST be operator-verified removable storage or a network share.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$DestinationDirectory
)
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$temporary=$null
Push-Location $root
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 24 is required.' }
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker Desktop is required.' }
    $destination=[IO.Path]::GetFullPath($DestinationDirectory)
    if (-not [IO.Directory]::Exists($destination)) { throw 'Destination must exist: mount the removable drive or network share first.' }

    $rootPath=[IO.Path]::GetPathRoot($destination)
    $remote=$destination.StartsWith('\\') -and -not ($destination -match '^\\\\(?:localhost|127\.0\.0\.1|\.)(?:\\|$)')
    $drive=[IO.DriveInfo]::new($rootPath)
    $external=$remote -or @('Removable','Network').Contains($drive.DriveType.ToString())
    if (-not $external) { throw 'Rejecting local fixed-disk destination. Use a removable drive or independent network share.' }

    Write-Host 'Backups must leave this Windows PC. An external-drive or network path alone is not proof of off-PC durability.'
    Write-Host 'Ensure you can unplug/remove the destination and still recover it on another device.'
    $confirmation=Read-Host 'Type OFF HOST VERIFIED after checking the destination'
    if ($confirmation -cne 'OFF HOST VERIFIED') { throw 'Destination not verified; no backup created.' }

    $temporary=Join-Path ([IO.Path]::GetTempPath()) ('memespace-export-'+[guid]::NewGuid().ToString('N'))
    [IO.Directory]::CreateDirectory($temporary) | Out-Null
    $owner=[Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls.exe $temporary /inheritance:r /grant:r ($owner+':(OI)(CI)F') | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Unable to limit access to temporary plaintext snapshot directory.' }

    $compose=@('--env-file','deploy/home/.env','-f','deploy/home/compose.yml')
    $log=& docker compose @compose exec -T app node deploy/oracle/backup-sqlite.mjs 2>&1
    if ($LASTEXITCODE -ne 0) { throw 'SQLite online backup failed; inspect local Docker logs without sharing credentials.' }
    $text=($log | Out-String)
    if ($text -notmatch 'Consistent local SQLite snapshot verified: /app/data/snapshots/(memespace-[0-9TZ-]+\.sqlite)') {
        throw 'No verified SQLite snapshot path returned.'
    }
    $name=$Matches[1]
    $plaintext=Join-Path $temporary $name
    & docker compose @compose cp ("app:/app/data/snapshots/"+$name) $plaintext
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $plaintext -PathType Leaf)) {
        throw 'Could not copy consistent backup from private Docker volume.'
    }
    $encrypted=Join-Path $destination (($name -replace '\.sqlite$','')+'-'+[guid]::NewGuid().ToString('N')+'.msvault')
    Write-Host 'Enter a unique, strong backup passphrase. Losing it makes the encrypted backup unrecoverable.'
    $passphrase=Read-Host 'Backup passphrase (hidden)' -AsSecureString
    function Invoke-Vault([string]$mode,[string]$inputFile,[string]$outputFile,[Security.SecureString]$secure) {
        $settings=[Diagnostics.ProcessStartInfo]::new()
        $settings.FileName='node'
        $settings.WorkingDirectory=$root
        $settings.Arguments=('"scripts/backup-vault.mjs" "{0}" "{1}" "{2}"' -f $mode,$inputFile,$outputFile)
        $settings.UseShellExecute=$false
        $settings.CreateNoWindow=$true
        $settings.RedirectStandardInput=$true
        $proc=[Diagnostics.Process]::new()
        $proc.StartInfo=$settings
        $bstr=[IntPtr]::Zero
        try {
            if (-not $proc.Start()) { throw 'Could not launch encrypted backup tool.' }
            $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
            $secret=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
            $proc.StandardInput.WriteLine($secret)
            $proc.StandardInput.Close()
            $secret=$null
            $proc.WaitForExit()
            if ($proc.ExitCode -ne 0) { throw ('Encrypted backup operation failed: '+$mode) }
        } finally {
            if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
            $proc.Dispose()
        }
    }
    try {
        Invoke-Vault 'encrypt' $plaintext $encrypted $passphrase
        Invoke-Vault 'verify' $encrypted '' $passphrase
    } finally {
        $passphrase.Dispose()
    }
    Write-Host 'Encrypted off-PC backup export and authenticated restore verification PASSED.'
    Write-Host ('Recovery artifact: '+$encrypted)
    Write-Host 'NEXT: practice restoring this encrypted file on a DIFFERENT PC and record evidence in Issue #44.'
} finally {
    if ($temporary -and (Test-Path -LiteralPath $temporary)) {
        Remove-Item -LiteralPath $temporary -Recurse -Force -ErrorAction SilentlyContinue
    }
    Pop-Location
}
