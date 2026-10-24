# DPN MemeSpace // securely prompt for the remotely managed Cloudflare Tunnel token.
# Do not pass tokens as shell command arguments or commit them to GitHub.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$secretDir = Join-Path $PSScriptRoot '.secrets'
$dest = Join-Path $secretDir 'tunnel-token'
if (Test-Path -LiteralPath $dest) {
    throw 'Tunnel token file already exists. To rotate, delete it locally and run this script again.'
}
New-Item -ItemType Directory -Path $secretDir -Force | Out-Null
Write-Host 'In Cloudflare Networking > Tunnels > select your tunnel > Add a replica, copy ONLY the tunnel token.'
$secure = Read-Host 'Paste the Cloudflare tunnel token (input hidden)' -AsSecureString
$bstr = [IntPtr]::Zero
$token = $null
try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    if ([string]::IsNullOrWhiteSpace($token) -or $token.Length -lt 30 -or $token -match '\s') {
        throw 'Invalid token text; expected one continuous Cloudflare tunnel token.'
    }
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($dest, $token, $utf8)
} finally {
    if ($bstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    $token = $null
    $secure.Dispose()
}
# Protect the secret from non-owner Windows accounts where supported.
# Docker Desktop/WSL must still be able to read it through the bind mount.
$owner = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $dest /inheritance:r /grant:r "${owner}:(R)" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Warning 'Could not restrict Windows ACL automatically; inspect the tunnel-token file permissions.'
}
Write-Host 'Cloudflare tunnel token saved to protected ignored file; token value was not displayed.'
