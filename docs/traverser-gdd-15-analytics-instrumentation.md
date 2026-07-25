# Traverser GDD — Section 15: Analytics & Instrumentation

## 1. Overview

This is the final GDD section. It defines the complete analytics event schema, the metric definitions that answer the planning doc's seven stated tracking goals, the tooling recommendation, and the privacy/retention rules that govern how event data is stored and deleted.

Per the planning doc: analytics should be **"Standard"** level — enough to validate whether the game mechanics are working, without full funnel instrumentation. This section holds that line deliberately. It does not invent new tracking beyond what the planning doc's seven metrics require and what prior sections have already flagged forward.

Most of the schema work is already done. Section 11 (§9) defined the streak/notification/overactivity event set, Section 12 (§10) added two lore-engagement events, Section 13 and Section 14 each flagged one or two optional screen/settings events. This section's job is to (1) consolidate all of that into one authoritative schema, (2) fill the genuine gaps — session tracking, activity sync, progression, battle engagement, and zone unlocks, none of which any prior section owned — and (3) settle the tooling and privacy questions the planning doc left open.

---

## 2. Design Principles

- **Derived data only, never raw health data.** Per the planning doc, raw HR/step sensor data never leaves the device. Every event below carries only aggregated values (daily totals, tier-minute breakdowns, durations) that already exist server-side because Sections 1, 9, and 11 put them there for gameplay reasons. Analytics never becomes a second reason to collect something gameplay didn't already need.
- **One append-only table, not a new subsystem.** Consistent with the planning doc's "pragmatic over cutting-edge" constraint for a solo developer, events are rows in the existing backend's database, not a separate analytics service. No new infrastructure is required to start collecting data on day one.
- **Every event is attributable and deletable.** All events key off `user_id`, so a GDPR deletion request (planning doc, Privacy & Data Handling) can cascade-delete a player's full event history with one query, no special-casing.
- **Standard, not exhaustive.** Every event in this schema traces either to one of the planning doc's seven metrics or to an explicit prior-section flag. Nothing is added "in case it's useful later" — matching the planning doc's own instruction to avoid full funnel instrumentation.

---

## 3. Complete Event Schema

All events implicitly carry `event_id`, `user_id`, and `timestamp` (server time, UTC), omitted from the tables below for brevity. Events are grouped by category; the **Source** column notes whether the event is newly defined in this section or inherited from a prior section's schema work.

### 3.1 Session & Account

| Event | Key Fields | Source |
|---|---|---|
| `account_created` | `method` (`guest` \| `apple` \| `google` \| `email`) | New |
| `signin_completed` | `method` (`apple` \| `google` \| `email`), `was_guest_upgrade` (bool) | New |
| `signin_prompt_resurfaced` | `attempt_number` (1–5) | Section 11 |
| `app_opened` | `session_id`, `is_first_session_today` (bool) | New |

`app_opened` is the single event Retention D1/D7/D30 is computed from (§4.1). `is_first_session_today` avoids double-counting a player who backgrounds and reopens the app repeatedly in one day.

### 3.2 Activity & Progression

| Event | Key Fields | Source |
|---|---|---|
| `daily_activity_synced` | `date`, `steps`, `xp_step`, `xp_hr`, `xp_battle`, `hr_moderate_minutes`, `hr_vigorous_minutes`, `hr_peak_minutes` | New |
| `level_up` | `new_level`, `stat_points_available` | New |
| `stat_allocated` | `stat` (`vigor`\|`might`\|`resolve`\|`favor`\|`aegis`\|`stride`), `points` | New |

`daily_activity_synced` fires once per completed calendar day, logged **at the next app open after that day's local-midnight rollover** — not at midnight itself. This matches the no-passive-sync architecture Section 9 and Section 11 both establish (activity only syncs when the app is opened or foregrounded; there is no background process finalizing a day's total while the app is closed). It's the same app-open-triggered finalization Section 11 §2.2 uses to evaluate `streak_day_completed`, just also logged as its own row rather than only inferred from the streak calculation. The `xp_step` / `xp_hr` / `xp_battle` split matches the three-source breakdown Section 13 §3.2 already displays in the in-app Activity Log, so this event is a direct mirror of UI-visible data, not a new calculation.

### 3.3 Zones & Bosses

| Event | Key Fields | Source |
|---|---|---|
| `zone_unlocked` | `zone_id`, `leagues_at_unlock`, `player_level` | New |
| `boss_defeated` | `boss_id`, `zone_id`, `boss_tier` (`mid_boss`\|`final_boss`), `first_kill` (bool), `player_level`, `turns_taken` | New |
| `boss_gate_detail_viewed` | `boss_id`, `trinket_revealed` (bool) | Section 13 (optional) |

### 3.4 Battle

| Event | Key Fields | Source |
|---|---|---|
| `encounter_triggered` | `source` (`passive_checkpoint`\|`workout_bonus`\|`manual_explore`), `enemy_id` | New |
| `battle_started` | `battle_id`, `enemy_id`, `enemy_tier` (`wild`\|`mini_boss`\|`zone_boss`), `player_level` | New |
| `battle_completed` | `battle_id`, `result` (`win`\|`loss`\|`fled`), `turns_taken` | New |

Battle Engagement Rate (§4.4) is computed as `battle_started` count ÷ `encounter_triggered` count — the gap between the two is exactly "encounters the player declined to fight," which is what the planning doc's metric asks for.

### 3.5 Streaks & Notifications *(inherited unchanged from Section 11 §9)*

| Event | Key Fields |
|---|---|
| `streak_day_completed` | `date`, `streak_length`, `method` (`goal_hit`\|`rest_day_tag`\|`auto_sync_grace`) |
| `streak_broken` | `date`, `previous_streak_length` |
| `rest_day_tagged` | `date`, `retroactive` (bool) |
| `auto_sync_grace_used` | `date`, `remaining_this_period` |
| `streak_milestone_reached` | `milestone_day`, `reward_slot`, `reward_tier`, `overflow_fallback` (bool) |
| `notification_sent` | `type` (`daily_nudge`\|`streak_at_risk`\|`rest_day_confirmation`\|`streak_milestone`), `send_time` |
| `notification_opened` | `type`, `time_to_open_seconds` |
| `overactivity_warning_shown` | `session_id`, `session_duration_minutes` |

### 3.6 Lore & Content Engagement *(inherited unchanged from Section 12 §10)*

| Event | Key Fields |
|---|---|
| `lore_screen_viewed` | `zone_id` |
| `bestiary_entry_viewed` | `enemy_id` |
| `bestiary_screen_opened` | *(no additional fields)* |

### 3.7 Settings *(inherited from Section 14 §9, optional)*

| Event | Key Fields |
|---|---|
| `audio_settings_changed` | `music_volume`, `sfx_volume`, `muted` (bool) |

### 3.8 Technical Health

**Crash rate is deliberately not a custom event.** Crash reporting is a solved problem with purpose-built tooling (§5.2); reimplementing it as a hand-rolled event would violate the "pragmatic over cutting-edge" constraint in the opposite direction — building something worse than what already exists for free. Crash rate is tracked entirely through the dedicated crash-reporting tool and does not appear in the `analytics_events` table.

---

## 4. Metric Definitions

Each of the planning doc's seven stated metrics, mapped to the exact events and calculation logic that answer it.

### 4.1 Retention at Day 1, 7, 30

**Definition:** Of players whose `account_created` fell on day N, what fraction have at least one `app_opened` event on day N+1 (D1), N+7 (D7), or N+30 (D30)?

Standard cohort-retention calculation — bucket `account_created` by day, join against `app_opened` at the target offset. No event beyond `account_created` and `app_opened` is needed.

### 4.2 Average Daily Steps Logged

**Definition:** Mean of `daily_activity_synced.steps` across all synced player-days in the reporting window.

Segment by player tier (e.g., new vs. 30+ day retained) to distinguish "is Traverser making people move more" from "are already-active people just logging their existing activity" — the planning doc's stated goal is the former, so a first-30-days-vs-steady-state comparison is more informative than a flat average alone.

### 4.3 Level Distribution

**Definition:** Histogram of current player level across the active player base, built from the most recent `level_up.new_level` per player (or level 1 for players with no `level_up` event yet).

Directly answers "is progression balanced or grindy" — a distribution heavily clustered at low levels with a long tail past Level 30–40 would flag exactly the grind risk Section 1's anti-grind constraint was designed to prevent.

### 4.4 Battle Engagement Rate

**Definition:** `count(battle_started)` ÷ `count(encounter_triggered)`, within the same reporting window.

A low rate would suggest encounters are trivial or annoying enough to skip; segmenting by `enemy_tier` (wild vs. mini-boss vs. zone boss) shows whether disengagement concentrates on any particular fight type.

### 4.5 Streak Length Distribution

**Definition:** Histogram of `streak_length` from the most recent `streak_day_completed` per player, plus a separate distribution of `previous_streak_length` from `streak_broken` events to see how far streaks typically get before breaking.

### 4.6 Zone Unlock Rates

**Definition:** Of all players reaching a given prerequisite state, what fraction have a `zone_unlocked` event for Valheon, and separately for Imperion? Best expressed as a funnel: `account_created` → `zone_unlocked(olympion)` *(implicit at account creation, not tracked separately since it's the starting zone)* → `zone_unlocked(valheon)` → `zone_unlocked(imperion)`.

`boss_defeated` with `boss_tier = final_boss` cross-checks this, since Section 9's zone gate requires both the distance threshold and the final boss kill — a player who hits the League threshold but stalls on the boss would show up as "gate-adjacent but not unlocked," which is a more useful signal than the unlock event alone.

### 4.7 Crash Rate

Tracked entirely by the crash-reporting tool (§5.2), reported as crashes per session or crash-free session rate, whichever that tool surfaces natively. Not computed from `analytics_events`.

---

## 5. Tooling Recommendation

### 5.1 Event storage: a table in the existing backend database

**Recommendation: a single `analytics_events` table (event_name, user_id, timestamp, JSON payload) in the same Postgres/SQL database the ASP.NET Core backend already uses for gameplay data.**

Rationale: the planning doc asks for lightweight and self-hostable, and the lightest possible option is *no new infrastructure at all*. A solo developer already operating a self-hosted backend gains nothing from standing up a dedicated event-ingestion pipeline (Kafka, ClickHouse, etc.) at this player-base scale — that becomes worth it at a scale this project isn't at yet, and the migration path (swap the write target, keep the event shape) stays open if it ever is. Writing events is a single `INSERT` from the same API endpoints already handling the gameplay actions that trigger them (a `level_up` write happens in the same request that already updates the player's level).

### 5.2 Crash reporting: Sentry

**Recommendation: Sentry, self-hosted or free tier to start.** This is the one piece of this section that genuinely warrants dedicated third-party tooling rather than a custom table — crash reporting needs stack traces, symbolication, release tracking, and alerting, none of which a hand-rolled event is worth reimplementing. Sentry self-hosts cleanly via Docker (fits the existing home-lab setup) and its hosted free tier is generous enough to defer self-hosting entirely until volume justifies it. No health or gameplay data flows through it — only crash/error telemetry, which sidesteps the "don't send sensitive data to a third party" constraint entirely since there's no sensitive data in a stack trace.

### 5.3 Dashboarding: Metabase

**Recommendation: Metabase, self-hosted via Docker, pointed at the same database as `analytics_events`.** It's free and open-source, runs as a single container, and its query builder handles the cohort/funnel calculations in §4 (retention, zone-unlock funnels) without hand-writing SQL for every report, while still allowing raw SQL for anything the builder can't express. This avoids PostHog or Amplitude-style dedicated product-analytics platforms, which either require substantial self-hosted infrastructure (PostHog's self-hosted stack includes ClickHouse, Redis, and Kafka — heavy for a solo operator) or are cloud services that would mean shipping player behavioral data to a third party, which the planning doc explicitly wants to avoid for anything adjacent to health-derived data.

### 5.4 What this deliberately avoids

- **PostHog / Amplitude / Mixpanel (self-hosted or cloud):** built for exactly this kind of event analytics, but the self-hosted versions are infrastructure-heavy relative to this project's scale and solo-maintenance constraint, and the cloud versions mean transmitting behavioral data (including activity-derived fields like step counts and HR-tier minutes) to a third party — precisely what the planning doc's privacy section rules out.
- **Google Analytics / Firebase Analytics:** free and easy, but third-party by default and oriented around marketing/acquisition funnels rather than the gameplay-balance questions the planning doc's seven metrics actually ask.
- **A custom-built dashboard:** rejected as unnecessary engineering effort — Metabase already solves this and is free.

---

## 6. Data Retention & Privacy

- **Deletion cascade:** `analytics_events` rows are deleted as part of the same account-deletion flow that removes a player's profile and progression data (planning doc, GDPR compliance requirement) — one `DELETE WHERE user_id = ?` against the events table alongside the existing account-deletion logic, not a separate process to remember.
- **No raw health data ever enters this table.** Every field in §3 is either already-aggregated (steps, XP, tier-minutes) or purely behavioral (button taps, screen views, battle outcomes) — nothing here duplicates or reconstructs raw HealthKit/Health Connect sensor data.
- **Retention window:** raw event rows retained for 24 months, sufficient to compute D30 retention cohorts multiple times over and support year-over-year balance comparisons once the player base is old enough for that to matter; older rows can be pre-aggregated into monthly summary tables and dropped if storage becomes a concern, though at this scale that's unlikely to be necessary for years.

---

## 7. Cross-Section Flags — Resolution Trace

Every flag pointed at Section 15 by prior locked sections, confirmed addressed:

| Flag source | Flag | Resolved in |
|---|---|---|
| Section 11 | Full streak/notification/overactivity event schema | §3.5 (inherited unchanged) |
| Section 12 | `lore_screen_viewed`, `bestiary_entry_viewed` | §3.6 (inherited unchanged) |
| Section 13 | `boss_gate_detail_viewed`, `bestiary_screen_opened` (optional, UX-funnel visibility) | §3.3, §3.6 (included) |
| Section 14 | `audio_settings_changed` (optional) | §3.7 (included) |
| Planning doc | Retention D1/D7/D30 | §4.1 |
| Planning doc | Average daily steps logged | §4.2 |
| Planning doc | Level distribution | §4.3 |
| Planning doc | Battle engagement rate | §4.4 |
| Planning doc | Streak length distribution | §4.5 |
| Planning doc | Zone unlock rates | §4.6 |
| Planning doc | Crash rate | §4.7, §5.2 |
| Planning doc | Tooling: lightweight, self-hostable, no third-party health data | §5 |

**No flag was left unaddressed.** This closes out the GDD's 15-section plan — no further sections are queued.

---

## 8. Open Questions

- **Background sync's effect on `app_opened` semantics:** Section 11 established that activity only syncs when the app is opened or foregrounded (no passive background sync). If a future technical spike (flagged by Section 11 as an open item) introduces any form of background task execution, it's worth revisiting whether that should count as an `app_opened`-equivalent for retention purposes, or stay excluded so retention keeps measuring genuine engagement rather than a background process. Not resolvable now since it depends on the outcome of that still-open spike.
- **Segment definitions for dashboarding (e.g., "highly active" vs. "average" player, referenced throughout Sections 1–9's pacing math) are not formally codified as a reusable cohort definition here.** Metabase can build these ad hoc per report, but if recurring dashboards want a consistent definition (e.g., "highly active = 30-day average ≥ 10,000 steps/day," matching Section 1's own baseline), that threshold should be agreed on once real data exists rather than guessed at now.
- **A/B testing infrastructure is out of scope.** The planning doc asked for "Standard" analytics, not experimentation tooling; if balance questions later need controlled comparisons (e.g., testing an alternate XP curve on a player subset), that's a deliberately separate, larger piece of infrastructure not built here.

---

## 9. GDD Completion Note

This is the fifteenth and final planned GDD section. All 15 sections are now locked:

1. XP Formula & Leveling Curve
2. Type Chart & Combat Mechanics
3. Move & Ability Design
4. Battle Items
5. Enemy & Boss Roster — Olympion
6. Enemy & Boss Roster — Valheon
7. Enemy & Boss Roster — Imperion
8. Gear & Loot Tables
9. Overworld Map & Zone Structure
10. Onboarding Flow
11. Daily Engagement & Retention Loop
12. Story & Lore
13. UI & Screen Architecture
14. Sound Design
15. Analytics & Instrumentation

Genuinely unresolvable items remain correctly parked as Phase 2 or technical-spike work (Egyptian zone design, long-tail streak rewards, background-task reliability, lapsed-user win-back, A/B infrastructure) rather than forced into premature decisions. Per the planning doc's stated intent, development and art production now move to their own separate Claude Projects, using this GDD as the locked source of truth.
