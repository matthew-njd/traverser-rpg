import type { StatDeltas } from '../sync/writes';

/**
 * The engine's vocabulary (T5 §2). Manifest keys everywhere — no display strings, no filenames.
 */

export type BattleSide = 'player' | 'enemy';

/** Physical reads Might vs Resolve; Divine reads Favor vs Aegis (GDD 2 §4), for both sides. */
export type MoveCategory = 'physical' | 'divine';

/** A move as the pipeline sees it, whether it came from a skill, a gear move, or an enemy row. */
export interface Move {
  readonly id: string;
  readonly category: MoveCategory;
  /** Null for Physical moves, which never take a type multiplier in either direction (T5 §3.3). */
  readonly typeId: string | null;
  readonly power: number;
}

/**
 * The whole effect model: six flags across two combatants (T5 §6).
 *
 * Deliberately not a general status system — GDD 3 §4.3's "no persistent state beyond one immediate
 * event" is a design constraint worth enforcing structurally. Each side carries the same shape, and
 * in the base game only some fields are ever set on each: the player holds `fortify`, `swift` and
 * `surge`; the enemy holds `weaken`, `rend` and `breach`.
 */
export interface CombatantEffects {
  /** Attacker's outgoing ×0.5. */
  readonly weaken: boolean;
  /** Defender's incoming ×0.5, player-side only. */
  readonly fortify: boolean;
  /** Defender's incoming ×1.5. */
  readonly rend: boolean;
  /** Acts first, overriding Stride. Consumed at the top of the round it governs. */
  readonly swift: boolean;
  /** Type key. Outgoing ×1.5 on a Divine move **of that type**. */
  readonly surge: string | null;
  /** Type key. Forces the defender's type multiplier to 2.0 for a Divine move **of that type**. */
  readonly breach: string | null;
}

export const NO_EFFECTS: CombatantEffects = {
  weaken: false,
  fortify: false,
  rend: false,
  swift: false,
  surge: null,
  breach: null,
};

/** The effects the damage pipeline can consume. `swift` is resolved by the round, not by a hit. */
export type ConsumableEffect = 'weaken' | 'fortify' | 'rend' | 'surge' | 'breach';

export interface Combatant {
  readonly side: BattleSide;
  /** The player has no type and never enters the chart as a defender (T5 §3.3). */
  readonly typeId: string | null;
  readonly stats: StatDeltas;
  readonly effects: CombatantEffects;
}

/**
 * T5 §7.1. Exactly two constructors produce these, so there is no path by which a wild encounter
 * acquires `crit: false`.
 */
export interface BattleRules {
  readonly crit: boolean;
  readonly randomFactor: boolean;
  readonly fleeable: boolean;
  readonly skillsEnabled: boolean;
  readonly itemsEnabled: boolean;
}

export type EncounterKind = 'wild' | 'mini_boss' | 'zone_boss' | 'tutorial' | 'explore';

/**
 * GDD 10 §6.1 — the tutorial bypasses crit, variance **and** the type chart, and is the only battle
 * that does. Frozen so nothing can widen it by mutation.
 */
export const TUTORIAL_RULES: BattleRules = Object.freeze({
  crit: false,
  randomFactor: false,
  fleeable: false,
  skillsEnabled: false,
  itemsEnabled: true,
});

/** GDD 2 §9 — all wild encounters are fleeable, none of the six bosses are. */
export function rulesFor(kind: EncounterKind): BattleRules {
  if (kind === 'tutorial') {
    return TUTORIAL_RULES;
  }

  return {
    crit: true,
    randomFactor: true,
    fleeable: kind === 'wild' || kind === 'explore',
    skillsEnabled: true,
    itemsEnabled: true,
  };
}
