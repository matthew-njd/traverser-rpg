# Traverser Tech Spec — T5: Battle Engine

**Status:** locked. Inputs: GDD Sections 2, 3, 4, 5, 6, 7, 10, 13 §6 · `traverser-tech-01-data-model.md` · `traverser-tech-02-api-sync.md` · `traverser-tech-04-client.md` · `traverser-test-fixtures.md` · `traverser-data-manifest.md` · sanctioned scope trims.
**Scope:** the client-side battle engine — the damage pipeline, the type-chart rule, the effect model, the round state machine, enemy AI selection, RNG injection, the durable snapshot T4 §5.3 reserved a slot for, the post-battle loot roll, the payload handed to the outbox, and the test plan. No React, no screen code, no components — GDD 13 §6's battle screen consumes this engine's event stream and is built in M2.

**Why this spec is unusually prescriptive about arithmetic.** The engine is the one place in the app where a plausible-looking implementation produces subtly wrong numbers that no playtest will catch. §3 fixes the operation order down to where the `floor()` calls sit, because the obvious reading of the GDD's formula is off by one against the fixtures. Per CLAUDE.md: if code disagrees with a fixture, the code is wrong.

---

## 1. Decisions

**1.1 The engine is a pure reducer. No React, no I/O, no clock, no `Math.random`.**

```ts
function step(state: BattleState, action: BattleAction, rng: Rng): StepResult
// StepResult = { state: BattleState; events: BattleEvent[] }
```

Everything the engine needs — enemy stat scaling rows, move definitions, the type chart, drop tables — arrives as a plain `BattleContent` object read from the L1 content bundle before the battle starts. Everything the engine produces is a new `BattleState` plus an ordered list of `BattleEvent`s. It never touches SQLite, Zustand, the audio bus, or `Date.now()`.

The reason is not aesthetic. Fixtures §3 specifies the tutorial battle to the exact Vigor value on every line of a four-round table. That is only testable as a table-driven assertion if the whole fight is a fold over a list of actions — `actions.reduce(step, initial)` — with nothing else in the loop. The moment a timer, an animation callback, or a store subscription sits inside turn resolution, the fixture stops being executable and becomes documentation.

**↯** This is the inversion of the habit that transfers from web React, where game-ish logic tends to live in a `useReducer` inside the component that renders it. Here the reducer is a plain module in `src/battle/` with no React import at all; a thin Zustand store adapts it to the screen (§9). The engine test suite runs under Node with no renderer and no device.

**1.2 The tutorial's determinism is a rule flag, not a rigged RNG.**
`BattleRules.randomFactor: false` and `BattleRules.crit: false` cause the engine to *skip the draws entirely* rather than take them and discard the result. Feeding a fixed-value RNG would coincidentally produce the right answer today (a constant `0.5` yields `0.90 + 0.5 × 0.20 = 1.0` and `0.5 > 0.0625`), and that is exactly why it must not be done — it makes fixtures §3 pass for a reason unrelated to GDD 10 §6.1, and it breaks silently the day the random factor's range changes. The bypass is scoped to `encounterKind === 'tutorial'` and nothing else constructs those rules (§7).

**1.3 Damage floors the quotient before multipliers, then floors again.** §3.2. This is a correction to the natural reading of GDD 2 §7's formula line, forced by GDD 2 §7's own worked example and fixtures §2 agreeing against it.

**1.4 Minimum damage is 1.**
GDD 2 §7 defines no minimum; fixtures §2 row 4 flags one as owed without fixing the value. GDD 2 §3's "no immunities (0×) — every type can always deal some damage" is the governing rule, and a 0-damage result contradicts it directly and makes a non-terminating fight reachable (resisted Divine, low Favor, into Jörmungandr's Aegis). The clamp is `max(1, ...)` applied once, after the final floor. Logged in `DECISIONS.md`.

**1.5 Crits apply to enemies as well as the player.**
GDD 2 §7 says "flat 6.25% crit chance on every move, no stat or gear interaction." Every fight arc in GDD 5–7 models enemy damage without crits, but those are averaged illustrations, not a rule — and none of them state an exemption. One symmetric code path, one draw order. Logged in `DECISIONS.md` as the resolution of an ambiguity, not a deviation.

**1.6 The client rolls loot; the server records it.**
`drop_rate` and `enemy_drop_pool` are already client-cached content (T1 §7). The alternative — rolling server-side on battle ingest — would mean loot from a boss kill does not exist until the next sync, which with the API off by design (T2 §1.2) can be days. That is unacceptable for the core reward loop and for GDD 13 §6.3's Reveal Card, which fires on the victory screen. Drops are rolled by the engine at victory, written to the local mirror in the same transaction as the battle row, and ride to the server inside the battle payload. **This requires T2's battle payload to carry a `drops` array** — a cross-spec flag back to T2 (§12), not a deviation from it.

**1.7 The engine never rolls an encounter.** It consumes a grant from the mirror (T2 §1.3). There is no code path in `src/battle/` that decides *whether* a battle happens, only how one resolves.

---

## 2. Conventions

- **Integers stay integers.** Vigor, damage, stats, and Power are `number`s holding integers and are never allowed to acquire a fractional part outside the two floor points in §3.2. Multipliers are the only floats.
- **No mutation.** `step` returns a new state. The snapshot writer (§8) serialises whatever it is handed, so an in-place edit anywhere would corrupt a resumed fight in a way that only reproduces under memory pressure.
- **Manifest keys everywhere.** `enemy_harpy`, `skill_thunderers_wrath`, `item_travelers_salve`. No display strings and no filenames in engine logic; the event stream carries keys and the UI resolves them (§9).
- **One RNG, one draw order.** All randomness goes through the injected `Rng`. §4 fixes the order draws are taken in, because a seeded PRNG only makes a test reproducible if the draw sequence is stable.

---

## 3. The damage pipeline

### 3.1 ↯ The formula in the GDD is not the formula to implement

GDD 2 §7 states:

```
Damage = floor( ( (Power × AttackStat) / (DefenseStat × 8) ) × TypeMultiplier × CritMultiplier × RandomFactor )
```

Read literally, that is one trailing `floor()`. Applied to the super-effective case:

```
(65 × 30) / (18 × 8) = 13.5417
floor(13.5417 × 2.0) = floor(27.083) = 27
```

**GDD 2 §7's own worked example and fixtures §2 both say 26.** They floor the quotient first and multiply the integer:

```
floor((65 × 30) / (18 × 8)) = 13
13 × 2.0 = 26
```

Fixtures are the oracle (CLAUDE.md), and the double-floor reading is corroborated three independent times: fixtures §2's "base 13", GDD 2 §7's `→ 13 × 2.0 = 26`, and every deterministic value in fixtures §3 (`440/64 = 6.875 → 6`, `360/80 = 4.5 → 4`). A single-floor engine passes the two neutral fixture rows — `400/80` is exact and `1000/160 = 6.25` floors identically either way — and fails only on the super-effective row. **That is the trap:** the two easiest cases to reach for first cannot distinguish the two implementations, so this must be pinned by a test from the start (§11.2).

### 3.2 The pipeline, normatively

```
base      = floor( (Power × AttackStat) / (DefenseStat × 8) )      ← first floor

surge     = 1.5   if a Surge charm matching this move's type is armed on the attacker
          = 1.0   otherwise                                          (GDD 4 §2.3)

type      = 1.0   if the move is Physical, in either direction
          = 1.0   if the attacker is the enemy                       (GDD 2, fixtures §1)
          = 1.0   if the defender has no type (the Waystone Wisp)
          = 2.0   if a Breach charm matching this move's type is armed on the defender
          = chart[moveType][defenderType]  otherwise

rend      = 1.5   if the defender carries Rend
fortify   = 0.5   if the defender is the player and carries Fortify
weaken    = 0.5   if the attacker carries Weaken
crit      = 1.5   if rules.crit and rng draw < 0.0625
random    = 0.90 + rng draw × 0.20   if rules.randomFactor, else 1.0

damage    = max(1, floor( base × surge × type × rend × fortify × weaken × crit × random ))
                                                                     ← second floor, then clamp
```

`AttackStat`/`DefenseStat` are Might/Resolve for Physical and Favor/Aegis for Divine (GDD 2 §4), for both sides. All seven multipliers are commutative and the order above is fixed for readability, not correctness — but the two floor points are load-bearing and neither may move.

### 3.3 The type-chart rule, stated as the engine sees it

The chart is a lookup table; the *rule* is that it is consulted at all (T1 §3). It is consulted **if and only if** all of: the attacker is the player, the move is Divine, and the defender has a type. Every other combination is ×1.0. Breach overrides the looked-up value with 2.0 and cannot raise it above 2.0 (GDD 4 §2.3) — implemented as "Breach forces the value", not "Breach multiplies", so an already-super-effective hit is unchanged and the charm is still consumed.

Enemies carry types (GDD 5–7) purely so the *player's* moves can be scored against them and so GDD 13 §6.1's type icon has something to show. An enemy's Divine move uses Favor vs. the player's Aegis at ×1.0 — the player has no type and the table is never entered from that side.

### 3.4 Ceilings this produces

Three ×3.0 ceilings exist and all three are intentional (GDD 3 OQ, GDD 4's damage-ceiling check): Rend + super-effective, Surge + super-effective, and Surge + Breach. Nothing stacks past ×3.0 before crit, because Breach *forces* rather than multiplies and effects are non-stacking. With crit and the best roll the absolute single-hit ceiling is **×4.95** of the floored base (`3.0 × 1.5 × 1.10`).

**↯ The GDD's "never approaches a one-shot" claim is false, and T5 does not fix it.** Both GDD 3's and GDD 4's closed open questions assert the ×3.0 ceiling never one-shots even the squishiest wild encounter. Verified against real roster stats (fixtures §10.9), a Favor-specialized build one-shots Satyr at L6 and L15 and Cyclops at L10 and L15 at ×3.0 without a crit; at the ×4.95 ceiling **every enemy in the game one-shots, bosses included**. A *balanced* build matches the GDD's published turn counts closely, which is why the original modelling missed it — the gap is build specialization, not the formula.

The formula is locked and is implemented exactly as specified; nothing here changes game behaviour. The consequence for this spec is narrow and specific: **§11.5 asserts a bounded-damage property, not a survival property**, because the survival property is not true. Flagged to Matthew as a playtest item (§12), not resolved here.

---

## 4. Randomness

```ts
interface Rng { next(): number }   // uniform in [0, 1)
```

Three implementations ship:

| Impl | Use | Behaviour |
|---|---|---|
| `SystemRng` | production | `Math.random()`. Hermes' PRNG is fine here — nothing about this is security-sensitive, and T2 §1.1 keeps progression off the client so a biased draw cannot mint XP. |
| `SeededRng` | tests, property tests | xorshift128+ over a 32-bit seed. Reproducible across runs and machines; a failing property test reports its seed and is replayable. |
| `ScriptedRng` | fixture tests | A queue of exact values. **Throws on exhaustion and on unconsumed remainder at test end** — which is what turns "the AI picked the right move" into "the AI took exactly one draw and interpreted it as specified". |

### 4.1 ↯ Draw order is part of the contract

A seeded RNG only yields a reproducible fight if the number and order of draws per round is fixed. Draws are taken **lazily** — a rule that does not apply takes no draw — so the count varies by situation, and the order below is normative:

1. **Round start:** turn-order tie-break, *only* if neither side has Swift and effective Stride is exactly equal.
2. **Enemy action selection**, at the point the enemy acts (not at round start), one draw. §5.
3. **Per resolved hit, in resolution order:** crit draw, then random-factor draw. Skipped entirely when the corresponding rule flag is off (§1.2).
4. **On victory only:** the loot dice, in the fixed order item → gear → trinket, then one pool-selection draw per granted item. §10.

An action that ends the battle before the second combatant acts consumes no further draws that round (GDD 2 §5.3). Any change to this list is a breaking change to every `ScriptedRng` test and must be made deliberately.

---

## 5. Enemy AI

Every enemy in all three zones uses the same rule — GDD 5, 6, and 7 each say it in identical words: **weighted random selection each turn, no conditional logic.** No enemy has a threshold, a phase, an enrage, or a first-turn special. No enemy move carries a secondary effect (confirmed across all thirteen rosters); Weaken/Fortify/Swift/Rend are player-side only, which is what keeps the effect model in §6 as small as it is.

```
total = Σ weights of the enemy's moves          (do NOT assume 100)
roll  = rng.next() × total
scan moves in a fixed order, accumulating; select the first move whose
  cumulative weight strictly exceeds roll
```

Two details worth stating because both are easy to get wrong:

- **The scan order must be stable and content-derived** — order by `enemy_move` primary key, never by object-key iteration order or by a `Map` built from a JSON blob. An unstable order makes every `ScriptedRng` AI test flaky in a way that reproduces one run in ten.
- **Weights are integers summing to 100 in every current roster row** (70/30, 60/40, 35/45/20, …), but the engine normalises by the observed total anyway. Nothing should break the day a future enemy's weights sum to 7.

Uses-per-battle limits are a player-side resource (GDD 2 §4). Enemies have no use limits and cannot run out of moves, so there is no "struggle" fallback state.

---

## 6. The effect model

All four effects are single-trigger, non-stacking, and hold no duration (GDD 3 §4.3). Gear-granted moves — and therefore every gear-borne effect — come from the **Trinket slot only** (GDD 8 §1, narrowing GDD 3 §4.1's "any Mythic/Divine piece"); Weapon, Armor, and Accessory are pure stat bonuses at every tier. The entire model is six nullable flags across two combatants — deliberately not a general status-effect system, because GDD 3 §4.3's "no persistent state beyond one immediate event" is a design constraint worth enforcing structurally.

| Flag | Held by | Set by | Consumed when | Effect |
|---|---|---|---|---|
| `weaken` | enemy | Sunder Oil; a Weaken Trinket move | enemy's next attack resolves | attacker's outgoing ×0.5 |
| `fortify` | player | Ironhide Tincture; a Fortify Trinket move | player next takes a hit | defender's incoming ×0.5 |
| `rend` | enemy | a Rend Trinket move | enemy next takes a hit | defender's incoming ×1.5 |
| `swift` | player | Fleet Omen; a Swift Trinket move | top of the following round | acts first, overriding Stride |
| `surge: Type` | player | a Surge charm | player uses a Divine move **of that type** | attacker's outgoing ×1.5 |
| `breach: Type` | player→enemy | a Breach charm | enemy takes a hit from a Divine move **of that type** | forces defender's type mult to 2.0 |

**Non-stacking is an idempotent set**, not a counter: applying Fortify while Fortify is already held is a no-op, and the item is still consumed (GDD 4 §1 — "consumed immediately on use, regardless of whether the effect fires").

**Surge and Breach persist until a *matching-typed* move resolves.** GDD 4 §3 says an effect "persists until resolved by the qualifying trigger", and the qualifying trigger for a typed charm is a hit of that type — so arming Stormveil and then swinging Iron Advance neither consumes the charm nor boosts the swing. This is a judgment call on wording the GDD does not spell out; it is the reading that makes the charms usable as the setup tools GDD 4 §2.3's tactical profile describes, and it is logged in `DECISIONS.md`.

**Swift** is consumed at the top of the round it governs, whether or not it changed the order. If both sides hold Swift the effects cancel and Stride applies (GDD 3 §4.3) — no enemy in the base game grants Swift, so this branch is unreachable today. It is implemented anyway, in four lines, with a test: it is cheaper than the archaeology a future Egyptian-zone enemy would otherwise cost.

---

## 7. Battle configuration and the state machine

### 7.1 Rules

```ts
type BattleRules = {
  crit: boolean;          // false only for the tutorial
  randomFactor: boolean;  // false only for the tutorial
  fleeable: boolean;      // false for all six bosses and for the tutorial
  skillsEnabled: boolean; // false for the tutorial (GDD 10 §6.4 greys the button)
  itemsEnabled: boolean;
};
```

Exactly two constructors exist: `rulesFor(encounterKind)`, which returns the standard rules with `fleeable = kind === 'wild' || kind === 'explore'` (GDD 2 §9 — all wild encounters fleeable, all six bosses not), and `TUTORIAL_RULES`, a frozen literal. There is no path by which a wild encounter acquires `crit: false`.

### 7.2 States

```
        ┌──────────────┐
        │ EnemyIntro   │  boss dialogue overlay (GDD 12 via 13 §6.4); skipped for wild
        └──────┬───────┘
               ▼
        ┌──────────────┐
   ┌───▶│ RoundStart   │  resolve Swift, compute order, clear per-round scratch
   │    └──────┬───────┘
   │           ▼
   │    ┌──────────────┐
   │    │ AwaitPlayer  │  the only state that blocks on input
   │    └──────┬───────┘
   │           ▼
   │    ┌──────────────┐  first combatant acts; if defender hits 0 Vigor,
   │    │ ResolveFirst │  jump straight to a terminal state — the slower
   │    └──────┬───────┘  combatant does not act (GDD 2 §5.3)
   │           ▼
   │    ┌──────────────┐
   │    │ ResolveSecond│
   │    └──────┬───────┘
   │           ▼
   │    ┌──────────────┐
   └────┤  RoundEnd    │  increment round; re-enter RoundStart
        └──────┬───────┘
               ▼
   ┌───────────┴────────────┐
   ▼           ▼            ▼
Victory      Defeat       Fled          → Settled
```

- **`AwaitPlayer` is the single input boundary.** Every other transition is driven by the engine. GDD 4 §3's "no inventory access outside the player's turn" falls out for free: there is no state in which an item action is accepted other than this one.
- **Flee resolves immediately and always succeeds** — GDD 2 §5.7 grants retreat "at any time with no penalty beyond forfeiting that encounter's loot chance", with no success roll anywhere in the GDD. It takes no draw, ends the battle as `outcome: 'flee'`, spends the grant, and rolls no loot. The Flee button is rejected outright when `rules.fleeable` is false, with GDD 13 §6.4's flee-locked tooltip.
- **`Victory` runs the loot roll** (§10) before entering `Settled`; `Defeat` sets Vigor to `floor(0.25 × vigorMax)` (GDD 2 §6).
- **`Settled` is terminal and idempotent.** Re-entering `step` on a settled battle returns the same state and no events — which is what makes a resumed-then-completed battle safe against a double-submit into the outbox.

### 7.3 Turn order

```
if player.swift !== enemy.swift  → the Swift holder acts first
else                             → higher effective Stride acts first
                                   exact tie → one draw, 50/50 (GDD 2 §5.1)
```

**Effective Stride never includes gear** (GDD 8, fixtures §5, CLAUDE.md). The engine reads Stride from the same derivation everything else does and there is no branch in `src/battle/` that adds a gear bonus to it. §11.4 asserts this against a fully-Divine-geared L60 build.

### 7.4 The tutorial as an instance, not a special case

GDD 10 §6.4's battle is an ordinary `BattleState` with `TUTORIAL_RULES`, `enemy_waystone_wisp` (no type, one move, Stride 6 below the player's 10 so no tie draw is ever taken), and a scripted-prompt layer that lives in the *UI*, not the engine. The engine does not know it is a tutorial beyond the rule flags. This matters for §11.3: fixtures §3's four-round table is executed by feeding the same six actions a player would tap into the same `step` every other battle uses.

---

## 8. The snapshot

T4 §5.3 reserved `battle_snapshot` (at most one row) and assigned its shape here.

```ts
type BattleSnapshot = {
  schemaVersion: number;        // bumped whenever BattleState's shape changes
  clientBattleId: string;       // UUIDv7, minted at battle start, never re-derived (T2 §5)
  grantId: string;              // the encounter grant being spent
  startedAt: string;            // ISO-8601 with offset
  contentVersion: number;       // §8.1
  rngSeed: number | null;       // null in production (SystemRng); set under SeededRng
  state: BattleState;           // the whole thing — combatants, flags, uses, round, phase
};
```

Written **after every resolved turn**, inside the same transaction that spends an item or a use (T4 §5.3). Deleted in the same transaction that writes the `battle` row and the drops to the outbox — so there is no window in which a battle is both settled and resumable.

### 8.1 ↯ Three resume hazards, each with a defined answer

- **Content moved underneath it.** A sync between backgrounding and resuming can bump `content_version` (T2 §3) and change a move's Power. The snapshot records the version it started under; on mismatch the battle is **abandoned, the grant is returned unspent, and no `battle` row is written**. Resuming a fight whose numbers have changed mid-flight is worse than losing it, and the player keeps the encounter.
- **Schema moved underneath it.** An app update changing `BattleState`'s shape leaves a snapshot the new code cannot read. Same resolution, on `schemaVersion` mismatch: discard, return the grant. No migration path for snapshots — they live for minutes.
- **The player was mid-`AwaitPlayer`.** The common case, and the easy one: `AwaitPlayer` holds no partial input, so resume re-enters it and the screen redraws. **Every other phase is transient within a single synchronous `step` call and can never be observed in a snapshot** — which is the actual reason the snapshot is written between turns rather than between phases.

---

## 9. What the engine hands the UI

`BattleEvent` is a discriminated union consumed by GDD 13 §6's screen and by the audio bus. The engine emits; it never calls.

| Event | Carries | Consumed by |
|---|---|---|
| `battle_started` | enemy key, encounter kind, whether boss dialogue is due | intro overlay, `mus_battle` |
| `turn_order_decided` | who acts first, and why (`stride` \| `swift` \| `tie_roll`) | — (log/debug) |
| `move_used` | actor, move key, remaining uses | combat log, SFX |
| `damage_dealt` | actor, target, amount, `typeMultiplier`, `wasCrit`, effects applied | Vigor bars, damage numbers, §6.2's "Super Effective!" / "Resisted…" callout |
| `effect_applied` / `effect_consumed` | which flag, on whom | status pips, §6.4's first-time secondary-effect tooltip |
| `item_used` | item key, and heal amount if any | combat log, inventory count |
| `vigor_changed` | actor, from, to, max | Vigor bars |
| `battle_ended` | outcome, rounds, final player Vigor | victory/defeat screen |
| `loot_rolled` | items, gear, trinket — all as manifest keys | §6.3's Reveal Card |

The Zustand adapter in `src/state/` is thin by design: it holds the current `BattleState`, calls `step`, persists the snapshot, and pushes events onto a queue the screen drains for animation. **All battle logic sits below it**, so `src/battle/` stays importable by a Node test with no Expo in the module graph.

`typeMultiplier` is on the event rather than recomputed by the UI, so GDD 13 §6.2's post-hit callout and the pre-selection chevron cannot ever disagree with the damage that was actually dealt.

---

## 10. Victory: loot, XP, and the payload

### 10.1 The three dice

Per T1's `drop_rate` (item / gear / trinket for the encounter kind), rolled independently in that fixed order (T1 §3's "three independent dice per encounter", GDD 4 §7's suggested approach). `zone_boss_first` vs. `zone_boss_repeat` is selected on `player_bestiary.defeat_count === 0`, read from the mirror at battle start and carried in the state — **not re-read at victory**, since the bestiary row is incremented by the very battle being resolved.

Item pool: the enemy's `enemy_drop_pool` rows, weighted, if any exist; otherwise the generic common pool (T1 §3). `enemy_waystone_wisp` has no rows and no drop-rate entry for `tutorial`, so fixtures §3's "Drops: **None**" needs no special case in the engine — it falls out of the content being empty.

Per-type maxima (GDD 4 §5.1) are enforced **at acquisition**: an item already at its cap is not granted, and the roll is not re-drawn for a substitute. Inventory overflow past 20 slots surfaces GDD 13 §5.2's keep/discard prompt, which is a UI flow over a pending grant — the engine reports what was rolled and the mirror write happens after the player resolves the prompt.

### 10.2 XP is not computed here

`15 + level × 2` is applied **server-side** (T2 §2 step 4, T2 §1.1). The engine reports the outcome and the level held at encounter time; it does not add XP to the mirror. The optimistic projection in T4 §8.4 may *preview* battle XP on the victory screen under the same rules everything else follows — and per T4 §14, never previews a level-up.

### 10.3 The payload

One outbox entry per settled battle, written with the drops and the Vigor result in a single transaction (T2 §7 — "item consumption and Vigor changes ride along with the battle payload"):

```
client_battle_id, grant_id, enemy_id, encounter_kind, enemy_level,
outcome, started_at, ended_at,
vigor_after,
items_consumed[],            // player_item_ids spent during the fight
drops: { items[], gear[], trinket? }   ← new; see §12
```

`enemy_level` equals the player's level at encounter time and is recorded as history (T1 §4). `client_battle_id` is minted at battle start under T2 §5's never-derive-from-content rule, so a resumed battle keeps the ID it began with and a replayed payload is a no-op rather than a repeat.

---

## 11. Test plan

Pure TypeScript, Node, no renderer, no device (T4 §12). Every table below asserts against `traverser-test-fixtures.md` directly — no expected value is re-derived from GDD prose.

### 11.1 Type chart — fixtures §1

All **36 cells** as a table-driven test, plus four rule guards that the matrix alone cannot catch and that are the most likely thing to regress:

- Enemy Divine move vs. player → ×1.0, asserted for a Storm enemy (Harpy) and an Underworld enemy (Cerberus), i.e. from both an "advantaged" and a "disadvantaged" row of the chart.
- Physical move → ×1.0 in **both** directions.
- Player Divine vs. a typeless enemy (the Wisp) → ×1.0.
- The Sea/Wisdom asymmetry called out three times in GDD 6/7: `Wisdom→Sea = 0.5` and `Sea→Wisdom = 2.0`. A transposed matrix passes 24 of 36 cells; this pair is one of the twelve that catches it, and it is the pair the GDD says players find counterintuitive — so it is also the one a "fix" is most likely to be applied to by mistake.

### 11.2 Damage — fixtures §2, and the double-floor guard

The four fixture rows, then:

| Guard | Asserts |
|---|---|
| **Double-floor** — P65, Favor 30, Aegis 18, ×2.0 → **26** | §3.1. A single-floor engine returns 27. This is the highest-value single test in the suite. |
| Minimum damage | A resisted Divine hit from a low-Favor build into Jörmungandr's L40 Aegis 32 returns ≥ 1, never 0 (§1.4). |
| Crit and random are multiplicative on the floored base | `base 13` → crit → 19 (`floor(13 × 1.5)`), not `floor(13.54 × 1.5)` = 20. |
| Random-factor bounds | Over `SeededRng`, damage stays within `[floor(base × 0.90), floor(base × 1.10)]` for 10⁴ draws. |
| Stat-pair selection | A Physical move against an enemy with high Aegis and low Resolve reads Resolve; the Divine mirror-image reads Aegis. Swapping the pair is invisible on any mirror-match fixture. |

### 11.3 The tutorial — fixtures §3, executed end to end

Not four assertions but one: feed the six actions of GDD 10 §6.4's script into `step` and assert the **entire** round-by-round table — Wisp Vigor `15 → 9 → 3 → 0`, player Vigor `20 → 16 → 12 → 16 → 12`, final state win at 12/20 in 4 rounds, `+4` Salve heal, and **zero drops**.

Two negative assertions belong here and nowhere else:
- The battle runs under `ScriptedRng` with an **empty queue**, so any draw at all throws. That is what proves §1.2's bypass skips the draws rather than taking and discarding them.
- `rulesFor('wild')` and `rulesFor('zone_boss')` both return `crit: true, randomFactor: true` — the tutorial exception cannot leak.

### 11.4 Stats and turn order — fixtures §6

All **36 enemy rows** at their reference levels against `floor(base + rate × L)`, sourced from the content bundle rather than hardcoded, so the test also catches a bad seed. Then:

- Enemy level equals player level at encounter time — asserted through the encounter constructor, since it is a property of how battles are built rather than of how they resolve.
- **Stride ignores gear:** an L60 build with four Divine pieces equipped produces the same turn order as the same build unequipped, against Strix L60 (Stride 57 — one of the few enemies fast enough for a gear bonus to plausibly flip the order).
- Swift beats a higher Stride; both-Swift cancels to Stride; exact tie takes exactly one draw and both outcomes are reachable under `ScriptedRng`.

### 11.5 Effects

Per effect: applies, multiplies correctly, is consumed by the qualifying trigger, is **not** consumed by a non-qualifying one, and is a no-op when re-applied. Then the ceilings from fixtures §9:

All values from fixtures §10.4 (Cerberus L15, Aegis 15, Favor 30):

- Plain SE 32; Rend + SE 48; Surge + SE 48; Surge + Breach 54.
- Breach forces ×2.0 and does **not** stack to ×4.0 on an already-SE hit (32, not 64); Breach alone vs. natural resisted is 36 vs 9, GDD 4 §2.3's 4× swing.
- Surge armed for Storm, Iron Advance used → not consumed, not boosted (§6, fixtures §10.5).
- Breach armed for Sea, Storm move used → not consumed, chart value stands.
- **Bounded damage, not survival:** `1 ≤ damage ≤ floor(base × 4.95)` for every hit. Asserting that a maximally-buffed hit leaves the target standing would encode a false property — see §3.4 and fixtures §10.9.

### 11.6 State machine and AI

- A KO by the faster combatant ends the battle **that instant** — the slower combatant emits no `move_used` event (GDD 2 §5.3). Asserted on the event stream, not just the final state.
- Uses decrement, hit zero, and the move is rejected; uses reset at the start of a new battle.
- Flee succeeds from a wild encounter, is rejected under `rules.fleeable === false`, rolls no loot, and takes no RNG draw.
- `Settled` is idempotent under repeated `step`.
- **AI weighting:** boundary tests under `ScriptedRng` — for Cerberus (35/45/20) the draw values `0.0`, `0.3499`, `0.35`, `0.7999`, `0.80`, `0.9999` select the exact expected moves, which pins both the cumulative-scan direction and the strict-inequality boundary. Then a `SeededRng` distribution check over 10⁵ selections within tolerance, and a non-100-summing weight set to prove the normalisation.

### 11.7 Snapshot and integration

- Round-trip: serialise mid-fight, deserialise, continue — the completed fight is identical to the uninterrupted one under the same seed.
- `contentVersion` mismatch and `schemaVersion` mismatch each abandon the battle, return the grant, and write no `battle` row (§8.1).
- The **replay test**, following T4 §12's precedent: settle a battle, submit the payload, submit the byte-identical payload again — one `battle` row, one set of drops, one bestiary increment.
- A **property test** over `SeededRng`: for 10³ random seeds across random level/enemy/loadout combinations, every battle terminates within a bounded round count, Vigor never goes negative or exceeds max, and no damage value is ever 0.

### 11.8 Fixtures T5 owes

`traverser-test-fixtures.md` covers the chart, the four damage cases, the tutorial, and enemy stats. These eight rows do not exist yet and must be added — machine-verified — **before** the code that satisfies them:

**DELIVERED** — added as fixtures **§10**, machine-verified 2026-07-26 by executing the §3.2 pipeline rather than transcribing prose:

1. §10.1 — the double-floor case as `base → ×mult → result`, plus the four neutral cases that pass under *either* reading and therefore cannot pin the rule.
2. §10.2 — minimum damage: Shadowstep from an L60 pure-Might build into Cacus L60's Aegis 45, pre-clamp `0` → `1`.
3. §10.3 — crit on the floored base: `13` → `19` (not 20).
4. §10.4 — the three ×3.0 ceilings at Cerberus L15, plus Breach's non-stacking and its 4× swing.
5. §10.5 — Surge and Breach non-consumption on a mismatched move.
6. §10.6 — enemy-side crit at Cerberus L15 Death Breath (the fixture that pins §1.5).
7. §10.7 — Stride tie, Swift-vs-higher-Stride, gear-never-affects-Stride, both-Swift cancellation.
8. §10.8 — a full worked Harpy L15 battle, round by round, under an **explicit 18-value draw sequence** rather than a PRNG seed, so the fixture is implementation-independent. All 18 draws are consumed, which also pins §4.1's draw order.

§10.9 records the one thing that could not be written as a passing fixture: the GDD's "never one-shots" claim, and why §11.5 asserts a bound instead.

---

## 12. Cross-spec flags

- **T2 (API & Sync) — RESOLVED, T2 amended 2026-07-26.** T2 §2 step 2 ingested `battle` rows but carried no loot. T2 now has a **§4.1** specifying the battle payload including the `drops` array, its frozen-bonus fields, and the trust boundary the change moves; step 2 materialises drops only for the `RETURNING` set, so a replay grants nothing twice; the §6 replay worked example now asserts **0 duplicate drops**. T1 needed no change — `player_item`, `player_gear`, and the frozen-bonus rule (T1 §4) already supported it.
- **T2 — grant return on abandonment: RESOLVED, no change needed.** §8.1 abandons a battle whose content or schema moved and returns the grant unspent. Because grants are held client-side until spent (T2 §1.3), "return" is a local no-op and the `grant_already_spent` path is simply never reached. Recorded in T2's cross-spec flags so it is not rediscovered.
- **T1 (Data Model):** both rules T1 §7 deliberately declined to encode are implemented here — the chart applying only to the player's typed attacks (§3.3) and the tutorial bypass (§1.2, §7.4). T5 introduces no new content tables and no new IDs.
- **T4 (Client):** §8 delivers the snapshot shape T4 §5.3 assigned. T4's requirement that the snapshot write share a transaction with any item or use spend is met. `src/battle/` stays free of React and Expo imports (§1.1, §9) so T4 §12's "formula tests are pure TypeScript" holds for this spec's entire test suite.
- **GDD 2 — two clarifications, one correction.** Minimum damage (§1.4) and enemy crits (§1.5) resolve genuine ambiguities. The floor placement (§3.1) is a correction to GDD 2 §7's formula *line*, made in favour of GDD 2 §7's own worked example — the behaviour the GDD intends is unchanged, only its notation was wrong. No game behaviour is altered to make code simpler.
- **GDD 2 §7 — erratum in the worked example's flavour text.** The super-effective example describes "a Sea-aligned enemy (Aegis 18, ×2.0 vs Storm)", but the chart in the same section puts **Storm → Sea at 0.5×**; Storm is super-effective against War and Trickery. The *numbers* are right and fixtures §2 is unaffected (it names no types), so this is a one-word documentation fix, not a balance issue. Naming the enemy War- or Trickery-aligned corrects it.
- **GDD 3 / GDD 4 — a closed open question that should be reopened.** Both sections close their damage-ceiling questions as "validated, never approaches a one-shot." Fixtures §10.9 shows that is false for a Favor-specialized build: ×3.0 one-shots Satyr and Cyclops at their normal encounter levels without a crit, and the ×4.95 ceiling one-shots every enemy in the game including Cacus at L60. **T5 implements the locked formula unchanged and asserts a bound rather than a survival property (§11.5).** This is Matthew's call, not the engine's, and it is partly self-limiting — a 100%-Favor build sits at Vigor 20 all game. Worth a playtest pass; if it does need addressing, the lowest-friction levers are Surge's ×1.5 or the per-battle charm supply, both content-table edits requiring no engine change.
- **GDD 3/4 — one judgment call.** Surge/Breach persist until a matching-typed move (§6). The GDD's "persists until resolved by the qualifying trigger" does not define the qualifying trigger for a typed charm.
- **GDD 13 (UI Architecture):** no deviations. §9's event stream supplies everything §6.1–§6.4 renders, including `typeMultiplier` on `damage_dealt` so the post-hit callout and the pre-selection chevron cannot disagree.
- **Manifest:** T5 introduces no content IDs. It does make `enemy_move` weights and `enemy_drop_pool` load-bearing at runtime for the first time — an enemy whose move rows are missing produces a battle with no enemy actions, which §11.6 does not currently catch. A content-bundle validation pass at seed time (every enemy has ≥1 move; weights are positive) belongs in T6 or M0, not in the engine.

---

## 13. Deferred by design

| Deferred | Why / how it lands |
|---|---|
| Multi-enemy encounters | Nothing in GDD 5–7 has one. `BattleState` holds a single enemy; generalising later is a shape change, not a rule change. |
| Enemy secondary effects, phases, conditional AI | GDD 5–7 say "no conditional logic" in identical words thirteen times. §5 is the whole AI. The Swift-cancellation branch is the one exception, kept live for forward compatibility. |
| Battle animation timing, sprite choreography | GDD 13 §6 / M2. The engine resolves a turn synchronously; pacing is the UI's problem, which is why events are a queue and not callbacks. |
| Damage-number balance retuning | GDD 2 §9 and GDD 3 §5 both close their balance questions as validated. Any retune is a content-table edit plus a fixtures regeneration, not an engine change. |
| Anti-cheat on client-rolled loot | Sanctioned trim (no data-integrity work). T2 §1.1 keeps XP server-side, which bounds what a tampered client can mint to items and gear. |
| Seeded/replayable battles as a player-facing feature | `SeededRng` and the snapshot's `rngSeed` field make it nearly free later; nothing is built for it now. |
