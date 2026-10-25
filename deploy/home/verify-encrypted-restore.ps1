# MemeSpace offline disaster-recovery rehearsal; never touches a live Docker volume.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$EncryptedFile,
    [Parameter(Mandatory=$true)][string]$RestoreDirectory
)
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Push-Location $root
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 24 is required.' }
    $source=[IO.Path]::GetFullPath($EncryptedFile)
    if (-not (Test-Path -LiteralPath $source -PathType Leaf) -or
        [IO.Path]::GetExtension($source) -cne '.msvault') { throw 'Specify an existing .msvault encrypted backup file.' }
    $targetDir=[IO.Path]::GetFullPath($RestoreDirectory)
    if (Test-Path -LiteralPath $targetDir) {
        if (@(Get-ChildItem -LiteralPath $targetDir -Force).Count -ne 0) {
            throw 'Restore directory must be empty and isolated from any live database.'
        }
    } else {
        [IO.Directory]::CreateDirectory($targetDir) | Out-Null
    }
    $owner=[Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls.exe $targetDir /inheritance:r /grant:r ($owner+':(OI)(CI)F') | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not restrict restored database directory permissions.' }
    $target=Join-Path $targetDir 'restored-memespace.sqlite'
    $confirmation=Read-Host 'Type ISOLATED RESTORE to verify this is NOT your live MemeSpace database'
    if ($confirmation -cne 'ISOLATED RESTORE') { throw 'Restore cancelled; no production data was changed.' }
    $passphrase=Read-Host 'Encrypted backup passphrase (hidden)' -AsSecureString
    $bstr=[IntPtr]::Zero
    $proc=$null
    try {
        $settings=[Diagnostics.ProcessStartInfo]::new()
        $settings.FileName='node'
        $settings.WorkingDirectory=$root
        $settings.Arguments=('"scripts/backup-vault.mjs" "restore" "{0}" "{1}"' -f $source,$target)
        $settings.UseShellExecute=$false
        $settings.CreateNoWindow=$true
        $settings.RedirectStandardInput=$true
        $proc=[Diagnostics.Process]::new()
        $proc.StartInfo=$settings
        if (-not $proc.Start()) { throw 'Could not start recovery verifier.' }
        $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($passphrase)
        $secret=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
        $proc.StandardInput.WriteLine($secret)
        $proc.StandardInput.Close()
        $secret=$null
        $proc.WaitForExit()
        if ($proc.ExitCode -ne 0) { throw 'Restore authentication or SQLite integrity check failed.' }
        Write-Host ('PASS: isolated recovery database validated at '+$target)
        Write-Host 'Do not replace your active database without a separately approved disaster-recovery procedure.'
    } finally {
        if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
        $passphrase.Dispose()
        if ($proc) { $proc.Dispose() }
    }
} finally { Pop-Location }
