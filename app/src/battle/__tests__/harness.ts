import { parseBundle } from '../../content/bundle';
import { EMBEDDED_BUNDLE } from '../../content/embedded.generated';
import type { StatDeltas } from '../../sync/writes';
import { dropTablesFrom, type DropEncounterKind } from '../loot';
import type { Rng } from '../rng';
import {
  type BattleAction,
  type BattleContext,
  type BattleEvent,
  type BattleItem,
  type BattleState,
  beginBattle,
  step,
} from '../state';
import { type BattleRules, type EncounterKind, type Move, rulesFor } from '../types';
import { CONTENT, enemy, stats } from './fixtures';

/** Assembling a battle from bundle content, so no test hand-writes an enemy or a move. */

const TABLES = parseBundle(EMBEDDED_BUNDLE).tables;
const DROP_TABLES = dropTablesFrom((table) => TABLES[table]);

function itemsFromBundle(): Map<string, BattleItem> {
  const items = new Map<string, BattleItem>();

  for (const row of TABLES.item_def) {
    items.set(String(row.id), {
      id: String(row.id),
      category: String(row.category) as BattleItem['category'],
      healPct: typeof row.heal_pct === 'number' ? row.heal_pct : null,
      effect: typeof row.effect === 'string' ? row.effect : null,
      typeId: typeof row.type_id === 'string' ? row.type_id : null,
    });
  }

  return items;
}

export function contextFor(
  enemyId: string,
  options: { dropEncounterKind?: DropEncounterKind | null } = {},
): BattleContext {
  const definition = enemy(enemyId);
  const moves = new Map<string, Move>();

  for (const skill of CONTENT.skills) {
    moves.set(skill.id, skill);
  }

  for (const move of CONTENT.gearMoves.values()) {
    moves.set(move.id, move);
  }

  return {
    content: CONTENT,
    enemy: definition,
    moves,
    items: itemsFromBundle(),
    tables: DROP_TABLES,
    pool: TABLES.enemy_drop_pool
      .filter((row) => row.enemy_id === enemyId)
      .map((row) => ({
        itemDefId: String(row.item_def_id),
        weight: Number(row.weight),
        ordinal: Number(row.ordinal ?? 0),
      })),
    dropEncounterKind:
      options.dropEncounterKind === undefined ? 'wild' : options.dropEncounterKind,
  };
}

export interface Battle {
  state: BattleState;
  readonly events: BattleEvent[];
  readonly context: BattleContext;
  /** Dispatches one action, appending its events to the running log. */
  take(action: BattleAction): void;
}

export function startBattle(input: {
  enemyId: string;
  level: number;
  playerStats: Partial<StatDeltas>;
  playerVigor?: number;
  encounterKind?: EncounterKind;
  rules?: BattleRules;
  uses?: Record<string, number>;
  firstKill?: boolean;
  dropEncounterKind?: DropEncounterKind | null;
  rng: Rng;
}): Battle {
  const context = contextFor(input.enemyId, { dropEncounterKind: input.dropEncounterKind });
  const playerStats = stats(input.playerStats);
  const encounterKind = input.encounterKind ?? 'wild';

  const opening = beginBattle({
    encounterKind,
    rules: input.rules ?? rulesFor(encounterKind),
    enemy: context.enemy,
    enemyLevel: input.level,
    playerStats,
    playerVigor: input.playerVigor ?? playerStats.vigor,
    uses: input.uses ?? {},
    firstKill: input.firstKill ?? true,
  });

  const battle: Battle = {
    state: opening.state,
    events: [...opening.events],
    context,
    take(action) {
      const result = step(battle.state, action, context, input.rng);

      battle.state = result.state;
      battle.events.push(...result.events);
    },
  };

  return battle;
}

/** Every `damage_dealt` amount in order — the shape most round-by-round fixtures assert. */
export function damageLog(events: readonly BattleEvent[]): number[] {
  return events.flatMap((event) => (event.type === 'damage_dealt' ? [event.amount] : []));
}

export function movesUsed(events: readonly BattleEvent[]): string[] {
  return events.flatMap((event) => (event.type === 'move_used' ? [event.moveId] : []));
}
