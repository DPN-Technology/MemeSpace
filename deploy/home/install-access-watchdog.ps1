# Install an opt-in per-user Windows Scheduled Task for the private Cloudflare
# staging perimeter. This does not create the Tunnel or enable public access.
# Docker Desktop + the task owner's logged-in Windows session must stay running.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$taskName='DPN-MemeSpace-Access-Watchdog'
Push-Location $root
try {
    & (Join-Path $PSScriptRoot 'verify-host.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'Docker/hostname preflight failed.' }
    $node=Get-Command node -ErrorAction Stop
    $expected=Join-Path $root 'scripts\home-access-watchdog.mjs'
    if (-not (Test-Path -LiteralPath $expected -PathType Leaf)) { throw 'Watchdog script missing from this checkout.' }

    $envFile=Join-Path $PSScriptRoot '.env'
    $team=@(Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^\s*MEMESPACE_ACCESS_TEAM_DOMAIN\s*=' })
    if ($team.Count -ne 1) { throw 'Add your exact MEMESPACE_ACCESS_TEAM_DOMAIN to deploy\home\.env before scheduling.' }
    $domain=($team[0] -split '=',2)[1].Trim()
    if ($domain -cnotmatch '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$') {
        throw 'Cloudflare Access team domain must be exactly yourname.cloudflareaccess.com.'
    }
    $existing=Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existing) { throw 'Watchdog task already exists. Verify it in Windows Task Scheduler; refusing to overwrite.' }

    Write-Host 'This will register a FIVE-MINUTE watchdog as your current Windows user.'
    Write-Host 'A failed public Access policy check will STOP the MemeSpace tunnel; it will NOT delete accounts.'
    Write-Host 'The task runs only while your Windows account is logged on and Docker Desktop is available.'
    Write-Host 'This is not 24/7 proof: scheduled tasks can be disabled, delayed, or fail if Windows is offline.'
    $confirmation=Read-Host 'Type INSTALL ACCESS WATCHDOG to create the scheduled task'
    if ($confirmation -cne 'INSTALL ACCESS WATCHDOG') { throw 'No task created without explicit operator authorization.' }

    $action=New-ScheduledTaskAction -Execute $node.Source -Argument ('"'+$expected+'"') -WorkingDirectory $root
    $trigger=New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
    $identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name
    $principal=New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
    $settings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -MultipleInstances IgnoreNew -StartWhenAvailable
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'DPN MemeSpace staging Access policy watchdog; stops tunnel on failed perimeter checks.' -ErrorAction Stop | Out-Null
    $task=Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
    if ($task.State -eq 'Disabled') { throw 'Installed task is disabled; do not start the tunnel.' }
    Write-Host 'Installed per-user watchdog scheduled every five minutes. It runs only when this user is logged on.'
    Write-Host 'Review its LastRunTime/LastTaskResult in Task Scheduler; confirm live hostname and permitted users before public staging.'
} finally { Pop-Location }
