import { NEVER_MET } from '../../battle/mirror';
import { registeredDatabase } from '../../sync/__tests__/fixtures';
import { battleLore, readRoster } from '../lore';
import { seedEmbeddedContent } from '../store';

/** GDD 12 §2's triggers, read from the embedded bundle the APK ships with. */
const database = () => {
  const db = registeredDatabase();

  seedEmbeddedContent(db);

  return db;
};

const met = (encounterCount: number, defeatCount: number) => ({ encounterCount, defeatCount });

describe('battleLore', () => {
  it('opens a first wild fight with its flavour line, and later ones with nothing', () => {
    const db = database();

    expect(battleLore(db, 'enemy_satyr', NEVER_MET).opening).toEqual([
      "It grins before it's decided whether to fight you or trade with you. Usually both.",
    ]);
    expect(battleLore(db, 'enemy_satyr', met(1, 0)).opening).toEqual([]);
    expect(battleLore(db, 'enemy_satyr', NEVER_MET).defeat).toEqual([]);
  });

  it('opens every boss fight with its intro, not only the first', () => {
    const db = database();

    expect(battleLore(db, 'enemy_cyclops', met(3, 2)).opening).toHaveLength(2);
  });

  it('picks first-kill text until the boss has been beaten, then the one-line repeat', () => {
    const db = database();

    expect(battleLore(db, 'enemy_fenrir', met(2, 0)).defeat).toHaveLength(2);
    expect(battleLore(db, 'enemy_fenrir', met(3, 1)).defeat).toEqual([
      'It knows your stride before you take it. The fight is shorter this time.',
    ]);
  });

  /** §2: the narrative follows a final boss's first defeat only, and a mid-boss opens no zone. */
  it("gives the next zone's narrative after a final boss's first defeat, and only then", () => {
    const db = database();

    expect(battleLore(db, 'enemy_cerberus', NEVER_MET).narrative[1]).toMatch(/^Valheon:/);
    expect(battleLore(db, 'enemy_jormungandr', NEVER_MET).narrative[1]).toMatch(/^Imperion:/);
    expect(battleLore(db, 'enemy_cerberus', met(1, 1)).narrative).toEqual([]);
    expect(battleLore(db, 'enemy_cyclops', NEVER_MET).narrative).toEqual([]);
    // Egypt is unreleased, so Cacus's first kill ends on its stinger (§9).
    expect(battleLore(db, 'enemy_cacus', NEVER_MET).narrative).toEqual([]);
  });

  it('shows nothing in the tutorial', () => {
    expect(battleLore(database(), 'enemy_waystone_wisp', NEVER_MET)).toEqual({ opening: [], defeat: [], narrative: [] });
  });
});

describe('readRoster', () => {
  it('lists the twelve, by zone, wild before bosses, without the Wisp', () => {
    expect(readRoster(database()).map((enemy) => enemy.id)).toEqual([
      'enemy_harpy',
      'enemy_satyr',
      'enemy_cyclops',
      'enemy_cerberus',
      'enemy_draugr',
      'enemy_valkyrie',
      'enemy_fenrir',
      'enemy_jormungandr',
      'enemy_lemures',
      'enemy_strix',
      'enemy_griffin',
      'enemy_cacus',
    ]);
  });

  it('carries text for every enemy in it', () => {
    for (const enemy of readRoster(database())) {
      expect(enemy.role === 'wild' ? enemy.flavor : enemy.intro.join('')).toBeTruthy();
    }
  });
});
