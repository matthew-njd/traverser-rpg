# Traverser M6 build plan — "The Song"

**Milestone:** M6. **Predecessor:** `traverser-m5-plan.md` (complete, 2026-10-28).
**Theme:** dress the finished game, and ship it untethered.

M5 finished the game: every reward, slot, story beat and screen the GDDs ask for is built and
verified on the Pixel. What remains is the half Matthew split off on 2026-10-24 (DECISIONS):

- **The game is silent.** All 63 audio keys resolve to silent placeholder `.wav` files, and no
  audio library is installed.
- **The game is unillustrated.** Enemies, gear and the Road draw placeholder sprites, and the art
  phase GDD 13 §10 hands off has never had a milestone.
- **The game is tethered.** The dev build cannot start without Metro and a cable, which is why M5's
  drill 5 had to be simulated.

---

## 1. The ordering constraint that shapes this milestone

**Every native change lands in one rebuild, first.** `expo-audio` and `expo-notifications` are
native modules, and `metro.config.js` changes the bundle. Each forces a prebuild, and every prebuild
needs the manual ninja swap (README). Batching them into P1 means one rebuild instead of three.

**The release build comes with it.** A signed APK runs without Metro, so every drill after P1 can
leave the house. M5 §7.1 asked for exactly this.

The rest is looser. Sound and art are independent of each other. Each starts with a sourcing
decision (§3.2), and the manifest-keyed registry makes real assets drop in where placeholders are
(§3.3).

---

## 2. Scope

### 2.1 In

| Item | Source | Note |
|---|---|---|
| Native modules, `metro.config.js`, and the signed release APK | T4 §9.3, T6 §7.2 | `ogg` joins `assetExts` (DECISIONS 2026-08-01). Recorded at M0 close-out. |
| Source-map upload | T6 §9 | Off since M0 because it needs `SENTRY_AUTH_TOKEN` and `@sentry/cli`, whose postinstall npm blocks (DECISIONS 2026-08-01). Decided at P1. |
| The audio bus: music, transitions, stingers | GDD 14 §2–5 | Includes `stg_overactivity` with the banner (M5 P4). |
| Sound effects | GDD 14 §6 | Combat, actions and items, navigation, overworld. |
| Audio sliders in Settings | GDD 14 §2.8 | No audio bus until now (M1 §2.2). |
| The fixed-time daily notification, and its permission screen | GDD 11 §6–7, GDD 10 §3.3, §8.3 | Local notifications only (CLAUDE.md). |
| The art phase | GDD 13 §10 | By name, from M4 §2.2 via M5 §2.2: battle sprites and animation choreography (T5 §13), zone visual identity and Road art (GDD 9 §6), layered gear sprites with tier colours (GDD 8). Plus iconography: the type chevrons (GDD 13 §6.2) and the `›` that reads as a dot (M5 drill note 5). |
| The home-lab decision | T6 §11 | Named "M5" before the split; T6 amended 2026-10-28. |
| The second restore drill | T6 §10.6 | Same. |
| Device drills, close-out review, wrap-up | — | The M5 form, on the release build. |

### 2.2 Out, and where it lands

| Item | Milestone | Why |
|---|---|---|
| Conditional notifications: Streak-at-Risk, and a nudge only when the goal is unmet | trimmed | GDD 11 §7.1 needs today's total at 7 PM and 9 PM, and nothing runs in the background (CLAUDE.md). The fixed-time trim is sanctioned. See §3.2 for what a fixed-time nudge can still honour. |
| The Streak Milestone push | trimmed | GDD 11 §7.1 sends it server-side, which needs a push service. Local notifications only, $0. The in-app reveal already announces it. |
| Sign-in resurfacing | trimmed | GDD 11 §7.3. Guest-only local profile, no auth flows (CLAUDE.md). |
| Analytics events, including GDD 13 §10's two view events | trimmed | Sentry only (CLAUDE.md). |
| A respec | undecided | Carried from M4 and M5 §2.2. A design question, not a gap. |
| In-game codex or help screen | undecided | Carried. Needs a GDD 13 amendment first. |
| Shorten or skip a boss's intro on a rematch | undecided | M5 drill note 4. A GDD 12 §2 amendment first. |
| A further pass on the battle screen's UI | undecided | Matthew may revisit it after M5's P7c. No known defect. |
| The Egyptian zone | Phase 2 | GDD 9, GDD 12 §9. |

---

## 3. Decisions taken at plan time

### 3.1 Placeholders first, so every packet is testable on its own

The asset registry resolves by manifest key and prefers `{key}.ogg` over `{key}.wav` (DECISIONS
2026-08-01). So the audio bus and the art screens can be built and tested against today's
placeholders, and real files replace them key by key without touching code. A packet never waits on
a delivery, and a delivery never needs a code change.

### 3.2 Five questions are open, and are answered at their packet

These are not decided here (DECISIONS records a decision only after Matthew picks).

1. **How art is sourced on a $0 stack** (P5). GDD 13 §10 hands it to "a separate Claude Project".
   The options include free-licensed packs, generated art, drawn art, or a stylised set that leans on
   GDD 13 §11's existing skin. Any licence must allow redistribution in a sideloaded APK.
2. **How sound is sourced on a $0 stack** (P2). The same licence rule. `.ogg` needs an encoder, and
   none was in the toolchain at M0.
3. **GDD 14's play-once intro** (P2). `expo-audio` loops the whole file, so the intro repeats
   (DECISIONS 2026-07-26). Decide with real assets in hand whether that matters.
4. **What the fixed-time nudge honours** (P4). It can't know today's total at 7 PM without a
   background read. It can be cancelled whenever the app opens and finds the goal met, and
   rescheduled for tomorrow, which keeps GDD 11 §7.2's "never nag an active player" on any day the
   app was opened.
5. **The home-lab hardware** (P6). T6 §11.3's trigger is wanting the API reachable while the
   desktop is off. Recording "not yet" is a valid decision.

### 3.3 One native rebuild, and Context7 before it

P1 installs both native modules together. Their Android permissions, `POST_NOTIFICATIONS` and
whatever exact-time scheduling needs on the Pixel's Android version, are checked against current
Expo documentation through Context7 at the packet, not recalled.

---

## 4. Packets

### P1 — Native modules, and the release build (T4 §9.3, T6 §7.2)

- ↯ **Install `expo-audio` and `expo-notifications` in one change, then prebuild once.** The ninja
  swap applies (README).
- `metro.config.js` with `ogg` in `assetExts`, through `getSentryExpoConfig`.
- Decide source-map upload (§2.1).
- A signed release APK, sideloaded, syncing over Tailscale with no cable.

**Tests:** the registry still resolves every key; a release build boots with Metro off.

### P2 — The audio bus (GDD 14 §2–5)

- Answer §3.2 questions 2 and 3.
- Music by screen and zone, crossfades, battle entry and exit, stinger layering and priority (§5.5).
- `stg_overactivity` fires when the banner renders, and never mid-session (GDD 14 §3.7).
- Settings sliders, mapped to GDD 14 §2.8's volume buckets, persisted.
- Not here: GDD 14 §4.2's low-Vigor boss layer. It needs six manifest keys, added when sound is
  sourced (DECISIONS 2026-10-28).

**Tests:** the trigger table maps every GDD 14 §3 condition to one key; §5.5's priority resolves
concurrent triggers; a slider at zero mutes its bucket.

### P3 — Sound effects (GDD 14 §6)

- Combat impacts, actions and items, navigation and menus, overworld and retention.

**Tests:** every §6 key is triggered from exactly one place.

### P4 — The daily notification, and Screen 10 (GDD 11 §6–7, GDD 10 §3.3, §8.3)

- Answer §3.2 question 4.
- Screen 10 asks after the tutorial and the account prompt, not at first launch. A denied answer
  changes nothing else.
- GDD 11 §6's Daily Nudge copy, at 7:00 PM local, one a day at most (§7.2). Amended while building: the
  player chooses the hour, and tonight's nudge states the steps known at the last open and when
  (DECISIONS 2026-10-28, 2026-10-29).
- No notification of any kind for a broken streak (GDD 11 §7.2, CLAUDE.md).

**Tests:** scheduling is idempotent across opens; the cancel rule from question 4 holds across
midnight; no code path schedules on a streak reset.

### P5 — The art phase (GDD 13 §10)

- Answer §3.2 question 1. This packet likely splits once the sourcing is known.
- Enemy and battle sprites, and the animation choreography T5 §13 leaves to art.
- Gear: layered sprites and tier colours (GDD 8, GDD 13 §5.1).
- The Road: zone identity and segment art (GDD 9 §6).
- Iconography: the type chevrons (GDD 13 §6.2) and the Battle `›` (M5 note 5).
- The Waymarker's forward-sync animation (GDD 9 §5), which `stg_waymarker` fires on. Found
  unbuilt at P2 (DECISIONS 2026-10-28).

**Tests:** every manifest art key resolves to a delivered file; no placeholder is reachable in
normal play.

**Split on 2026-10-29, once sourcing was decided** (DECISIONS 2026-10-29). The art is game-icons.net
silhouettes (CC BY 3.0), edited to match, and lives in this repo:

- **P5a — Pipeline.** SVG sources in `app/art/`, an export script rendering transparent PNGs at
  1×, 2× and 3×, a Credits row in Settings for the CC BY attribution, and one sprite component wired
  into every plate, falling back to today's glyph while a key is still a placeholder.
- **P5b — The 52 manifest sprites.** Enemies, items and gear.
- **P5c — The avatar and layered gear.** Needs a manifest key for the Traverser's base figure, and
  an answer to black-on-black layers merging into one shape.
- **P5d — The Road.** Zone art (new manifest keys), and the Waymarker's forward animation with
  `stg_waymarker` and `sfx_footstep_loop`.
- **P5e — Battle motion and iconography.** T5 §13's choreography as transforms (lunge, hit, faint),
  the type chevrons and the Battle `›`.

### P6 — The home-lab decision, and the second restore drill (T6 §10.6, §11)

- Answer §3.2 question 5, and record it in T6 §11.
- ↯ **Restore from the ledger, never from a written-down number** (M3, M4 drills). Run §10.6
  against a real nightly dump.

### P7 — Device drills

The M5 form, **on the release build**. Write the drills against the build, reconcile one real row by
hand, and plan any long-input drill's simulation upfront (M5 §7.1).

### P8 — Close-out review

M5's ten-item checklist, unchanged. At item 5, diff M5 §2.2 and every earlier drill note against
this plan.

### P9 — Wrap-up

- README, `DECISIONS.md`, tech specs amended in place.
- This plan's §7 delivery table, §7.1 divergences and §7.2 close-out result.
- The next plan, or the Phase 2 kickoff.

---

## 5. Exit criteria

Verified at P7, before the wrap-up. M6 is done when, on the Pixel, on the release build:

1. The signed APK runs with no cable and no Metro, and syncs over Tailscale.
2. Each screen plays its GDD 14 track, and a battle enters and exits on §5's transitions.
3. Stingers fire on their triggers, `stg_overactivity` with the banner.
4. Sound effects play for combat, navigation and the overworld.
5. Settings' volume sliders change music and effects, and survive a restart.
6. Screen 10 asks for notification permission after the tutorial, and a denial changes nothing else.
7. The daily notification arrives at its fixed time, and nothing is ever sent for a broken streak.
8. No placeholder art is visible in normal play.
9. The home-lab decision is recorded, and the second restore drill passes.
10. M5's ten criteria still pass.

---

## 6. Cross-spec flags

- **Note 2 (encounters never expire) remains spec-correct and unaddressed.** Carried from M4 §6 and
  M5 §6.
- **GDD 13 §10 places the art phase in "a separate Claude Project".** P5 decides whether that still
  holds, and amends GDD 13 if it doesn't.
- **GDD 11 §7.1's split between local and server evaluation assumed a push service.** Under the
  local-only trim, only the fixed-time nudge survives. P4 amends GDD 11 §7 to say so, so the trim
  lives in the spec and not only in CLAUDE.md.
- **T4 §9.3 still names `.ogg`, and M0 shipped `.wav` placeholders.** P1's `metro.config.js` closes
  the bundling half. The encoder is part of question 2.
