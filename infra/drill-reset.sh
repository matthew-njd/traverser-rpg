#!/usr/bin/env bash
# Drill-only. Refills Vigor and clears the day's encounter cap for the drill profile, so a
# tester can run consecutive battles that GDD 2 §6's recovery rates would otherwise gate to
# one or two a day. See docs/traverser-m3-drills.md, "Seeding Vigor you cannot wait for".
#
# Usage: infra/drill-reset.sh [local-date]   (defaults to today in the player's own timezone)
set -euo pipefail

PLAYER='019fd954-0745-7748-9892-ce6f2e600c04'
DAY="${1:-}"

docker compose -f "$(dirname "$0")/docker-compose.yml" exec -T db sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -v ON_ERROR_STOP=1 <<SQL
update player
   -- effectiveStats' Vigor: base, allocation, and the worn Accessory (GDD 8 §2's only Vigor slot).
   set vigor_current = (select 20 + alloc_vigor from player where id = '$PLAYER')
                     + coalesce((select bonus_primary from player_gear
                                  where player_id = '$PLAYER' and equipped_slot = 'accessory'), 0),
       vigor_anchor_at = now()
 where id = '$PLAYER';

-- The player's own timezone, never the server's: T2 §2 gives the client the local date, and
-- the server is UTC, so 'current_date' here silently misses the row after 20:00 Toronto.
update activity_day
   set encounters_used = 0
 where player_id = '$PLAYER'
   and activity_date = coalesce(nullif('$DAY','')::date,
                                (now() at time zone (select timezone from player where id = '$PLAYER'))::date);

select vigor_current, vigor_anchor_at from player where id = '$PLAYER';
select activity_date, encounters_used from activity_day
 where player_id = '$PLAYER' order by activity_date desc limit 1;
SQL"
