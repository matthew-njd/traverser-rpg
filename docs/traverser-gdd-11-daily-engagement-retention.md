# Traverser GDD — Section 11: Daily Engagement & Retention Loop

## 1. Overview

This section defines the streak mechanic, its grace-period logic, notification copy and timing, the overactivity-warning trigger logic, and the analytics event schema those systems produce. It fulfills the daily engagement loop left explicitly unhoused by Sections 1, 9, and 10.

**Numbering note:** the plan originally had 14 sections; it grew to 15 when this section was inserted as the new Section 11. Under the current numbering: **Section 12 = Story & Lore, Section 13 = UI Architecture** (was 12), **Section 14 = Sound Design** (was 13), **Section 15 = Analytics** (was 14). Sections 2–10 originally carried pre-renumbering references; those were all corrected to current numbering in the full-GDD completion audit, so every file now uses the numbering above consistently.

**Core design constraint (from the planning doc, non-negotiable):** losing a streak to illness, a legitimate rest day, or simply forgetting to open the app must never feel like punishment. Every mechanic below is built around that constraint first, engagement second.

---

## 2. Streak Mechanic Definition

### 2.1 What counts as an active day

A day counts as active if the player's synced step total for that calendar day (local timezone) meets or exceeds their **personal daily step goal**, default **7,000 steps** (matching Section 1's average-user baseline and Section 4/9's daily-reward threshold).

**Minimum configurable floor: 3,000 steps.** Section 4 flagged that a fully custom goal could be gamed by setting a trivially low target. Resolving that here: the goal is player-configurable for personalization, but the app enforces a hard floor of 3,000 steps — low enough to stay accessible for players with mobility constraints, high enough that hitting it still reflects genuine activity. The UI should surface a gentle note if a player sets their goal at the floor ("This is a low bar for [Traverser name] — you can always raise it later").

Battle activity and HR-tier minutes are **not** required for an active day — only the step goal, per the planning doc's explicit framing ("hits their activity goal"). This keeps the streak tied to the core promise (steps = progress) rather than pushing players toward combat or intensity they may not want that day.

### 2.2 Streak counter

- Consecutive active days, counted from the player's most recent break (or account creation).
- Increments once per calendar day, evaluated at local midnight rollover against that day's final synced total.
- Never decreases except on a genuine break (Section 3.3) — a day that doesn't meet the goal, isn't rest-tagged, and isn't covered by grace.
- Displayed as a simple day count with no upper cap or decay; long streaks are the reward in themselves, reinforced by the milestone track in Section 5.

---

## 3. Grace Period & Rest Day Logic

Two independent mechanisms cover the two cases named in the planning doc: an intentional rest, and an unintentional gap.

### 3.1 Manual Rest Day (unlimited, trust-based)

- The player can tag any day as a **Rest Day** from the Character screen — no cap, no cooldown, no explanation required.
- Tagging is honored same-day or **retroactively within 24 hours** of local midnight for that day (covers "I forgot to tag it before bed").
- A tagged Rest Day counts as active for streak purposes and simultaneously triggers Section 2's existing Rest Day mechanic — an immediate 100% Vigor restore. One tag, one action, two effects already defined by two separate systems; no new mechanic is introduced, just a shared trigger.
- This is deliberately unlimited. A cap here would directly contradict the planning doc's instruction that a legitimately busy or unwell day should never cost a streak. Trust-based design accepts that a small minority may over-use it; the alternative (rationing rest) actively undermines the stated design goal.

### 3.2 Automatic Sync Grace (bounded, no manual action)

Covers the specific case named in the planning doc: the player hit their goal but never opened the app that day. Since raw health data stays on-device and only syncs to the server on app open (Section 1's privacy architecture), a day with no app-open has no synced total to evaluate at midnight — without a mechanism, this would incorrectly read as a miss.

- On next app open, the server retroactively evaluates any unsynced days against the step goal, looking back up to **48 hours** (covers a normal one-to-two-day gap in opening the app).
- Any day within that window that actually met the goal is automatically credited as active — no manual tagging, no player action, no notification needed.
- **Capped at 3 auto-credited days per rolling 30-day window.** Beyond that, retroactive sync still credits the underlying steps and XP (XP is never lost, per Section 1's core principle) but no longer auto-repairs the streak — at that point a manual Rest Day tag (3.1, uncapped) is the correct tool if the player wants to preserve it.
- The cap exists to keep this mechanism bounded and legible in analytics (distinguishing "genuinely active but device-lax" players from edge cases) without contradicting its own purpose — 3/month covers realistic gaps generously.

### 3.3 What actually breaks a streak

A streak breaks only when a calendar day passes with: no step goal met, no Rest Day tag (same-day or within the 24-hour retroactive window), and no remaining Auto Sync Grace credit. This is intentionally the narrow case — everything else in this section exists to keep genuine effort or genuine rest from ever counting as a loss.

---

## 4. Streak-Loss Framing

When a streak does break, the app never frames it as failure:

- No red banners, no broken-chain iconography, no "you lost your streak!" language.
- On next open after a break, a single quiet line on the Character screen: *"A new road begins today."* The streak counter simply resets to 1 (for today, if active) or 0, with no further callout.
- The break itself generates no notification. Players are never pushed a message telling them they failed to show up — that would directly undermine the planning doc's "never feels like punishment" requirement.
- Historical longest-streak is tracked and displayed as a permanent personal-best stat (Character screen), so a broken streak doesn't erase the record of what was already achieved.

---

## 5. Streak Milestone Rewards

Per direction this session, milestone rewards draw from the **existing gear tier system** (Section 8) rather than introducing a new reward type.

### 5.1 Design constraint: Trinket is never a streak reward

Section 8 deliberately reserves the Trinket slot's Mythic/Divine tiers — the only slot that grants a move — as an exclusive first-kill reward from zone bosses. Streak rewards must not undercut that. **Streak milestones only ever upgrade Weapon, Armor, or Accessory** (Section 8's zone-agnostic, stat-only slots), and only up to **Mythic** — never Divine, which stays a zone-boss exclusive per Section 8's own design principle.

### 5.2 Milestone ladder

Rotates through the three eligible slots, escalating one tier at a time. Verified against Section 8's tier ladder (Mortal → Heroic → Mythic) with no invalid skips:

| Day | Slot | Tier Granted |
|---|---|---|
| 3 | Armor | Mortal |
| 7 | Accessory | Mortal |
| 14 | Weapon | Heroic |
| 25 | Armor | Heroic |
| 40 | Accessory | Heroic |
| 60 | Weapon | Mythic |
| 90 | Armor | Mythic |
| 120 | Accessory | Mythic |

(Weapon starts at Mortal from onboarding — Day 3/7 fill the two empty slots to match, then the ladder escalates all three together.)

**Context check (corrected in the full-GDD audit — the original figures were wrong):** the average-pace player reaches Section 8's level-based Heroic milestone (L15) around day **~28** of play, a highly active player around day **~16** — so the streak track's first Heroic at Day 14 lands roughly in step with normal pacing rather than ahead of it. The Mythic tier is where the track genuinely differentiates: the first streak Mythic arrives at Day 60 — ahead of the average player's first level-based Mythic (L25, ~day 81), behind a highly active one (~day 47) — and **full three-slot Mythic at Day 120 has no level-milestone equivalent at all**, since level milestones only ever grant two Mythic pieces (L25 and L45, random slots). Outside repeat zone-boss farming (available from ~day 31 for players who fight), the streak track is the only deterministic route to a full Mythic loadout. This is intentional: it rewards *consistency* specifically, independent of combat engagement or raw step volume, giving a player who walks daily but rarely battles a legitimate progression path of their own.

### 5.3 Overlap handling

If a slot has already reached the milestone's tier (or higher) through normal level/drop progression before the milestone day arrives, the reward auto-skips to that slot's next available tier instead of duplicating or downgrading. If, in the rare case, all three slots are already at or above Mythic by the time a milestone triggers, the milestone converts to a one-time bonus of **2× Herald's Draft** (existing Uncommon healing item, Section 4) as overflow — a minor fallback, not a new reward track.

### 5.4 Beyond Day 120

No further automatic gear upgrades are defined past the Day 120 full-Mythic milestone (Divine is intentionally withheld, per 5.1). Longer streaks (180, 365+ days) are tracked and displayed for personal-best/social-proof purposes but carry no mechanical reward in this scope — flagged in Open Questions below as a natural fit for the planning doc's Phase 2 quest-system item.

---

## 6. Notification Copy Bank

Four notification types, each with a single fixed copy string (no A/B variants at this stage — kept simple per the planning doc's "standard" analytics/tooling ambition).

| Type | Copy |
|---|---|
| **Daily Nudge** | "The road is waiting. A little more distance today keeps [Traverser Name]'s journey moving." |
| **Streak-at-Risk** | "Your streak is holding at [N] days — a short walk before midnight keeps it alive." |
| **Rest-Day Confirmation** | "Rest tagged. [Traverser Name]'s strength returns — the road isn't going anywhere." |
| **Streak Milestone** | "[N] days on the road. [Traverser Name] has earned it." (appended with the specific gear reward name when applicable) |

All copy avoids guilt, urgency framing beyond a simple factual time reference ("before midnight"), and any medical or alarmist language — consistent with the tone already established for the overactivity warning (Section 7).

---

## 7. Notification Send-Time & Frequency Strategy

### 7.1 Timing

- **Daily Nudge:** sent once, at **7:00 PM local time**, only if the day's step goal has not yet been met.
- **Streak-at-Risk:** sent once, at **9:00 PM local time**, only if the goal still hasn't been met *and* the player has an active streak of 2+ days that would break at midnight. Replaces the Daily Nudge that evening rather than stacking with it.

**Architecture note — local vs. server evaluation:** since activity only syncs to the server when the app is opened (§2.1's sync model, per the planning doc), the server alone can't reliably know at 7 PM whether today's goal was met if the app hasn't been opened yet that day. The recommended split: raw health data stays on-device and is never uploaded without an app open (preserving the existing privacy architecture), but the **notification scheduling itself runs as a local, on-device check** — a periodic background task (iOS BGTaskScheduler / Android WorkManager) queries the health platform locally, decides whether the goal is met, and fires a local notification if not, without uploading anything to the server. This keeps notification accuracy intact without adding any new server-side passive sync. Flagged as a recommendation for the backend/mobile architecture rather than a certainty — worth confirming feasibility during implementation, since background task scheduling reliability varies by OS and battery-optimization settings.
- **Rest-Day Confirmation:** sent immediately on tagging, as an in-app toast (not a push notification — the player is already in the app when they tag).
- **Streak Milestone:** sent immediately server-side the moment the milestone day is confirmed (typically on next app open after local midnight rollover, since that's when the day's final total is evaluated).

### 7.2 Frequency cap

- **Maximum 1 push notification per day**, priority order when multiple would qualify: Streak-at-Risk > Streak Milestone > Daily Nudge.
- No Daily Nudge or Streak-at-Risk is sent on a day the goal is already met — these exist purely to close the gap on days it isn't, never to nag an already-active player.
- No notification of any kind is sent for a streak *break* itself (Section 4).

### 7.3 Sign-in resurfacing cadence

Closes Section 10's open question on cadence beyond its single first-backgrounding prompt:

- First resurface: on first app backgrounding (already defined, Section 10 §8.2).
- Second resurface: after **3 days** of continued guest play.
- Subsequent resurfaces: every **14 days** thereafter, while still in guest mode.
- **Hard cap: 5 total resurfacing attempts.** After the fifth, the app stops prompting entirely — a guest player who has ignored five non-intrusive invitations has made an implicit choice, and continuing to ask becomes exactly the kind of nagging this section is designed to avoid elsewhere.
- Every resurface remains the same non-blocking, dismissible bottom-sheet pattern from Section 10 — no new UI is introduced, just a repeat schedule.

---

## 8. Overactivity Warning — Trigger Logic

Per the leaning noted in Section 10's cross-section flags, this section owns the **trigger logic**; Section 13 (UI Architecture) owns the visual component (toast/banner) that renders it.

### 8.1 Trigger condition

- Fires when a single continuous tracked activity session accumulates **90 cumulative minutes at Tier 1 (Moderate, 50–69% HRmax) or above** (Section 1's HR tiers).
- Session boundary matches Section 1's existing HR-session tracking: a continuous block of elevated HR, ending when the player drops below Tier 1 for more than 10 consecutive minutes (standard workout-session-end heuristic, no new tracking infrastructure required).

### 8.2 Delivery

- **In-app only, never a push notification.** A message about session duration only makes sense in the context of being in the app; pushing it as a notification would read as being monitored from outside the workout, which cuts against the "gentle, supportive" tone the planning doc requires.
- **Correction from the first draft:** the planning doc is explicit that Traverser has no passive background sync — activity data (including HR session data) is only pulled from the health platform when the app is opened. The first draft of this section assumed the app could detect the threshold mid-workout even while backgrounded, which isn't true under this architecture. Revised logic below is consistent with it.
- The check happens **at sync time only** — every time the app is opened or foregrounded, the freshly-synced session data (current in-progress session, if the health platform reports one live, or the most recently completed session) is evaluated against the 90-minute threshold.
- **If the player opens or foregrounds the app while a long session is still ongoing** (e.g., checking Traverser mid-workout), and that session has already crossed 90 cumulative Tier 1+ minutes, the banner renders immediately — this is the case the warning is actually designed for, and it works fine under the sync-on-open model since the check happens the moment fresh data arrives.
- **If the session ends before the player next opens the app at all**, the warning does **not** fire retroactively. Advising someone to rest after the workout is already over serves no purpose and would land as a strange, delayed non-sequitur rather than a helpful nudge — the underlying steps and HR minutes are still credited to XP as normal (Section 1), only the warning itself is skipped for sessions the player never checked in during.
- This is a deliberate consequence of the app's no-passive-sync architecture, not an oversight: a genuinely live, mid-workout warning for a player who never opens the app during a long session would require background health monitoring, which is out of scope for MVP.

### 8.3 Frequency

- **Fires at most once per session.** Crossing the threshold sets a session-scoped flag; it does not re-fire every subsequent minute.
- A new session (per the 10-minute-drop boundary in 8.1) resets eligibility — a player doing multiple long sessions in a day can see it more than once, which is appropriate since each is a genuinely separate long effort.

### 8.4 Tone and consequence

- Exact copy (from the planning doc, unchanged): *"You've been at it a while — the road will still be here after you rest."*
- Purely informational — no XP penalty, no Vigor penalty, no streak interaction. It exists to encourage a healthy stopping point, never to gatekeep it; the player can dismiss it and keep going with zero mechanical consequence.

---

## 9. Event Schema

Defined ahead of Section 15 (Analytics) so that section doesn't need to guess at a schema. All events include implicit `user_id` and `timestamp` fields, omitted below for brevity.

| Event | Key Fields |
|---|---|
| `streak_day_completed` | `date`, `streak_length`, `method` (`goal_hit` \| `rest_day_tag` \| `auto_sync_grace`) |
| `streak_broken` | `date`, `previous_streak_length` |
| `rest_day_tagged` | `date`, `retroactive` (bool) |
| `auto_sync_grace_used` | `date`, `remaining_this_period` |
| `streak_milestone_reached` | `milestone_day`, `reward_slot`, `reward_tier`, `overflow_fallback` (bool) |
| `notification_sent` | `type` (`daily_nudge` \| `streak_at_risk` \| `rest_day_confirmation` \| `streak_milestone`), `send_time` |
| `notification_opened` | `type`, `time_to_open_seconds` |
| `overactivity_warning_shown` | `session_id`, `session_duration_minutes` |
| `signin_prompt_resurfaced` | `attempt_number` (1–5) |

These map directly onto the planning doc's Day 1/7/30 retention and streak-length-distribution analytics goals without further schema work.

---

## 10. Cross-Section Flags

- **Section 4 (Battle Items) — FULFILLED.** Resolved the open question on the daily step goal being gameable via a low custom target: hard floor of 3,000 steps enforced (§2.1).
- **Section 8 (Gear & Loot Tables):** New consumer of the gear tier system — streak milestones (§5) grant Weapon/Armor/Accessory pieces directly, bypassing drop RNG entirely. Section 8 should be aware a second acquisition path now exists alongside level milestones and combat drops; no rebalancing needed since the streak track never touches Trinket or Divine tier, and the overlap-handling rule (§5.3) prevents duplication.
- **Section 10 (Onboarding Flow):** This section closes both of Section 10's deferred items — the sign-in resurfacing cadence (§7.3) and the full notification/streak system referenced throughout Section 10 §8–9. Section 10's own numbering references to "Section 12" (UI Architecture) should be read as **Section 13** under the current plan (see §1's numbering note above).
- **Section 13 (UI Architecture, was 12):** Owns rendering for: the overactivity warning banner/toast (trigger logic defined here, §8), the streak counter display and milestone reward reveal, the Rest Day tagging control (Character screen), and the sign-in resurfacing bottom-sheet (inherited from Section 10, cadence now defined here).
- **Section 15 (Analytics, was 14):** Event schema (§9) is ready to consume directly — no further schema design needed for streak/notification/overactivity events specifically.
- **Section 1 (XP & Leveling):** No changes. Confirms the 90-minute overactivity threshold operates on the same Tier 1+ HR session data Section 1 already tracks — no new data collection required, purely a new consumer of existing session-duration tracking.
- **Planning doc — no-passive-sync architecture: cross-checked and corrected for.** The planning doc's "activity only syncs when the app is opened" principle directly shaped two design decisions here: the overactivity warning (§8.2) only ever fires at sync time (app open/foreground), never as a background-detected mid-workout push; and the Daily Nudge/Streak-at-Risk notifications (§7.1) are recommended to run as a local on-device check rather than a server-side one, since the server can't reliably know same-day goal status without an app open. Both are corrections from this section's first draft, which had quietly assumed background awareness the architecture doesn't provide.

---

## 11. Open Questions

- **Long-tail streak rewards (beyond Day 120):** once the Mythic gear ladder is exhausted, longer streaks (180, 365+ days) currently have no mechanical reward, only display value. This is a natural fit for the planning doc's Phase 2 quest-system item — flagged there rather than solved here, since inventing a new reward type now would go against this session's direction to reuse existing systems.
- **Lapsed-user win-back campaign:** this section defines resurfacing for guest sign-in and day-to-day nudges for currently-engaged players, but not a distinct re-engagement flow for a player who has stopped opening the app entirely for an extended period (e.g., 14+ days). Genuinely out of scope for this session's brief; flagged for a future retention-focused pass once real retention data exists to design against.
- **Local background task reliability for notification timing (§7.1):** the recommended on-device check for Daily Nudge/Streak-at-Risk accuracy depends on iOS/Android background task scheduling, which both platforms throttle unpredictably (battery optimization, low-power mode, user-level restrictions). If this proves too unreliable in practice, the fallback is a simpler, less personalized notification (a generic daily reminder sent to everyone at a fixed time regardless of goal status) — worth a technical spike early rather than discovering the limitation late.
- **Auto Sync Grace edge case — multi-device sync conflicts:** if a player uses two devices (e.g., phone + a second phone during travel) and both sync independently, the 48-hour lookback and 3/month cap assume a single data stream. This overlaps with the planning doc's still-open offline-sync/conflict-resolution architecture question and isn't resolvable until that's designed.
