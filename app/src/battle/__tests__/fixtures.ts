import type { StatDeltas } from '../../sync/writes';
import { EMBEDDED_BUNDLE } from '../../content/embedded.generated';
import { parseBundle } from '../../content/bundle';
import { type BattleContent, battleContentFrom } from '../content';
import { NO_EFFECTS, type Combatant, type CombatantEffects, type Move } from '../types';

/**
 * Shared scaffolding for the engine suite.
 *
 * ↯ Content comes from the **embedded bundle**, not from hand-written literals. Enemy stats, move
 * Powers and the type chart are all seeded content, and a test that restates them proves only that
 * two transcriptions agree with each other — which is the failure M0 spent a packet avoiding. The
 * bundle is built without a database, so the whole suite runs under plain Node (T4 §12).
 */

export const CONTENT: BattleContent = battleContentFrom(
  (table) => parseBundle(EMBEDDED_BUNDLE).tables[table],
);

export function enemy(id: string) {
  const found = CONTENT.enemies.get(id);

  if (found === undefined) {
    throw new Error(`no such enemy in the bundle: ${id}`);
  }

  return found;
}

export function enemyMove(enemyId: string, moveId: string): Move {
  const found = enemy(enemyId).moves.find((move) => move.id === moveId);

  if (found === undefined) {
    throw new Error(`no such move on ${enemyId}: ${moveId}`);
  }

  return found;
}

export function skill(id: string): Move {
  const found = CONTENT.skills.find((candidate) => candidate.id === id);

  if (found === undefined) {
    throw new Error(`no such skill in the bundle: ${id}`);
  }

  return found;
}

/** Only the stats a case actually names; the rest sit at a value no assertion depends on. */
export function stats(overrides: Partial<StatDeltas> = {}): StatDeltas {
  return { vigor: 20, might: 10, resolve: 10, favor: 10, aegis: 10, stride: 10, ...overrides };
}

export function player(
  overrides: { stats?: Partial<StatDeltas>; effects?: Partial<CombatantEffects> } = {},
): Combatant {
  return {
    side: 'player',
    typeId: null,
    stats: stats(overrides.stats),
    effects: { ...NO_EFFECTS, ...overrides.effects },
  };
}

export function foe(
  typeId: string | null,
  overrides: { stats?: Partial<StatDeltas>; effects?: Partial<CombatantEffects> } = {},
): Combatant {
  return {
    side: 'enemy',
    typeId,
    stats: stats(overrides.stats),
    effects: { ...NO_EFFECTS, ...overrides.effects },
  };
}

/** A move built to a case's numbers, for the fixture rows that state Power and stats abstractly. */
export function divine(power: number, typeId: string): Move {
  return { id: `test_divine_${typeId}_${power}`, category: 'divine', typeId, power };
}

export function physical(power: number): Move {
  return { id: `test_physical_${power}`, category: 'physical', typeId: null, power };
}
