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

    # How long after logon to wait before firing. Docker Desktop is launched from the HKCU Run key
    # at the same moment, and a cold engine takes a couple of minutes to answer; starting the job
    # in lockstep with it just means backup.sh spends that time in its polling loop. See the
    # trigger block below for why this delay is the whole of the "start when Docker starts" story.
    [string] $LogonDelay = 'PT3M',

    # How often to re-check after that first run. See the repetition block below for why this is
    # cheap enough to leave running all evening.
    [timespan] $RepeatInterval = '01:00:00',

    # ↯ git-bash.exe, the GUI-subsystem launcher, NOT bin\bash.exe. Both run the same shell, but
    # bin\bash.exe is a console application: Task Scheduler gives it a console window, which pops
    # up over whatever is on screen at logon and stays there for the length of the wait loop.
    # git-bash.exe with --hide runs it windowless. It still blocks until bash exits and still
    # returns bash's exit code, so LastTaskResult keeps its 0/1/2 meaning (verified 2026-08-05).
    # NOT C:\WINDOWS\system32\bash.exe either, which is the WSL launcher and would run the script
    # inside a Linux distro with no access to the Windows Docker CLI or the G: mount.
    [string] $BashPath = 'C:\Program Files\Git\git-bash.exe'
)

$ErrorActionPreference = 'Stop'

$infraDir = $PSScriptRoot
$scriptPath = Join-Path $infraDir 'backup.sh'
$notifyScript = Join-Path $infraDir 'notify-backup-failure.ps1'

if (-not (Test-Path -LiteralPath $scriptPath)) {
    throw "backup.sh not found next to this script (looked in $infraDir)"
}
if (-not (Test-Path -LiteralPath $notifyScript)) {
    throw "notify-backup-failure.ps1 not found next to this script (looked in $infraDir)"
}
if (-not (Test-Path -LiteralPath $BashPath)) {
    throw "Git Bash not found at $BashPath - pass -BashPath if it is installed elsewhere"
}
if ((Split-Path -Leaf $BashPath) -ne 'git-bash.exe') {
    Write-Warning "$BashPath is not git-bash.exe - the task will show a console window at logon."
}
if (-not (Test-Path -LiteralPath (Join-Path $infraDir '.env'))) {
    throw "infra\.env not found - copy .env.example and fill in BACKUP_LOCAL_DIR / BACKUP_REMOTE_DIR first"
}

# Git Bash accepts a drive-letter path with forward slashes and resolves it through its MSYS layer,
# so no /c/... translation is needed. Single-quoted inside the double-quoted argument so a space in
# the repo path could never split it into two arguments.
$posixScript = $scriptPath -replace '\\', '/'

# --no-needs-console --hide  : run windowless (see $BashPath above).
# --no-cd                    : keep the task's WorkingDirectory instead of jumping to ~. backup.sh
#                              resolves its own directory anyway, so this only avoids a surprise.
# --command=usr/bin/bash.exe : path relative to the Git install root; everything after it is
#                              handed to bash unchanged, which is why the -c payload below is
#                              character-for-character what bin\bash.exe used to receive.
#
# ↯ The >/dev/null 2>&1 is load-bearing, not tidiness. Windowless means the process has no stdout
# at all, and backup.sh's log() ends in `| tee -a "$LOG_FILE"` — tee's write to a nonexistent
# stdout fails, `set -e` sees the failed pipeline, and the script dies at its first log line with
# exit 1 and nothing written to backup.log. Observed exactly that on 2026-08-05 before this
# redirect was added. Giving fd 1 somewhere real to go costs nothing here: tee still appends every
# line to backup.log, which is the only copy anyone reads. Keep this attached to any future
# console-less launcher, and do not "fix" it by taking tee out of backup.sh — the console path
# (running ./backup.sh by hand) is the one that needs tee's stdout half.
$psExe = (Join-Path $PSHOME 'powershell.exe') -replace '\\', '/'
$notifyPath = $notifyScript -replace '\\', '/'

# ↯ The Docker Desktop gate, and it is the piece that makes the toast below tolerable rather than
# noise. Matthew does not run Docker every time the PC boots — plenty of evenings are gaming, not
# Traverser — and on those boots there is nothing to dump and nothing has changed, because the
# database cannot move while the engine is off. A missed backup there is the *correct* outcome, so
# the run stands down in about a quarter of a second instead of spending ten minutes discovering
# it, and says nothing. Without this gate a toast would fire on every gaming night and would be
# trained away inside a week — which is precisely the objection §1.1 raises to alerting, and the
# reason this gate is load-bearing for §9.4 compatibility rather than an optimisation.
#
# ↯ Gated on Docker Desktop *being present*, not on the database answering. Those differ by about
# ten minutes: on 2026-08-04 and 2026-08-05 the engine took roughly 8-10 minutes from task start to
# a responsive Postgres, so a short timeout would have failed both of those genuine backup nights.
# Presence answers "did Matthew intend to run the stack today", and backup.sh's own 600s pg_isready
# loop then absorbs however slow the cold start turns out to be. The two checks are not
# interchangeable and the cheap one has to come first.
$dockerGate = "tasklist //NH | grep -qi 'docker desktop' || exit 0; "

# The redirect is load-bearing; see the note above it for what windowless does to tee. Then: keep
# backup.sh's exit code, notify only on failure, and hand Task Scheduler the *backup's* result
# rather than the notifier's, so LastTaskResult still means what the description says it means.
$payload = $dockerGate + "'$posixScript' >/dev/null 2>&1; "
$payload += 'rc=$?; '
$payload += "[ `$rc -ne 0 ] && '$psExe' -NoProfile -ExecutionPolicy Bypass -File '$notifyPath' -ExitCode `$rc >/dev/null 2>&1; "
$payload += 'exit $rc'

$argument = '--no-needs-console --hide --no-cd --command=usr/bin/bash.exe -c "' + $payload + '"'

$action = New-ScheduledTaskAction -Execute $BashPath -Argument $argument -WorkingDirectory $infraDir

# ↯ Two triggers, and the second is a deliberate deviation from §10.3's wording.
#
# §10.3 asks for an **at-startup** trigger. That cannot work on this host: Docker Desktop is a
# user-session application, so at true machine startup there is no engine to dump from — the task
# would fire, spend its ten-minute wait on a database that cannot exist yet, and exit non-zero on
# every single boot. At-logon is the honest proxy for "the machine is awake and Docker is
# reachable", and it preserves exactly the catch-up property §10.3 wanted. Recorded in DECISIONS.
#
# ↯ There is deliberately no "when Docker Desktop starts" trigger, because on this machine no such
# event exists to hang one on. Docker Desktop is a per-user install under AppData with no Windows
# service (checked 2026-08-05: no com.docker.service) and it registers no event log provider, so
# Task Scheduler has nothing to subscribe to. The available proxies are all worse than they look —
# WSLService is Automatic and starts at boot whether Docker runs or not, and vmcompute starts for
# any WSL session. So "start when Docker starts" is implemented where it already was: the delay
# below skips the part of the boot where Docker is certainly not up, and backup.sh's pg_isready
# loop covers the rest. Polling is what makes the job start when the *database* is ready, which is
# the condition that actually matters — Docker Desktop's window being open does not imply it.
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$logonTrigger.Delay = $LogonDelay

# ↯ Repeat hourly for the rest of the session, which is what makes the logon trigger survive the
# evening it fires on. The gap it closes: Docker has to be up within ~13 minutes of logon (the
# delay plus backup.sh's 600s wait) or the day gets no backup at all — and since the run is now
# both windowless and silent when Docker is absent, nothing would say so. Booting at 18:00 to game
# and deciding at 20:00 to work on Traverser is a real evening, and one trigger at logon cannot see
# it. This costs nothing to leave running: a non-Docker hour stops at the tasklist gate in ~0.3s,
# and an hour after a successful dump stops at §10.3's once-a-day guard. Neither reaches Postgres.
#
# Built by stealing the Repetition off a throwaway -Once trigger, because New-ScheduledTaskTrigger
# has no -RepetitionInterval for the -AtLogOn form. Omitting -RepetitionDuration is what makes it
# indefinite rather than an hour long; do not "complete" it with a duration.
$logonTrigger.Repetition = (New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval $RepeatInterval).Repetition

$triggers = @(
    (New-ScheduledTaskTrigger -Daily -At $DailyAt),
    $logonTrigger
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
Write-Host "  at logon: yes, delayed $LogonDelay, no console window"
Write-Host "  then every: $RepeatInterval while logged on (no-op unless Docker is up and today has no dump)"
Write-Host '  skipped silently when Docker Desktop is not running; toast on any non-zero exit'
Write-Host ''
Write-Host 'Verify with:'
Write-Host "  Get-ScheduledTaskInfo -TaskName '$TaskName'"
Write-Host "  Start-ScheduledTask   -TaskName '$TaskName'    # run it now"
Write-Host ''
Write-Host 'LastTaskResult 0 = both copies written, 2 = off-machine copy missing (see backup.log).'
