<#
.SYNOPSIS
  Raises a Windows toast when the backup task exits non-zero (tech-06 §10, and see the note on §9.4).

.DESCRIPTION
  ↯ Second Windows-specific file in the backup path, and §11.2's exception is worded for one. It
  earns its place the same way `register-backup-task.ps1` does: it is *scheduling furniture*, not
  backup logic. `backup.sh` decides everything — what failed, what got written, what the exit code
  means — and this file only renders that decision somewhere Matthew will see it. A Linux host
  deletes both files, adds a cron line, and `backup.sh` crosses over untouched.

  ↯ Not a contradiction of §9.4's "no alerting". §9.4 and the §1.1 assumptions table reject *uptime
  monitoring* — alerts about an API being down on a host that is powered off by intention, which
  would fire nightly and mean nothing. This fires only when a job that actually ran decided it had
  failed, and the caller gates it on Docker Desktop being present, so the "machine is legitimately
  off" case that §1.1 objects to never reaches it. §10.1's whole argument is that a backup nobody
  checks is the failure mode that matters; a silent task is exactly that.

  Invoked by the scheduled task, never by hand. Exit code is always 0 - a toast that cannot be
  shown must not change what Task Scheduler records as the backup's own result.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [int] $ExitCode,
    [string] $LogPath
)

# No `throw` anywhere in this file, and no $ErrorActionPreference = 'Stop'. See the exit code note
# above: this runs *after* the backup has already decided its outcome, and the outcome is the
# product. A notifier that fails loudly would be a notifier that can turn a clean run into noise.

# ASCII only inside string literals, per the same PowerShell 5.1 / BOM trap documented at length in
# register-backup-task.ps1. These strings are also toast text, so they are user-visible - keep them
# short enough to survive Windows' two-line truncation.
switch ($ExitCode) {
    1 {
        $title = 'Traverser backup FAILED'
        $body  = 'No dump was written. The database was unreachable, or pg_dump failed.'
    }
    2 {
        $title = 'Traverser backup incomplete'
        $body  = 'Local dump written, but the Google Drive copy did NOT happen.'
    }
    default {
        $title = 'Traverser backup FAILED'
        $body  = "The backup task exited with code $ExitCode."
    }
}

# The launcher deliberately passes no -LogPath: `register-backup-task.ps1` owns no path but its own
# location (its docstring is explicit about that), and BACKUP_LOCAL_DIR belongs to .env and
# backup.sh. So the toast names the file rather than the full path.
if ($LogPath) {
    $body += "  See $LogPath"
} else {
    $body += '  See backup.log in the backup folder.'
}

try {
    # WinRT toast rather than a MessageBox or a NotifyIcon balloon, deliberately. A MessageBox is
    # modal and would steal focus out of a game - the exact interruption hiding the console window
    # was meant to remove. A balloon needs its owning process to stay alive to be seen at all. A
    # toast is fire-and-forget and, more importantly, it *persists in Action Center*, so a failure
    # at 6pm is still readable at 11pm. That persistence is the entire point: the Aug 4/Aug 5
    # missed off-machine copies were invisible precisely because nothing outlived the run.
    [void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
    [void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime]

    $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent(
        [Windows.UI.Notifications.ToastTemplateType]::ToastText02)

    $texts = $template.GetElementsByTagName('text')
    $texts.Item(0).AppendChild($template.CreateTextNode($title)) | Out-Null
    $texts.Item(1).AppendChild($template.CreateTextNode($body))  | Out-Null

    # ↯ Toasts require a registered AppUserModelID; an unregistered one is silently dropped rather
    # than erroring, which makes this the single most likely thing to break here. Borrowing the
    # PowerShell shortcut's own AUMID is the standard workaround and needs no Start Menu entry, no
    # installer, and no registry write - the trade is that the toast is attributed to "Windows
    # PowerShell", which is honest enough for a self-hosted dev box.
    $appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'

    $toast = [Windows.UI.Notifications.ToastNotification]::new($template)
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)
}
catch {
    # Last resort: if the toast machinery is unavailable, leave a trace next to the dumps rather
    # than vanishing. This is the only branch that writes anything.
    if ($LogPath) {
        $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
        try {
            Add-Content -LiteralPath $LogPath -Encoding utf8 `
                -Value "$stamp  (toast failed: $($_.Exception.Message)) $title - $body"
        } catch { }
    }
}

exit 0
