import type { BestiaryEntry } from '../battle/mirror';
import type { SqliteDatabase } from '../db/types';

/** GDD 12's text for one enemy, split into the lines each beat shows together. */
export interface EnemyLore {
  readonly id: string;
  readonly zoneId: string | null;
  readonly typeId: string | null;
  readonly role: string;
  readonly flavor: string | null;
  readonly intro: readonly string[];
  readonly defeatFirst: readonly string[];
  readonly defeatRepeat: readonly string[];
}

/** What one fight shows, decided before it starts: the bestiary counts move only when it settles. */
export interface BattleLore {
  /** A boss's intro every time, or a wild enemy's flavour on its first fight (GDD 12 §2, §8). */
  readonly opening: readonly string[];
  /** Shown on a win. Empty for a wild enemy, which gets no dialogue. */
  readonly defeat: readonly string[];
  /** The next zone's screens, after a final boss's first defeat only (§2's timing). */
  readonly narrative: readonly string[];
}

interface EnemyRow {
  id: string;
  zone_id: string | null;
  type_id: string | null;
  role: string;
  flavor: string | null;
  intro: string | null;
  defeat_first: string | null;
  defeat_repeat: string | null;
}

const lines = (text: string | null): string[] => (text === null ? [] : text.split('\n'));

const toLore = (row: EnemyRow): EnemyLore => ({
  id: row.id,
  zoneId: row.zone_id,
  typeId: row.type_id,
  role: row.role,
  flavor: row.flavor,
  intro: lines(row.intro),
  defeatFirst: lines(row.defeat_first),
  defeatRepeat: lines(row.defeat_repeat),
});

const ENEMY_COLUMNS = 'id, zone_id, type_id, role, flavor, intro, defeat_first, defeat_repeat';

/** GDD 13 §5.3's bestiary: every enemy but the tutorial Wisp, by zone, wild before bosses. */
export function readRoster(db: SqliteDatabase): EnemyLore[] {
  return db
    .getAllSync<EnemyRow>(
      `SELECT e.id, e.zone_id, e.type_id, e.role, e.flavor, e.intro, e.defeat_first, e.defeat_repeat
         FROM enemy e JOIN zone z ON z.id = e.zone_id
        ORDER BY z.ordinal, CASE e.role WHEN 'wild' THEN 0 WHEN 'mid_boss' THEN 1 ELSE 2 END, e.id`,
    )
    .map(toLore);
}

export function battleLore(db: SqliteDatabase, enemyId: string, met: BestiaryEntry): BattleLore {
  const row = db.getFirstSync<EnemyRow>(`SELECT ${ENEMY_COLUMNS} FROM enemy WHERE id = ?`, [enemyId]);

  if (row === null || row.role === 'tutorial') {
    return { opening: [], defeat: [], narrative: [] };
  }

  const lore = toLore(row);

  if (lore.role === 'wild') {
    return {
      opening: met.encounterCount === 0 && lore.flavor !== null ? [lore.flavor] : [],
      defeat: [],
      narrative: [],
    };
  }

  const first = met.defeatCount === 0;
  const opens = db.getFirstSync<{ entry_narrative: string | null }>(
    `SELECT z.entry_narrative FROM zone_gate g JOIN zone z ON z.id = g.unlocks_zone_id WHERE g.enemy_id = ?`,
    [enemyId],
  );

  return {
    opening: lore.intro,
    defeat: first ? lore.defeatFirst : lore.defeatRepeat,
    narrative: first && opens?.entry_narrative != null ? (JSON.parse(opens.entry_narrative) as string[]) : [],
  };
}
