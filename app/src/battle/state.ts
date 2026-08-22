import type { StatDeltas } from '../sync/writes';
import { type BattleContent, type EnemyDefinition, enemyStatsAt } from './content';
import { resolveDamage } from './damage';
import { consumeEffects, consumeSwift } from './effects';
import { type DropEncounterKind, type DropTables, type Drops, NO_DROPS, rollDrops } from './loot';
import type { Rng } from './rng';
import { weightedPick } from './select';
import {
  type BattleRules,
  type BattleSide,
  type Combatant,
  type CombatantEffects,
  type EncounterKind,
  type Move,
  NO_EFFECTS,
} from './types';

/**
 * The round state machine (T5 §7), enemy AI (§5), and the victory roll (§10).
 *
 * `step` is a pure reducer: `(state, action, rng) → { state, events }`. No React, no clock, no I/O.
 * That is what makes fixtures §3 and §10.8 executable as a fold over a list of actions rather than
 * documentation — `actions.reduce(step, initial)` with nothing else in the loop.
 */

/**
 * ↯ Only the phases a **snapshot can observe** (T5 §8.1). `ResolveFirst`/`ResolveSecond`/`RoundEnd`
 * from §7.2's diagram are transient within one synchronous `step` call and can never be seen from
 * outside — which is the actual reason the snapshot is written between turns rather than between
 * phases, and why they are not modelled as states here.
 */
export type BattlePhase = 'enemy_intro' | 'await_player' | 'victory' | 'defeat' | 'fled' | 'settled';

export type BattleOutcome = 'win' | 'loss' | 'flee';

export type TurnOrderReason = 'stride' | 'swift' | 'tie_roll';

export interface CombatantState {
  readonly vigor: number;
  readonly vigorMax: number;
  readonly stats: StatDeltas;
  readonly effects: CombatantEffects;
}

export interface BattleState {
  readonly phase: BattlePhase;
  readonly round: number;
  readonly rules: BattleRules;
  readonly encounterKind: EncounterKind;
  readonly enemyId: string;
  /** Always equals the player's level at encounter time (GDD 5–7, CLAUDE.md). */
  readonly enemyLevel: number;
  readonly player: CombatantState;
  readonly enemy: CombatantState;
  /** Who acts first this round, decided at round start. */
  readonly first: BattleSide;
  readonly firstReason: TurnOrderReason;
  /** Remaining uses per move id. A move absent from here has no per-battle limit. */
  readonly uses: Readonly<Record<string, number>>;
  readonly outcome: BattleOutcome | null;
  readonly drops: Drops | null;
  /** `player_item_id`s spent this battle, for the payload's `items_consumed` (T5 §10.3). */
  readonly itemsConsumed: readonly string[];
  /**
   * Read from the mirror at battle start and carried, **never re-read at victory** — the bestiary
   * row is incremented by the very battle being resolved (T5 §10.1).
   */
  readonly firstKill: boolean;
}

export type BattleAction =
  | { readonly kind: 'begin' }
  | { readonly kind: 'move'; readonly moveId: string }
  | { readonly kind: 'item'; readonly playerItemId: string; readonly itemDefId: string }
  | { readonly kind: 'flee' };

export type BattleEvent =
  | { readonly type: 'battle_started'; readonly enemyId: string; readonly encounterKind: EncounterKind }
  | { readonly type: 'turn_order_decided'; readonly first: BattleSide; readonly reason: TurnOrderReason }
  | { readonly type: 'move_used'; readonly actor: BattleSide; readonly moveId: string; readonly usesLeft: number | null }
  | {
      readonly type: 'damage_dealt';
      readonly actor: BattleSide;
      readonly target: BattleSide;
      readonly amount: number;
      readonly typeMultiplier: number;
      readonly wasCrit: boolean;
    }
  | { readonly type: 'effect_applied'; readonly on: BattleSide; readonly effect: string }
  | { readonly type: 'effect_consumed'; readonly on: BattleSide; readonly effect: string }
  | { readonly type: 'item_used'; readonly itemDefId: string; readonly healed: number | null }
  | { readonly type: 'vigor_changed'; readonly actor: BattleSide; readonly from: number; readonly to: number; readonly max: number }
  | { readonly type: 'battle_ended'; readonly outcome: BattleOutcome; readonly rounds: number; readonly playerVigor: number }
  | { readonly type: 'loot_rolled'; readonly drops: Drops };

export interface StepResult {
  readonly state: BattleState;
  readonly events: readonly BattleEvent[];
}

export interface BattleItem {
  readonly id: string;
  readonly category: 'heal' | 'buff' | 'surge' | 'breach';
  readonly healPct: number | null;
  readonly effect: string | null;
  readonly typeId: string | null;
}

/** Everything the reducer reads that is not in the state. Assembled once, before the battle. */
export interface BattleContext {
  readonly content: BattleContent;
  readonly enemy: EnemyDefinition;
  readonly moves: ReadonlyMap<string, Move>;
  readonly items: ReadonlyMap<string, BattleItem>;
  readonly tables: DropTables;
  readonly pool: readonly { itemDefId: string; weight: number; ordinal: number }[];
  readonly dropEncounterKind: DropEncounterKind | null;
}

function combatant(side: BattleSide, state: CombatantState, typeId: string | null): Combatant {
  return { side, typeId, stats: state.stats, effects: state.effects };
}

/**
 * T5 §7.3. Swift overrides Stride; both-Swift cancels and Stride applies; an exact tie takes one
 * draw, 50/50.
 *
 * ↯ **Effective Stride never includes gear** (GDD 8, fixtures §5, CLAUDE.md). There is no branch
 * here that adds a gear bonus, and `stats` arrives from the same derivation everything else uses —
 * the rule is enforced by the stat block having no gear term rather than by a check.
 */
export function decideOrder(
  player: CombatantState,
  enemy: CombatantState,
  rng: Rng,
): { first: BattleSide; reason: TurnOrderReason } {
  if (player.effects.swift !== enemy.effects.swift) {
    return { first: player.effects.swift ? 'player' : 'enemy', reason: 'swift' };
  }

  if (player.stats.stride !== enemy.stats.stride) {
    return { first: player.stats.stride > enemy.stats.stride ? 'player' : 'enemy', reason: 'stride' };
  }

  return { first: rng.next() < 0.5 ? 'player' : 'enemy', reason: 'tie_roll' };
}

/**
 * Round start: consume Swift, decide the order (T5 §4.1's draw 1, taken only on an exact tie with
 * neither side Swift).
 */
function startRound(state: BattleState, rng: Rng): StepResult {
  const { first, reason } = decideOrder(state.player, state.enemy, rng);

  return {
    state: {
      ...state,
      phase: 'await_player',
      first,
      firstReason: reason,
      player: { ...state.player, effects: consumeSwift(state.player.effects) },
      enemy: { ...state.enemy, effects: consumeSwift(state.enemy.effects) },
    },
    events: [{ type: 'turn_order_decided', first, reason }],
  };
}

/**
 * §5 — weighted selection over the enemy's moves, in primary-key order, one draw.
 *
 * ↯ **A single-move enemy takes no draw at all.** §4.1 takes draws lazily — "a rule that does not
 * apply takes no draw" — and with one candidate there is no selection to make. This is not an
 * optimisation: `enemy_waystone_wisp` has exactly one move, and T5 §11.3 requires the whole tutorial
 * to run under a ScriptedRng with an empty queue. Drawing here would make that fixture unexecutable
 * and would silently shift every draw index in fixtures §10.8 if the Harpy ever lost a move.
 */
export function selectEnemyMove(enemy: EnemyDefinition, rng: Rng): Move {
  const [only] = enemy.moves;

  if (only === undefined) {
    throw new Error(`${enemy.id} has no moves — an enemy with no move rows cannot act`);
  }

  if (enemy.moves.length === 1) {
    return only;
  }

  return weightedPick(enemy.moves, (move) => move.aiWeight, rng);
}

interface Resolution {
  readonly state: BattleState;
  readonly events: BattleEvent[];
  readonly lethal: boolean;
}

/** One combatant's attack, applied to the state. */
function attack(
  state: BattleState,
  context: BattleContext,
  actor: BattleSide,
  move: Move,
  rng: Rng,
): Resolution {
  const events: BattleEvent[] = [];
  const attackerSide = actor;
  const defenderSide: BattleSide = actor === 'player' ? 'enemy' : 'player';

  const attackerState = actor === 'player' ? state.player : state.enemy;
  const defenderState = actor === 'player' ? state.enemy : state.player;

  const usesLeft = state.uses[move.id];

  events.push({
    type: 'move_used',
    actor,
    moveId: move.id,
    usesLeft: usesLeft === undefined ? null : usesLeft - 1,
  });

  const result = resolveDamage({
    move,
    attacker: combatant(attackerSide, attackerState, actor === 'player' ? null : context.enemy.typeId),
    defender: combatant(
      defenderSide,
      defenderState,
      defenderSide === 'player' ? null : context.enemy.typeId,
    ),
    chart: context.content.chart,
    rules: state.rules,
    rng,
  });

  const vigor = Math.max(0, defenderState.vigor - result.damage);

  events.push({
    type: 'damage_dealt',
    actor,
    target: defenderSide,
    amount: result.damage,
    typeMultiplier: result.typeMultiplier,
    wasCrit: result.wasCrit,
  });

  events.push({
    type: 'vigor_changed',
    actor: defenderSide,
    from: defenderState.vigor,
    to: vigor,
    max: defenderState.vigorMax,
  });

  for (const effect of result.consumed) {
    events.push({
      type: 'effect_consumed',
      on: effect === 'weaken' || effect === 'surge' ? attackerSide : defenderSide,
      effect,
    });
  }

  // Effects consumed by this hit are cleared on whichever side held them.
  const attackerEffects = consumeEffects(
    attackerState.effects,
    result.consumed.filter((effect) => effect === 'weaken' || effect === 'surge'),
  );

  const defenderEffects = consumeEffects(
    defenderState.effects,
    result.consumed.filter((effect) => effect !== 'weaken' && effect !== 'surge'),
  );

  const nextAttacker: CombatantState = { ...attackerState, effects: attackerEffects };
  const nextDefender: CombatantState = { ...defenderState, effects: defenderEffects, vigor };

  const uses =
    usesLeft === undefined ? state.uses : { ...state.uses, [move.id]: Math.max(0, usesLeft - 1) };

  return {
    state: {
      ...state,
      uses,
      player: actor === 'player' ? nextAttacker : nextDefender,
      enemy: actor === 'player' ? nextDefender : nextAttacker,
    },
    events,
    lethal: vigor === 0,
  };
}

/** The player spends an item: heal, or arm a charm or buff. Takes the turn either way (GDD 4 §3). */
function useItem(state: BattleState, item: BattleItem, playerItemId: string): Resolution {
  const events: BattleEvent[] = [];
  let player = state.player;
  let healed: number | null = null;

  if (item.category === 'heal' && item.healPct !== null) {
    const restored = Math.floor((item.healPct / 100) * player.vigorMax);
    const vigor = Math.min(player.vigorMax, player.vigor + restored);

    healed = vigor - player.vigor;
    events.push({ type: 'vigor_changed', actor: 'player', from: player.vigor, to: vigor, max: player.vigorMax });
    player = { ...player, vigor };
  }

  // The charm lands on whichever side carries it: Breach is armed *on the enemy* (T5 §6).
  let enemy = state.enemy;

  if (item.category === 'surge' && item.typeId !== null) {
    player = { ...player, effects: { ...player.effects, surge: item.typeId } };
    events.push({ type: 'effect_applied', on: 'player', effect: 'surge' });
  } else if (item.category === 'breach' && item.typeId !== null) {
    enemy = { ...enemy, effects: { ...enemy.effects, breach: item.typeId } };
    events.push({ type: 'effect_applied', on: 'enemy', effect: 'breach' });
  } else if (item.category === 'buff' && item.effect !== null) {
    if (item.effect === 'weaken') {
      enemy = { ...enemy, effects: { ...enemy.effects, weaken: true } };
      events.push({ type: 'effect_applied', on: 'enemy', effect: 'weaken' });
    } else if (item.effect === 'fortify') {
      player = { ...player, effects: { ...player.effects, fortify: true } };
      events.push({ type: 'effect_applied', on: 'player', effect: 'fortify' });
    } else if (item.effect === 'swift') {
      player = { ...player, effects: { ...player.effects, swift: true } };
      events.push({ type: 'effect_applied', on: 'player', effect: 'swift' });
    }
  }

  events.push({ type: 'item_used', itemDefId: item.id, healed });

  return {
    state: {
      ...state,
      player,
      enemy,
      itemsConsumed: [...state.itemsConsumed, playerItemId],
    },
    events,
    lethal: false,
  };
}

function settle(
  state: BattleState,
  context: BattleContext,
  outcome: BattleOutcome,
  rng: Rng,
): StepResult {
  const events: BattleEvent[] = [];
  let drops: Drops = NO_DROPS;

  if (outcome === 'win' && context.dropEncounterKind !== null) {
    drops = rollDrops({
      encounterKind: context.dropEncounterKind,
      tables: context.tables,
      pool: context.pool,
      // Enemy level equals the player's level at encounter time (GDD 5–7), so it is the level the
      // bonus freezes against — and it is history, not a live value (T1 §4).
      level: state.enemyLevel,
      zoneId: context.enemy.zoneId,
      rng,
    });

    events.push({ type: 'loot_rolled', drops });
  }

  // GDD 2 §6 — a loss costs no XP and leaves the player at the 25% Vigor floor.
  const player =
    outcome === 'loss'
      ? { ...state.player, vigor: Math.floor(0.25 * state.player.vigorMax) }
      : state.player;

  events.push({
    type: 'battle_ended',
    outcome,
    rounds: state.round,
    playerVigor: player.vigor,
  });

  return {
    state: {
      ...state,
      phase: outcome === 'win' ? 'victory' : outcome === 'loss' ? 'defeat' : 'fled',
      player,
      outcome,
      drops: outcome === 'win' ? drops : null,
    },
    events,
  };
}

/**
 * The reducer.
 *
 * ↯ **`AwaitPlayer` is the single input boundary.** Every other transition is engine-driven, which
 * is what makes GDD 4 §3's "no inventory access outside the player's turn" fall out for free — there
 * is no state in which an item action is accepted other than this one.
 */
export function step(
  state: BattleState,
  action: BattleAction,
  context: BattleContext,
  rng: Rng,
): StepResult {
  // Terminal and idempotent (T5 §7.2) — which is what makes a resumed-then-completed battle safe
  // against a double submit into the outbox.
  if (state.phase === 'victory' || state.phase === 'defeat' || state.phase === 'fled' || state.phase === 'settled') {
    return { state, events: [] };
  }

  if (state.phase === 'enemy_intro') {
    if (action.kind !== 'begin') {
      throw new Error('the battle has not begun yet');
    }

    return startRound(state, rng);
  }

  if (action.kind === 'begin') {
    throw new Error('the battle has already begun');
  }

  if (action.kind === 'flee') {
    // GDD 2 §5.7 — retreat always succeeds, takes no draw, and rolls no loot. There is no success
    // roll anywhere in the GDD, so there is none here.
    if (!state.rules.fleeable) {
      throw new Error('this battle cannot be fled');
    }

    return settle(state, context, 'flee', rng);
  }

  const events: BattleEvent[] = [];
  let working = state;

  const playerTurn = (): Resolution => {
    if (action.kind === 'item') {
      if (!state.rules.itemsEnabled) {
        throw new Error('items are disabled in this battle');
      }

      const item = context.items.get(action.itemDefId);

      if (item === undefined) {
        throw new Error(`no such item: ${action.itemDefId}`);
      }

      return useItem(working, item, action.playerItemId);
    }

    const move = context.moves.get(action.moveId);

    if (move === undefined) {
      throw new Error(`no such move: ${action.moveId}`);
    }

    const remaining = working.uses[move.id];

    if (remaining !== undefined && remaining <= 0) {
      throw new Error(`${move.id} has no uses left`);
    }

    return attack(working, context, 'player', move, rng);
  };

  const enemyTurn = (): Resolution =>
    attack(working, context, 'enemy', selectEnemyMove(context.enemy, rng), rng);

  const order: (() => Resolution)[] =
    state.first === 'player' ? [playerTurn, enemyTurn] : [enemyTurn, playerTurn];

  for (const take of order) {
    const resolved = take();

    working = resolved.state;
    events.push(...resolved.events);

    // ↯ A KO by the faster combatant ends the battle **that instant** — the slower one does not act
    // (GDD 2 §5.3). Asserted on the event stream, not just the final state, because a second
    // `move_used` here is the whole bug.
    if (resolved.lethal) {
      const outcome: BattleOutcome = working.enemy.vigor === 0 ? 'win' : 'loss';
      const settled = settle(working, context, outcome, rng);

      return { state: settled.state, events: [...events, ...settled.events] };
    }
  }

  const nextRound = startRound({ ...working, round: working.round + 1 }, rng);

  return { state: nextRound.state, events: [...events, ...nextRound.events] };
}

/** Marks a settled battle as written out. Terminal either way; this is the outbox's bookkeeping. */
export function markSettled(state: BattleState): BattleState {
  return { ...state, phase: 'settled' };
}

export interface BattleStartInput {
  readonly encounterKind: EncounterKind;
  readonly rules: BattleRules;
  readonly enemy: EnemyDefinition;
  readonly enemyLevel: number;
  readonly playerStats: StatDeltas;
  readonly playerVigor: number;
  readonly uses: Readonly<Record<string, number>>;
  readonly firstKill: boolean;
}

/** Builds the opening state. The engine never decides *whether* a battle happens (T5 §1.7). */
export function beginBattle(input: BattleStartInput): { state: BattleState; events: BattleEvent[] } {
  const enemyStats = enemyStatsAt(input.enemy, input.enemyLevel);

  const state: BattleState = {
    phase: 'enemy_intro',
    round: 1,
    rules: input.rules,
    encounterKind: input.encounterKind,
    enemyId: input.enemy.id,
    enemyLevel: input.enemyLevel,
    player: {
      vigor: input.playerVigor,
      vigorMax: input.playerStats.vigor,
      stats: input.playerStats,
      effects: NO_EFFECTS,
    },
    enemy: {
      vigor: enemyStats.vigor,
      vigorMax: enemyStats.vigor,
      stats: enemyStats,
      effects: NO_EFFECTS,
    },
    first: 'player',
    firstReason: 'stride',
    uses: input.uses,
    outcome: null,
    drops: null,
    itemsConsumed: [],
    firstKill: input.firstKill,
  };

  return {
    state,
    events: [{ type: 'battle_started', enemyId: input.enemy.id, encounterKind: input.encounterKind }],
  };
}
