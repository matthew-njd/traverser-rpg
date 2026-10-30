import fs from 'fs';
import path from 'path';

import { AUDIO } from '../../assets/registry.generated';
import { EMBEDDED_BUNDLE } from '../../content/embedded.generated';
import type { EncounterKind } from '../../battle/types';
import {
  arbitrate,
  battleMusic,
  bucketOf,
  dropRevealTier,
  entryMusic,
  hitSfx,
  musicForRoute,
  rewardRevealTier,
} from '../cues';

describe('GDD 14 §3 trigger table', () => {
  it.each([
    ['/01-splash', 'mus_title'],
    ['/restore', 'mus_title'],
    ['/02-health', null],
    ['/03-story', 'mus_oldroads'],
    ['/04-name', 'mus_oldroads'],
    ['/05-loadout', 'mus_oldroads'],
    ['/character', 'mus_hub'],
    ['/inventory', 'mus_hub'],
    ['/map', 'mus_map_valheon'],
    // Pushed above the hub, so the hub keeps playing underneath (§3.1).
    ['/settings', 'keep'],
    // Scored by the battle itself, on entry and exit (§5.2–5.3).
    ['/battle', 'keep'],
    ['/06-tutorial', 'keep'],
  ])('%s plays %s', (pathname, expected) => {
    expect(musicForRoute(pathname, 'valheon')).toBe(expected);
  });

  it('follows the Waymarker on the map, not the Viewport', () => {
    expect(musicForRoute('/map', 'olympion')).toBe('mus_map_olympion');
    expect(musicForRoute('/map', 'imperion')).toBe('mus_map_imperion');
  });

  it('gives every enemy in the content a battle track that exists', () => {
    const kindFor = (role: string): EncounterKind =>
      role === 'tutorial' ? 'tutorial' : role === 'mid_boss' ? 'mini_boss' : role === 'zone_boss' ? 'zone_boss' : 'wild';

    const tracks = EMBEDDED_BUNDLE.enemies.map((enemy) =>
      battleMusic(enemy.id, kindFor(enemy.role), enemy.zone_id),
    );

    expect(tracks).not.toContain(null);
    expect(tracks.every((key) => key !== null && key in AUDIO)).toBe(true);
    // Six bosses with their own theme, three zone themes and the tutorial's: §2.4–2.6, every one.
    expect(new Set(tracks).size).toBe(10);
  });

  it('scores the two zone entries and leaves Olympion to onboarding', () => {
    expect(entryMusic('valheon')).toBe('mus_entry_valheon');
    expect(entryMusic('imperion')).toBe('mus_entry_imperion');
    expect(entryMusic('olympion')).toBeNull();
  });

  it('puts every mus_ key in Music and everything else in Sound Effects (§2.8)', () => {
    for (const key of Object.keys(AUDIO) as (keyof typeof AUDIO)[]) {
      expect(bucketOf(key)).toBe(key.startsWith('mus_') ? 'music' : 'sfx');
    }
  });
});

/** Every non-test, non-generated source file under `src/`, keyed by name. */
function sources(): Map<string, string> {
  const found = new Map<string, string>();
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') {
          walk(full);
        }
      } else if (!entry.name.includes('.generated.')) {
        found.set(path.relative(path.join(__dirname, '..', '..'), full), fs.readFileSync(full, 'utf8'));
      }
    }
  };

  walk(path.join(__dirname, '..', '..'));

  return found;
}

/** GDD 14 §3.7 — a streak reset is silent by decision, so the key exists and nothing plays it. */
it('never plays stg_streak_break', () => {
  const callers = [...sources()].filter(([, text]) => text.includes('stg_streak_break')).map(([file]) => file);

  // cues.ts names it only to say why it is absent from the priority table.
  expect(callers.map((file) => path.basename(file))).toEqual(['cues.ts']);
});

/**
 * GDD 14 §6 — every effect has a trigger. A typed hit is reached through `hitSfx` from the content's
 * types rather than by name.
 */
it('triggers every sound effect from somewhere', () => {
  const text = [...sources().values()].join(' ');
  const typed = new Set(EMBEDDED_BUNDLE.game_types.map((type) => hitSfx(type.id)));
  const silent = (Object.keys(AUDIO) as (keyof typeof AUDIO)[]).filter(
    (key) => key.startsWith('sfx_') && !typed.has(key as never) && !text.includes(`'${key}'`),
  );

  expect(typed.size).toBe(6);
  expect(silent).toEqual([]);
});

describe('GDD 14 §5.5 priority', () => {
  it('queues a Reveal behind the victory fanfare rather than playing over it', () => {
    expect(arbitrate('stg_victory', 'stg_reveal_2')).toBe('queue');
  });

  it('lets a higher sting interrupt and drops a lower one', () => {
    expect(arbitrate('stg_victory', 'stg_boss_intro')).toBe('play');
    expect(arbitrate('stg_reveal_1', 'stg_type_super')).toBe('drop');
    expect(arbitrate('stg_type_super', 'stg_overactivity')).toBe('drop');
  });

  it('keeps the once-ever Egypt tease rather than losing it to the fanfare', () => {
    expect(arbitrate('stg_victory_boss', 'stg_egypt_tease')).toBe('queue');
  });

  it('plays anything into silence', () => {
    expect(arbitrate(null, 'stg_rest_day')).toBe('play');
  });
});

describe('GDD 14 §3.5 Reveal tiers', () => {
  it('rates a battle drop by grade, first kill and trinket', () => {
    expect(dropRevealTier(['common'], false, false)).toBe(1);
    expect(dropRevealTier(['mortal', 'heroic'], false, false)).toBe(2);
    // A Rare is tier 2 on a repeat kill and tier 3 on the first.
    expect(dropRevealTier(['rare'], false, false)).toBe(2);
    expect(dropRevealTier(['mythic'], true, false)).toBe(3);
    expect(dropRevealTier(['common'], false, true)).toBe(3);
  });

  it('rates a sync reveal by level and streak milestone', () => {
    expect(rewardRevealTier([12], [])).toBe(1);
    expect(rewardRevealTier([14, 15], [])).toBe(3);
    expect(rewardRevealTier([], [{ source: 'streak_milestone', grade: 'heroic' }])).toBe(2);
    expect(rewardRevealTier([], [{ source: 'streak_milestone', grade: 'mythic' }])).toBe(3);
    expect(rewardRevealTier([], [{ source: 'daily_goal', grade: 'mortal' }])).toBe(1);
  });
});
