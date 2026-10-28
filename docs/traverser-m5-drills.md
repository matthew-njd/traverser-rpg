# M5 device drills

**Run:** P8, on the Pixel 9, from 2026-10-27. **Status:** COMPLETE — all ten drills run, all ten exit criteria pass. Two defects found and fixed (notes 1, 3); drill 5 simulated at a lowered threshold (note 7).

**Purpose:** verify the ten exit criteria in `traverser-m5-plan.md` §5 on hardware.

Fill in the **Result** column as you go. Record a failure as a defect, not as a retry. Write anything else you notice in the notes table at the bottom while you see it.

**↯ These drills are written against the build, not against the spec.** Every expected string below was read out of the code at the P8 fix commit (the resolved-reward fix), and every number out of the server and the phone on 2026-10-26.

---

## Before you start

### State on 2026-10-26

Your profile, `Emdir` (`019fd954-0745-7748-9892-ce6f2e600c04`), read from the server and the phone:

| Field | Value |
| --- | --- |
| Level | 21, with **9 unspent** stat points |
| `lifetime_steps` | **239,343** (239 Leagues). Matches the step ledger |
| Max Vigour | **36**: base 20, 12 allocated, +4 from the worn Warden's Band |
| Effective Favour / Aegis | **17 / 26**, each including +5 from the worn Coilbreaker's Wrath |
| Zones open | Olympion, Valheon, Imperion |
| Streak | current **6**, best **6**, credited through 2026-10-26 |
| Gear | **12 of 12.** Worn: Divine weapon +9, Mortal armour +2, Warden's Band +4, Coilbreaker's Wrath (+5 Favour, +5 Aegis). Held: Skyroad Sigil (+2/+2), Gatekeeper's Snare (+5/+5), a Divine accessory +9, two Heroic weapons +4, two Heroic armours +4, a Mortal accessory +2 |
| Items | **19 of 20** |
| Bestiary (phone) | Met: Satyr, Harpy, Cyclops, Cerberus, Jörmungandr, Fenrir, Strix, Valkyrie, Draugr. Not met: Lemures, Griffin, Cacus |
| Seen screens | `type_intro`, `effect_rend`. **Not** `effect_weaken` |

### No rebuild needed

M5 added no native module. The client schema changes (V12, V13) are JavaScript migrations, so the installed dev build runs M5 from Metro. Start Metro with `npm start`, which sets both port reverses.

Confirm the API is the P7b build: `content_version` reads 6. It is if the container was rebuilt on 2026-10-26, which it was.

### Refilling Vigour

**Character → Tag today as a Rest Day** first, once per local day. The fallback is `./infra/drill-reset.sh`, run only with no fight open. A worn Trinket adds no Vigour, so the script still fills to the true max. Foreground afterwards and check the bar reads full **on screen**.

### Gear is at the cap

You hold 12 of 12. Any gear that arrives during these drills (a streak piece, a boss drop) opens the keep/discard prompt. That is expected, and drill 4 relies on it.

---

## Drills

### 1. The Satchel and a Trinket

Covers exit criteria 1 and 2.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 1.1 | Open the **Satchel** tab | Two sub-tabs, **Gear** and **Items**, with Gear open | PASS |
| 1.2 | Read the slot row | Four slots: `Weapon`, `Armour`, `Accessory`, `Trinket`. The Trinket slot names Coilbreaker's Wrath with a `Valheon` badge | PASS |
| 1.3 | Open **Character** | No Gear card anywhere. Vigour is the first card on **Stats** | PASS |
| 1.4 | Satchel → Gear → tap **Trinket** | Worn: Coilbreaker's Wrath, `+5 Favour` and `+5 Aegis`. Held: Gatekeeper's Snare, `Favour 17 → 17 (+0)` and `Aegis 26 → 26 (+0)`. Skyroad Sigil, `Favour 17 → 14 (−3)` and `Aegis 26 → 23 (−3)` | PASS |
| 1.5 | Tap **Wear** on the Skyroad Sigil, then Character → Stats | Favour **14**, Aegis **23** | PASS |
| 1.6 | Wear Coilbreaker's Wrath again | Favour 17, Aegis 26 | PASS |
| 1.7 | Satchel → **Items** | 19 items, grouped, nothing marked new unless a road find arrived today | PASS |

### 2. A Trinket's move in battle

Covers exit criterion 3. **Shows the Weaken screen for the first time.**

The stored loadout still names Gatekeeper's Snare, whose Trinket isn't worn, so the fourth slot falls back to a skill. Put Coilbreaker's Wrath in it first.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 2.1 | Character → **Skills** | Coilbreaker's Wrath is listed among the moves, with Gatekeeper's Snare **absent** (its Trinket isn't worn) | PASS |
| 2.2 | Select Coilbreaker's Wrath so it's one of the four | Its border colours; four stay selected | PASS |
| 2.3 | Open any wild fight and tap **Begin** | Before the first round, a tap-through: `Coilbreaker's Wrath carries Weaken.` then `On a hit, the enemy's next attack deals 50% of its normal damage. It fires once, then it's gone.` and `Tap to continue` | PASS |
| 2.4 | Read the slots | Coilbreaker's Wrath reads `Divine · War` and `3 left` | PASS |
| 2.5 | Use it and land a hit | The log names you as the actor and adds `Weaken — its next attack deals half damage.` | PASS |
| 2.6 | Finish the fight, then open another | No Weaken screen this time: it shows once | PASS |

### 3. A level milestone, once

Covers half of exit criterion 4. **This drill deletes one server row so the Level 20 reward pays again.** It costs nothing but adds one Sunder Oil, taking you to 20 of 20 items.

```sql
delete from milestone_grant
 where player_id = '019fd954-0745-7748-9892-ce6f2e600c04'
   and milestone_kind = 'level_item' and milestone_key = '20';
```

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 3.1 | Run the delete, then pull to sync on Character | A reveal over the tab: heading `A reward`, a `Level milestone` line, and a **Sunder Oil** card. **Continue** closes it | **FAIL, fixed** — no reveal after a pull that followed a fight (note 3). PASS on the re-run |
| 3.2 | Pull to sync again | Nothing appears. The grant row is back, so the reward is not offered twice | PASS |
| 3.3 | Force-stop, reopen, and let it sync | Still nothing | PASS |
| 3.4 | Satchel → Items | One more Sunder Oil than before. 20 items | PASS |

### 4. A streak milestone, once, past the cap

Covers the rest of exit criterion 4. **Run it on 2026-10-27, after meeting your step goal.** Day 7 of the streak pays an armour piece (GDD 11 §5). You already own Heroic armour, so the overlap rule upgrades it: expect **Paragon's Guard**, Mythic, **+7 Resolve**.

Your gear is full, so the piece parks and the prompt opens. This also re-tests the resolved-reward fix from 2026-10-26.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 4.1 | Once the goal is met, foreground and sync | The streak card reads `7`. A reveal may show a road find first | PASS |
| 4.2 | Close any reveal | The prompt: `Your gear is full`, then `Keep Paragon's Guard? Choose something to leave behind.` One piece is marked suggested | PASS |
| 4.3 | Leave behind the suggested piece | The prompt closes and **does not come back**. Note which piece you left | PASS |
| 4.4 | Satchel → Gear → Armour | Paragon's Guard is held, with a `Resolve` preview | PASS |
| 4.5 | Pull to sync twice | Nothing new appears | PASS |

If the road find also rolled a gear piece (a 25% chance), you get two prompts, one per piece. That is correct. Record both.

### 5. The overactivity banner

Covers exit criterion 5. **Needs a real session.** Step 11 fires when one heart-rate session reaches **90 minutes** across tiers 1–3, and the phone shows it only while that session is still open. Your 2026-10-24 session reached 200, so a long walk or a workout will do.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 5.1 | Past about 95 minutes into the session, and while still moving, open the app | A banner at the top: `You've been at it a while — the road will still be here after you rest.` with **Dismiss** | PASS — at the temporary 10-minute threshold (note 7) |
| 5.2 | Check the notification shade | No notification. The banner is the only signal | PASS |
| 5.3 | Tap **Dismiss**, keep going 10 minutes, then foreground again | No banner. It fires once per session | PASS |
| 5.4 | Open the app after a session that ended over 10 minutes ago | No banner, however long the session was | PASS |

Afterwards, the server row shows the mark:

```sql
select started_at, ended_at, tier1_minutes + tier2_minutes + tier3_minutes as minutes, overactivity_warned_at
  from hr_session where player_id = '019fd954-0745-7748-9892-ce6f2e600c04'
 order by started_at desc limit 3;
```

### 6. A final boss's first defeat: Cerberus

Covers exit criteria 6 and 7. **This drill resets one row on the phone.** You've beaten both zone bosses that open a zone, and "first defeat" is read from the phone's bestiary. So Claude sets Cerberus's `defeat_count` back to 0 on the phone. Cerberus at Level 21 is below its L15 gate pressure, so the fight is about the text, not the cost.

**↯ The phone's bestiary is also what chooses the drop table**, so the rematch rolls Cerberus's first-kill drops again: the Fleet Omen, a Divine gear piece and Gatekeeper's Snare. With gear at the cap, expect prompts. That's a seeding artefact, not a defect.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 6.1 | Force-stop the app and tell Claude. Claude edits the phone's database and says when to reopen | — | PASS |
| 6.2 | Reopen, Road → Olympion, read Cerberus | `ready to battle`, with **Battle ›**. Valheon stays open | PASS |
| 6.3 | Fill Vigour, then tap **Battle ›** | A tap-through before the fight: `Three heads turn toward you at once — the gate they've guarded for an age finally has a visitor.` then `"The road ends here. It has ended here for longer than you can imagine."` | PASS |
| 6.4 | Try **Flee** | `There is no leaving this one.` | PASS |
| 6.5 | Win | After the final line lands: `All three heads go still. The gate behind them, sealed since before memory, groans open.` then `It guarded this gate faithfully, long after anyone came to open it. In its wake, something is left behind — a trick worth carrying north.` | PASS |
| 6.6 | Keep tapping | Valheon's entry narrative, four screens, ending `The road continues. Keep walking.` | PASS |
| 6.7 | Battle Cerberus again, and win | The intro again, then only `The gate remembers you. It opens without a fight.` No narrative | PASS |

### 7. Flavour, again

Covers exit criterion 8.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 7.1 | Road → **Bestiary** | Three zones. Met enemies show their name and type. Lemures, Griffin and Cacus read `???` and can't be tapped | PASS |
| 7.2 | Tap **Strix** | `It watches from just outside the torchlight — patient in the particular way that only something that used to be a person can be patient.` | PASS |
| 7.3 | Tap **Cerberus** | Its intro lines, then its first-defeat lines | PASS |
| 7.4 | If Explore Imperion grants a **Lemures**, battle it | Its flavour shows before the first round: `Restless dead who never got the burial rites owed to them. They don't want your road. They want to stop being forgotten.` Afterwards it's readable in the Bestiary | PASS — the first Lemures came from drill 10.6's Explore |

### 8. The Road

Covers exit criterion 9.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 8.1 | With several encounters waiting, read the encounters card | Two lines: the next enemy with its type (or `New`) and **Battle ›**, over `1 of N waiting on the road · Show all ▾`. One card high | PASS |
| 8.2 | Tap **Show all ▾** | Every waiting enemy, the first not repeated. `Show less ▴` closes it | PASS |
| 8.3 | Tap a zone card, then another | A filled radio dot moves with the selection, and the button reads `Explore Olympion`, `Explore Valheon` or `Explore Imperion` to match | PASS |
| 8.4 | Scroll away from the Waymarker and tap the **◆** button | The Road returns to your zone | PASS |
| 8.5 | Tap a defeated boss's row anywhere but **Battle again ›** | Nothing happens. Only the label starts a fight | PASS |

### 9. Reconciling one row by hand

**↯ Do not skip this drill.** It found a shipped defect in the last three milestones, and the rehearsal for this one found the resolved-reward defect (note 1).

Take drill 4's streak reward. Write down what the screen showed, then query and compare.

```sql
select milestone_kind, milestone_key, granted_at, overflow_fallback from milestone_grant
 where player_id = '019fd954-0745-7748-9892-ce6f2e600c04' order by granted_at desc limit 4;

select id, kind, gear_def_id, item_def_id, bonus_primary, source, resolution, resolved_at from pending_reward
 where player_id = '019fd954-0745-7748-9892-ce6f2e600c04' order by created_at desc limit 3;

select id, gear_def_id, bonus_primary, level_at_drop, source, equipped_slot from player_gear
 where player_id = '019fd954-0745-7748-9892-ce6f2e600c04' order by acquired_at desc;

select level from player where id = '019fd954-0745-7748-9892-ce6f2e600c04';
```

| Claim | How to check | Result |
| --- | --- | --- |
| One `streak_day` grant keyed `7`, and no second | Count the rows | PASS — one row keyed `7`, 2026-10-27 23:28:11 UTC |
| The parked reward is `gear_armor_mythic`, `streak_milestone`, resolved `kept` | Read `pending_reward` | PASS — `gear_armor_mythic`, `streak_milestone`, kept at 23:28:25 |
| Its bonus is `round(0.17 × L) + 3` at the level it was granted | 7 at L21 or L22 | PASS — 7 at L22: round(3.74) + 3 |
| The server holds a `player_gear` row for it, **under the same id the phone holds** | Claude reads the phone's id | PASS — `01a17fb1-892b…` on both sides, worn in the armour slot |
| The piece you left behind is gone on both sides, and both count 12 | Compare the lists | PASS — 12 gear and 20 items on each side, identical by id; nothing queued or parked |
| The Level 20 grant from drill 3 is one row, and the Sunder Oil is one `level_milestone` item | Count | PASS — one `level_item` 20 row. Two `level_milestone` Sunder Oils: the original from 2026-10-25 and the last re-grant; the two earlier re-grants were used in fights to make room (note 3) |

### 10. M4 still holds

Covers exit criterion 10. Spot checks against M4's eleven, as they read after M5 moved things.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 10.1 | Wear and take off an Accessory in the Satchel | Max Vigour moves with it on Character → Stats (M4 criteria 1–2) | PASS |
| 10.2 | Open a fight, then try to change gear | Not reachable: back is swallowed mid-fight (M4 criterion 3) | PASS |
| 10.3 | Read Character → Stats | The Vigour card first, and each stat's line readable before a point is spent (M4 criteria 4, 6) | PASS |
| 10.4 | Read a fight's slots | Every filled slot names its category (M4 criterion 5) | PASS |
| 10.5 | Read the streak card | Matches drill 4's count, no red, no loss copy (M4 criterion 7) | PASS |
| 10.6 | Fight three wild encounters, noting Vigour before and after | Each under 30% of the bar (M4 criterion 10). Record below | PASS — mean 13% over three Lemures, 3 rounds each |
| 10.7 | Turn the API off, force-stop, open the Road | It renders in full from the phone (M3) | PASS |

| # | Enemy | Before | After | Max | Rounds | Cost |
| --- | --- | --- | --- | --- | --- | --- |
| 10.6a | Lemures | 41 | 36 | 41 | 3 | 12% |
| 10.6b | Lemures | 36 | 30 | 41 | 3 | 15% |
| 10.6c | Lemures | 30 | 25 | 41 | 3 | 12% |

M4 criteria 8 and 9 are covered by drill 6.

---

## Exit criteria

M5 plan §5, against the drills above.

| # | Criterion | Evidence | Result |
| --- | --- | --- | --- |
| 1 | The Satchel tab shows Gear with four slots and Items, and Character no longer holds the Gear card | 1.1–1.3, 1.7 | PASS |
| 2 | A Trinket can be worn, and its bonus shows on both stats it splits across | 1.4–1.6 | PASS |
| 3 | A worn Mythic or Divine Trinket's move can be used in battle | 2.1–2.5 | PASS |
| 4 | A level milestone and a streak milestone each land once, and a replayed sync grants nothing | 3, 4, 9 | PASS |
| 5 | The overactivity banner appears once in a long session and never as a notification | 5 | PASS, simulated at a 10-minute threshold (note 7) |
| 6 | A boss fight opens with its intro lines and closes with its defeat text | 6.3, 6.5, 6.7 | PASS |
| 7 | A final boss's first defeat leads into the next zone's entry narrative | 6.6 | PASS |
| 8 | A wild enemy's flavour text can be read again after its first sighting | 7 | PASS |
| 9 | The Road's encounters card stays one row high, and one Explore button serves every zone | 8 | PASS |
| 10 | M4's eleven criteria still pass | 6, 10 | PASS |

## Notes

Write anything you notice here as you see it, not afterwards. Don't sort it or judge whether it's worth doing.

| # | Comment |
| --- | --- |
| 1 | Found while writing this sheet, 2026-10-26: a parked road find kept at 18:39 came back as a second prompt, and leaving the suggested piece the second time discarded the piece just kept. The phone held it under an id the server never saw. Fixed and committed before the drills (DECISIONS 2026-10-26), and the server row restored by hand. Drill 4 re-tests it |
| 2 | Pending rewards parked before P3b's `source` column read `level_milestone` whatever they were, including the Imperion zone-entry items kept on 2026-10-25. A migration backfill artefact, not a live defect |
| 3 | Drill 3, first run: the Level 20 reward reached the phone (server grant 23:30:27 UTC) but no reveal opened. A back gesture 14 s later cleared it unseen. Re-run after using a Sunder Oil in a fight to make room: the grant arrived at 23:41:01 and again no reveal, while a reveal row put back by hand **did** show on a fresh launch. Cause: both layouts treated a settled fight as still open, so everything that hides during a fight stayed hidden after one. Fixed (DECISIONS 2026-10-26). Drill 5 would have failed the same way after any fight |
| 4 | During drill 8, every defeated boss offered **Battle again**, and each rematch opened with its intro. Both as designed: GDD 12 §2 plays the intro at any boss encounter start, and only the four beaten bosses (Cyclops, Cerberus, Fenrir, Jörmungandr) offer a rematch; Griffin and Cacus stay locked. Open question for after the drills: should a rematch skip or shorten the intro? That would amend GDD 12 §2 |
| 5 | The `›` after **Battle ›** and **Battle again ›** is barely readable on the Pixel and looks more like a dot than an arrow. Not urgent; a legibility fix for later (a larger glyph or an icon) |
| 6 | Drill 4 opened three prompts, not one: step 10 parked the road find's item (items were at 20), its 25% Mortal weapon, and Paragon's Guard. All three were kept, and the Mortal weapon was later left behind as a suggestion. Correct per GDD 4 §5.2 and GDD 8 §5.5, and the resolved-reward fix held: no prompt came back, and both sides match by id |
| 7 | Drill 5 ran on 2026-10-28 with step 11's threshold temporarily lowered from 90 to 10 minutes, so a 15–20 minute walk could stand in for a 90-minute session. Never committed: the API was rebuilt at 10, then reverted and rebuilt at 90, and `SyncEndpoints.cs` matches HEAD. The 90 itself is covered by `OveractivityTests`. The session (21:54–22:13 UTC, 16 tier minutes) was marked once at 22:24:12; the sync that marked it read the last minute 10 minutes back, exactly at the open-session limit |
| 8 | |
