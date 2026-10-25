import type { SqliteDatabase } from '../db/types';

/** One of the one-time screens shown before a battle (GDD 10 §7.2, GDD 13 §6.4). */
export interface First {
  readonly id: string;
  readonly text: string;
}

/** GDD 10 §7.2, verbatim. */
const TYPE_SCREEN =
  "Some attacks carry the power of a god's domain. Thunderer's Wrath is Storm-typed — it hits some enemies much harder, others much weaker. Watch for the 'Super Effective' and 'Resisted…' callouts in battle.";

/** GDD 3 §4.3's "What it does" column, in the player's words (GDD 13 §6.4, amended at M5/P5b). */
const EFFECTS: Readonly<Record<string, { name: string; does: string }>> = {
  weaken: { name: 'Weaken', does: "On a hit, the enemy's next attack deals 50% of its normal damage." },
  fortify: { name: 'Fortify', does: 'On a hit, you take 50% of the normal damage from the next hit you receive.' },
  swift: { name: 'Swift', does: 'On a hit, you act first next round, whatever your Stride.' },
  rend: { name: 'Rend', does: 'On a hit, the enemy takes 150% of the normal damage from the next hit it receives.' },
};

const seen = (db: SqliteDatabase, id: string): boolean =>
  db.getFirstSync('SELECT 1 FROM seen_screen WHERE id = ?', [id]) !== null;

/**
 * What to show before this fight, in order: the type screen once the player has reached
 * Thunderer's Wrath's level, then one screen per secondary effect the fight's moves carry.
 */
export function pendingFirsts(db: SqliteDatabase, moveIds: readonly string[]): First[] {
  const firsts: First[] = [];
  const reached = db.getFirstSync<{ n: number }>(
    `SELECT count(*) AS n FROM player p, player_skill_def s
      WHERE p.one_row = 1 AND s.id = 'skill_thunderers_wrath' AND p.level >= s.unlock_level`,
  );

  if ((reached?.n ?? 0) > 0 && !seen(db, 'type_intro')) {
    firsts.push({ id: 'type_intro', text: TYPE_SCREEN });
  }

  const placeholders = moveIds.map(() => '?').join(', ');
  const moves =
    moveIds.length === 0
      ? []
      : db.getAllSync<{ display_name: string; effect: string }>(
          `SELECT display_name, effect FROM gear_move WHERE effect IS NOT NULL AND id IN (${placeholders}) ORDER BY id`,
          [...moveIds],
        );

  for (const move of moves) {
    const effect = EFFECTS[move.effect];
    const id = `effect_${move.effect}`;

    if (effect !== undefined && !seen(db, id) && !firsts.some((first) => first.id === id)) {
      firsts.push({ id, text: `${move.display_name} carries ${effect.name}.\n\n${effect.does} It fires once, then it's gone.` });
    }
  }

  return firsts;
}

export function markSeen(db: SqliteDatabase, ids: readonly string[], now: number): void {
  for (const id of ids) {
    db.runSync(
      `INSERT INTO seen_screen (player_id, id, seen_at) SELECT id, ?, ? FROM player WHERE one_row = 1
       ON CONFLICT DO NOTHING`,
      [id, new Date(now).toISOString()],
    );
  }
}
