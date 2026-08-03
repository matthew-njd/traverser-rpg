<#
.SYNOPSIS
  Registers the Traverser database backup as a Windows scheduled task (tech-06 §10.3).

.DESCRIPTION
  ↯ This is the ONLY Windows-specific file in the backup path, and §11.2 names it as the single
  sanctioned exception to the portability rule. Everything it does is schedule `backup.sh` — no
  dump logic, no retention, no paths beyond the script's own location. Moving the stack to a Linux
  host means deleting this file and adding a cron line; `backup.sh` goes across unchanged.

  Run once, from an ordinary (non-elevated) PowerShell prompt:

      powershell -ExecutionPolicy Bypass -File infra\register-backup-task.ps1

  Re-running is safe — the task is replaced rather than duplicated.
#>
[CmdletBinding()]
param(
    [string] $TaskName = 'Traverser database backup',

    # 03:00 matches §10.3's nightly intent. The exact hour barely matters: StartWhenAvailable below
    # means a machine asleep at this time runs the job when it next wakes.
    [string] $DailyAt = '03:00',

    # Git Bash. NOT C:\WINDOWS\system32\bash.exe, which is the WSL launcher and would run the
    # script inside a Linux distro with no access to the Windows Docker CLI or the G: mount.
    [string] $BashPath = 'C:\Program Files\Git\bin\bash.exe'
)

$ErrorActionPreference = 'Stop'

$infraDir = $PSScriptRoot
$scriptPath = Join-Path $infraDir 'backup.sh'

if (-not (Test-Path -LiteralPath $scriptPath)) {
    throw "backup.sh not found next to this script (looked in $infraDir)"
}
if (-not (Test-Path -LiteralPath $BashPath)) {
    throw "Git Bash not found at $BashPath - pass -BashPath if it is installed elsewhere"
}
if (-not (Test-Path -LiteralPath (Join-Path $infraDir '.env'))) {
    throw "infra\.env not found - copy .env.example and fill in BACKUP_LOCAL_DIR / BACKUP_REMOTE_DIR first"
}

# Git Bash accepts a drive-letter path with forward slashes and resolves it through its MSYS layer,
# so no /c/... translation is needed. Single-quoted inside the double-quoted argument so a space in
# the repo path could never split it into two arguments.
$posixScript = $scriptPath -replace '\\', '/'
$argument = '-c "' + "'$posixScript'" + '"'

$action = New-ScheduledTaskAction -Execute $BashPath -Argument $argument -WorkingDirectory $infraDir

# ↯ Two triggers, and the second is a deliberate deviation from §10.3's wording.
#
# §10.3 asks for an **at-startup** trigger. That cannot work on this host: Docker Desktop is a
# user-session application, so at true machine startup there is no engine to dump from — the task
# would fire, spend its ten-minute wait on a database that cannot exist yet, and exit non-zero on
# every single boot. At-logon is the honest proxy for "the machine is awake and Docker is
# reachable", and it preserves exactly the catch-up property §10.3 wanted. Recorded in DECISIONS.
$triggers = @(
    (New-ScheduledTaskTrigger -Daily -At $DailyAt),
    (New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME")
)

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)

# -StartWhenAvailable is the run-if-missed half of §10.3: a daily run skipped because the PC was
# off is taken at the next opportunity rather than silently abandoned.
# -MultipleInstances IgnoreNew matters because both triggers can land close together on a day that
# begins with a reboot; backup.sh's once-a-day guard already makes the second run a no-op, and this
# stops the two from overlapping at all.

# LogonType Interactive, not S4U or a stored password: the task MUST run inside the desktop session,
# because that is the only place the Docker Desktop engine exists. A task configured to "run whether
# the user is logged on or not" would look more robust and would fail every time.
$principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType Interactive `
    -RunLevel Limited

# ASCII only inside string literals in this file, on purpose. PowerShell 5.1 reads a .ps1 as ANSI
# unless it starts with a UTF-8 BOM, and an em dash decoded as CP1252 ends in 0x94 -- a smart
# closing quote, which terminates the string early and produces a parser error pointing at the
# wrong line entirely. The BOM is the real fix and this file has one; keeping literals ASCII means
# the script still parses if an editor ever strips it. Comments may use the full character set.
$description = @'
Runs infra/backup.sh: pg_dump -Fc of the Traverser database to a local folder and to the
Google Drive folder, then prunes both to 7 daily / 4 weekly / 12 monthly (tech-06 s10).
Exit 2 means the local dump succeeded but the off-machine copy did not.
'@

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggers `
    -Settings $settings -Principal $principal -Description $description -Force | Out-Null

Write-Host "Registered '$TaskName'." -ForegroundColor Green
Write-Host "  runs:    $BashPath $argument"
Write-Host "  daily:   $DailyAt (catches up if the PC was off)"
Write-Host "  at logon: yes"
Write-Host ''
Write-Host 'Verify with:'
Write-Host "  Get-ScheduledTaskInfo -TaskName '$TaskName'"
Write-Host "  Start-ScheduledTask   -TaskName '$TaskName'    # run it now"
Write-Host ''
Write-Host 'LastTaskResult 0 = both copies written, 2 = off-machine copy missing (see backup.log).'
