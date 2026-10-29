import type { AudioKey, MusicKey, StingKey } from '../assets/keys.generated';
import { AUDIO } from '../assets/registry.generated';
import type { EncounterKind } from '../battle/types';

/**
 * GDD 14's rules as data — which track a screen plays, which sting wins, which Reveal tier a card
 * gets. Pure, so the trigger table is asserted without a player. `bus.ts` does the playing.
 */

/** GDD 14 §2.8: `mus_` is Music, and every `stg_` and `sfx_` is Sound Effects. */
export const bucketOf = (key: AudioKey): 'music' | 'sfx' => (key.startsWith('mus_') ? 'music' : 'sfx');

/** GDD 14 §5, in milliseconds. */
export const FADE_MS = {
  crossfade: 800,
  battleDuck: 300,
  wildEntry: 500,
  defeat: 1500,
  flee: 500,
  /** §5.4 — a layered sting holds the duck this long after it ends. */
  stingTail: 200,
} as const;

export const DUCK = { battle: 0.2, sting: 0.6 } as const;

const isMusic = (key: string): key is MusicKey => key.startsWith('mus_') && key in AUDIO;

/** What a route asks of the music: a track, silence, or whatever is already playing. */
export type RouteMusic = MusicKey | null | 'keep';

/**
 * GDD 14 §3.1–3.2, by pathname. `keep` is every route whose music something else owns: Settings
 * sits above the hub (§3.1), and a battle drives its own entry and exit (§5.2–5.3).
 *
 * `mus_map_mvp` is never chosen. It scored the placeholder Map (§2.2), which the full Road replaced.
 */
export function musicForRoute(pathname: string, waymarkerZone: string | null): RouteMusic {
  switch (pathname) {
    case '/01-splash':
    case '/restore':
      return 'mus_title';
    case '/02-health':
      return null;
    case '/03-story':
    case '/04-name':
    case '/05-loadout':
      return 'mus_oldroads';
    case '/character':
    case '/inventory':
      return 'mus_hub';
    case '/map':
      return waymarkerZone === null ? 'keep' : mapMusic(waymarkerZone);
    default:
      return 'keep';
  }
}

/** Selected by the Waymarker's zone, never by where the Viewport is scrolled (§3.2). */
export function mapMusic(zoneId: string): MusicKey | 'keep' {
  const key = `mus_map_${zoneId}`;

  return isMusic(key) ? key : 'keep';
}

/** §2.4–2.6. A mid-boss and a final boss each have their own track; wild fights share the zone's. */
export function battleMusic(enemyId: string, kind: EncounterKind, zoneId: string | null): MusicKey | null {
  const key =
    kind === 'tutorial'
      ? 'mus_battle_tutorial'
      : isBoss(kind)
        ? `mus_boss_${enemyId.replace(/^enemy_/, '')}`
        : `mus_battle_${zoneId ?? ''}`;

  return isMusic(key) ? key : null;
}

/** §5.2 — only mid-bosses and final bosses open on `stg_boss_intro`. */
export const isBoss = (kind: EncounterKind): boolean => kind === 'mini_boss' || kind === 'zone_boss';

/** §2.3. Olympion has none: onboarding's `mus_oldroads` stands in for it. */
export function entryMusic(zoneId: string): MusicKey | null {
  const key = `mus_entry_${zoneId}`;

  return isMusic(key) ? key : null;
}

/**
 * §5.5, highest first. `stg_streak_break` is absent because it never plays (§3.7) — nothing may
 * call the bus with it.
 */
const PRIORITY: readonly (readonly StingKey[])[] = [
  ['stg_boss_intro'],
  ['stg_victory', 'stg_victory_boss'],
  ['stg_defeat'],
  ['stg_reveal_1', 'stg_reveal_2', 'stg_reveal_3'],
  ['stg_type_super', 'stg_type_resisted'],
  ['stg_overactivity'],
  ['stg_rest_day', 'stg_waymarker', 'stg_egypt_tease'],
];

export const stingRank = (key: StingKey): number => PRIORITY.findIndex((tier) => tier.includes(key));

/**
 * `stg_egypt_tease` queues as well as the Reveal stings §5.5 names. It plays once ever, under the
 * defeat text that opens while the victory fanfare is still sounding, so dropping it would lose it.
 */
const QUEUES: ReadonlySet<StingKey> = new Set(['stg_reveal_1', 'stg_reveal_2', 'stg_reveal_3', 'stg_egypt_tease']);

/** What a sting does when another is already sounding. */
export function arbitrate(playing: StingKey | null, incoming: StingKey): 'play' | 'queue' | 'drop' {
  if (playing === null || stingRank(incoming) < stingRank(playing)) {
    return 'play';
  }

  return QUEUES.has(incoming) ? 'queue' : 'drop';
}

/** §5.4 — these duck the music to 60% rather than replacing it. */
export const LAYERED: ReadonlySet<StingKey> = new Set([
  'stg_type_super',
  'stg_type_resisted',
  'stg_reveal_1',
  'stg_reveal_2',
  'stg_reveal_3',
  'stg_rest_day',
  'stg_overactivity',
  'stg_waymarker',
  'stg_egypt_tease',
]);

export type RevealTier = 1 | 2 | 3;

/** One ladder for items and gear, as the Reveal Card's border already reads it (GDD 13 §6.3). */
const GRADE_RANK: Readonly<Record<string, number>> = {
  common: 1,
  mortal: 1,
  uncommon: 2,
  heroic: 2,
  rare: 3,
  mythic: 3,
  divine: 4,
};

const rankOf = (grade: string): number => GRADE_RANK[grade] ?? 1;

export const revealSting = (tier: RevealTier): StingKey => `stg_reveal_${tier}`;

/** §3.5 for a won battle's cards, which share one Continue and so one sting — the highest. */
export function dropRevealTier(grades: readonly string[], firstKill: boolean, trinket: boolean): RevealTier {
  const top = Math.max(0, ...grades.map(rankOf));

  if (trinket || (firstKill && top >= 3)) {
    return 3;
  }

  return top >= 2 ? 2 : 1;
}

/** GDD 14 §3.5's zone-cap levels. */
const ZONE_CAP_LEVELS: ReadonlySet<number> = new Set([15, 25, 35, 45, 55]);

/**
 * §3.5 for a sync's reveal. A streak reward's tier is read off its grade: GDD 11's Day 60+ rewards
 * are the Mythic ones, and the reward does not carry its day.
 */
export function rewardRevealTier(
  levels: readonly number[],
  rewards: readonly { source: string; grade: string }[],
): RevealTier {
  const tiers: RevealTier[] = levels.map((level) => (ZONE_CAP_LEVELS.has(level) ? 3 : 1));

  for (const reward of rewards) {
    const rank = rankOf(reward.grade);

    if (reward.source === 'streak_milestone' || reward.source === 'streak_overflow') {
      tiers.push(rank >= 3 ? 3 : 2);
    } else {
      tiers.push(rank >= 2 ? 2 : 1);
    }
  }

  return Math.max(1, ...tiers) as RevealTier;
}
