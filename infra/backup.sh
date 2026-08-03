#!/bin/sh
# Traverser database backup — tech-06 §10. Runs `pg_dump -Fc` to a local folder and to a
# cloud-synced folder, then prunes both to §10.4's 7 daily / 4 weekly / 12 monthly.
#
# ↯ POSIX sh, and deliberately so (§11.2). Everything Windows-specific about this job lives in
# `register-backup-task.ps1`; moving the stack to a Linux host later means replacing that one file
# with a cron entry and changing nothing here. That constraint is why there is no PowerShell, no
# `date -d`, and no host-absolute path anywhere below.
#
#   ./backup.sh            # the scheduled path — at most one dump per day (§10.3)
#   ./backup.sh --force    # ignore the once-a-day guard; for manual runs and the §10.6 drill
#
# Exit codes: 0 both copies written (or today's dump already existed), 1 the local dump failed,
# 2 the local dump succeeded but the off-machine copy did not. 2 is not a warning — §10.1 is the
# whole reason this script exists, and a local-only dump does not satisfy it.

set -eu

FORCE=''
case "${1:-}" in
  --force) FORCE=1 ;;
  '') ;;
  *) echo "usage: $0 [--force]" >&2; exit 1 ;;
esac

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ENV_FILE="$SCRIPT_DIR/.env"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

# How long to wait for Postgres to answer. Sized for a cold Docker Desktop, not for a warm one:
# the at-logon trigger fires while Docker is still starting its engine, and giving up early there
# would mean the catch-up run §10.3 exists to provide never actually happens.
WAIT_SECONDS=${BACKUP_WAIT_SECONDS:-600}

KEEP_DAILY=7
KEEP_WEEKLY=4
KEEP_MONTHLY=12

die() { echo "backup: $*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || die "$ENV_FILE not found — copy .env.example and fill it in"

# ↯ Read values out of .env rather than `. .env`. Sourcing would run the file as shell, and
# POSTGRES_PASSWORD is a generated string — one `$` or backtick in it and the password becomes a
# command substitution. The trailing `tr -d '\r'` is not defensive padding either: .env is edited
# on Windows, so a CRLF line ending would otherwise ride along inside every value and turn
# `pg_dump -U traverser\r` into an authentication failure that reads as a wrong password.
read_env() {
  sed -n "s/^[[:space:]]*$1=//p" "$ENV_FILE" | tail -n 1 | tr -d '\r'
}

POSTGRES_USER=$(read_env POSTGRES_USER)
POSTGRES_DB=$(read_env POSTGRES_DB)
LOCAL_DIR=$(read_env BACKUP_LOCAL_DIR)
REMOTE_DIR=$(read_env BACKUP_REMOTE_DIR)

[ -n "$POSTGRES_USER" ] || die "POSTGRES_USER is not set in .env"
[ -n "$POSTGRES_DB" ] || die "POSTGRES_DB is not set in .env"
# No defaults, on purpose, and for the same reason app.config.ts throws on a missing API base URL:
# a default would produce a backup job that runs, reports success, and writes somewhere nobody
# thinks to look.
[ -n "$LOCAL_DIR" ] || die "BACKUP_LOCAL_DIR is not set in .env"
[ -n "$REMOTE_DIR" ] || die "BACKUP_REMOTE_DIR is not set in .env"

mkdir -p "$LOCAL_DIR"
LOG_FILE="$LOCAL_DIR/backup.log"

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG_FILE"; }

compose() { docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }

# Day number for a YYYYMMDD stamp (Howard Hinnant's days_from_civil). Hand-rolled because the
# alternative is `date -d`, which is a GNU extension — this is the only date arithmetic in the
# script and it buys the whole thing back its portability. Only the difference between two of
# these matters, so the epoch it counts from is irrelevant.
days_from_civil() {
  _y=${1%????}
  _rest=${1#????}
  _m=${_rest%??}
  _d=${_rest#??}
  # Strip one leading zero — `08` is an invalid octal constant in shell arithmetic, and the
  # bash-only `10#` fix would not survive the move to dash on a Linux host.
  _m=${_m#0}
  _d=${_d#0}
  if [ "$_m" -le 2 ]; then _y=$((_y - 1)); _mp=$((_m + 9)); else _mp=$((_m - 3)); fi
  _era=$((_y / 400))
  _yoe=$((_y - _era * 400))
  _doy=$(((153 * _mp + 2) / 5 + _d - 1))
  _doe=$((_yoe * 365 + _yoe / 4 - _yoe / 100 + _doy))
  echo $((_era * 146097 + _doe - 719468))
}

# §10.4's retention, applied to whichever directory it is handed.
#
# The rule is "the N most recent distinct days/weeks/months that have a dump", not "everything
# within the last N days". That distinction is the whole point on a machine that is off for a
# fortnight: a wall-clock rule would silently prune six of the seven dailies while nobody was
# looking, leaving the recovery window §10.4 asks for existing only on paper.
prune_dir() {
  _dir=$1
  _seen_days='' _seen_weeks='' _seen_months=''
  _n_days=0 _n_weeks=0 _n_months=0

  # Filenames are fixed-width and contain no spaces, so the unquoted expansion is safe here.
  for _f in $(ls -1 "$_dir" 2>/dev/null | sed -n 's/^\(traverser-[0-9]\{8\}-[0-9]\{4\}\.dump\)$/\1/p' | sort -r); do
    _base=${_f#traverser-}
    _ymd=${_base%%-*}
    _ym=${_ymd%??}
    # Any consistent 7-day bucket works — this is not trying to reproduce ISO weeks, only to keep
    # one dump per week-sized span.
    _week=$(($(days_from_civil "$_ymd") / 7))

    _keep=0
    case " $_seen_days " in
      *" $_ymd "*) ;;
      *) _seen_days="$_seen_days $_ymd"
         if [ "$_n_days" -lt "$KEEP_DAILY" ]; then _n_days=$((_n_days + 1)); _keep=1; fi ;;
    esac
    case " $_seen_weeks " in
      *" $_week "*) ;;
      *) _seen_weeks="$_seen_weeks $_week"
         if [ "$_n_weeks" -lt "$KEEP_WEEKLY" ]; then _n_weeks=$((_n_weeks + 1)); _keep=1; fi ;;
    esac
    case " $_seen_months " in
      *" $_ym "*) ;;
      *) _seen_months="$_seen_months $_ym"
         if [ "$_n_months" -lt "$KEEP_MONTHLY" ]; then _n_months=$((_n_months + 1)); _keep=1; fi ;;
    esac

    if [ "$_keep" -eq 0 ]; then
      rm -f "$_dir/$_f"
      log "pruned $(basename "$_dir")/$_f"
    fi
  done
}

TODAY=$(date +%Y%m%d)

# §10.3: at most one dump per day. Load-bearing rather than an optimisation — the daily and
# at-logon triggers both fire on a day that starts with a reboot, and without this guard a machine
# power-cycled three times would spend three of its seven daily slots on one day.
if [ -z "$FORCE" ] && ls "$LOCAL_DIR"/traverser-"$TODAY"-*.dump >/dev/null 2>&1; then
  log "dump for $TODAY already exists — nothing to do (--force overrides)"
  exit 0
fi

# Wait for Postgres rather than assuming it. `pg_isready` is the same check the healthcheck in
# docker-compose.yml uses, so "ready" means the same thing in both places.
_waited=0
until compose exec -T db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
  if [ "$_waited" -ge "$WAIT_SECONDS" ]; then
    log "FAILED: database not reachable after ${WAIT_SECONDS}s — is Docker Desktop running?"
    exit 1
  fi
  # `if`, not `[ … ] && log …` — under `set -e` a bare `&&` list whose test is false returns
  # non-zero and kills the script. Same reason as the REMOTE_OK guard further down.
  if [ "$_waited" -eq 0 ]; then log "waiting for the database (up to ${WAIT_SECONDS}s)"; fi
  sleep 10
  _waited=$((_waited + 10))
done

STAMP=$(date +%Y%m%d-%H%M)
NAME="traverser-$STAMP.dump"
PARTIAL="$LOCAL_DIR/.$NAME.partial"

# The redirect creates the file before pg_dump has written a byte, so a failure mid-dump leaves a
# truncated file behind. Dumping to a name the retention pass ignores, and only renaming it into
# place once it has been verified, is what keeps a half-written dump from ever looking like a
# backup. Default compression, not -Z9: measured 2026-08-02 at 0.5% smaller, because the dump is
# mostly high-entropy UUIDs that do not compress at any level.
trap 'rm -f "$PARTIAL"' EXIT

compose exec -T db pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > "$PARTIAL" || {
  log "FAILED: pg_dump exited non-zero"
  exit 1
}

# Read the archive's table of contents back. §10.6 says an untested backup is not a backup; a full
# restore drill belongs at P9 against real data, but this much is free on every run and it is what
# catches a truncated or empty archive on the day it happens rather than on the day it is needed.
if ! compose exec -T db pg_restore -l < "$PARTIAL" >/dev/null 2>&1; then
  log "FAILED: $NAME is not a readable pg_dump archive — discarded"
  exit 1
fi

mv "$PARTIAL" "$LOCAL_DIR/$NAME"
trap - EXIT
log "wrote $NAME ($(wc -c < "$LOCAL_DIR/$NAME" | tr -d ' ') bytes)"

# ---- the off-machine copy, which is the one that matters (§10.2) ----------------------------
#
# ↯ Checked for liveness, never assumed. Google Drive for desktop mounts its folder as a virtual
# filesystem, so when it is not running the path does not resolve at all — but a signed-out or
# half-mounted client can also accept a write that never leaves the machine. Probing with a real
# file is the only check that distinguishes "synced" from "looks synced", and getting this wrong
# produces the exact failure §10.1 describes: a backup set that appears complete and has no
# off-machine copy in it.
REMOTE_OK=0
PROBE="$REMOTE_DIR/.traverser-write-probe"
if [ ! -d "$REMOTE_DIR" ]; then
  log "FAILED: BACKUP_REMOTE_DIR does not exist ($REMOTE_DIR) — is Google Drive running?"
elif ! : > "$PROBE" 2>/dev/null; then
  log "FAILED: BACKUP_REMOTE_DIR is not writable ($REMOTE_DIR)"
else
  rm -f "$PROBE"
  if cp "$LOCAL_DIR/$NAME" "$REMOTE_DIR/.$NAME.partial" 2>/dev/null &&
     mv "$REMOTE_DIR/.$NAME.partial" "$REMOTE_DIR/$NAME" 2>/dev/null; then
    REMOTE_OK=1
    log "copied $NAME off-machine"
  else
    rm -f "$REMOTE_DIR/.$NAME.partial" 2>/dev/null || true
    log "FAILED: could not copy $NAME to $REMOTE_DIR"
  fi
fi

prune_dir "$LOCAL_DIR"
if [ "$REMOTE_OK" -eq 1 ]; then prune_dir "$REMOTE_DIR"; fi

# Nothing reads this log on a schedule, so keep it small enough to stay readable when something
# finally does go wrong and it gets opened for the first time in a year.
if [ "$(wc -l < "$LOG_FILE")" -gt 1000 ]; then
  tail -n 1000 "$LOG_FILE" > "$LOG_FILE.trimmed" && mv "$LOG_FILE.trimmed" "$LOG_FILE"
fi

if [ "$REMOTE_OK" -eq 0 ]; then
  log "local dump kept, off-machine copy MISSING — exit 2"
  exit 2
fi

log "ok"
