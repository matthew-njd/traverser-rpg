import { EMBEDDED_BUNDLE } from '../../content/embedded.generated';
import { parseBundle } from '../../content/bundle';
import { enemyStatsAt } from '../content';
import { CONTENT } from './fixtures';

/**
 * GDD 2 §7's fight-cost invariants (amended 2026-08-29, M3/P9 balance pass) — the property the
 * original rosters violated for three milestones without any test noticing. A **content** property,
 * like reachability: it fails when a rebalance or a new roster reintroduces enemy growth that
 * outpaces the player's 3 points per level, and the right fix is the content, never this model.
 *
 * The model is deliberately conservative: the reference player is ungeared, type-neutral (Physical
 * only, so no chart), never crits, and takes the enemy's expected-value damage every round the
 * enemy acts. Real fights with type answers, gear or items do better.
 */

const bundle = parseBundle(EMBEDDED_BUNDLE);

/** GDD 2 §7's reference build: per level +1.0 Vigor, +0.75 Might, +0.5 Resolve, +0.5 Aegis, +0.25 flex. */
const referencePlayer = (level: number) => ({
  vigor: 20 + 1.0 * (level - 1),
  might: 10 + 0.75 * (level - 1),
  resolve: 10 + 0.5 * (level - 1),
  aegis: 10 + 0.5 * (level - 1),
  stride: 10 + 0.25 * (level - 1),
});

/** The strongest Physical skill unlocked at `level`, from the bundle's own ladder. */
const bestPhysicalPower = (level: number) =>
  Math.max(
    ...bundle.tables['player_skill_def']
      .filter((row) => row['category'] === 'physical' && (row['unlock_level'] as number) <= level)
      .map((row) => row['power'] as number),
  );

const hit = (power: number, attack: number, defense: number) =>
  Math.max(1, Math.floor((power * attack) / (defense * 8)));

const CRIT_EV = 1 + 0.0625 * 0.5;

function fight(enemyId: string, level: number) {
  const definition = CONTENT.enemies.get(enemyId)!;
  const enemy = enemyStatsAt(definition, level);
  const player = referencePlayer(level);

  const rounds = Math.ceil(enemy.vigor / hit(bestPhysicalPower(level), player.might, enemy.resolve));

  const enemyRound =
    CRIT_EV *
    definition.moves.reduce(
      (sum, move) =>
        sum +
        (move.aiWeight / 100) *
          hit(
            move.power,
            move.category === 'physical' ? enemy.might : enemy.favor,
            move.category === 'physical' ? player.resolve : player.aegis,
          ),
      0,
    );

  // A slower enemy loses its hit on the kill round.
  const hits = enemy.stride >= player.stride ? rounds : rounds - 1;

  return { rounds, cost: (hits * enemyRound) / player.vigor };
}

/**
 * The level each zone's wilds become fightable, from fixtures §8's gate pacing — Olympion from the
 * start, Valheon behind Cerberus (~L15), Imperion behind Jörmungandr (~L28).
 */
const ZONE_FROM: Readonly<Record<string, number>> = { olympion: 1, valheon: 15, imperion: 28 };

/**
 * A boss is first fightable at its own gate, not at its zone's entry — fixtures §8's League
 * thresholds against GDD 1 §4's level pacing. Evaluating a boss below its gate level models a
 * fight the Road makes unreachable.
 */
const GATE_FROM: Readonly<Record<string, number>> = {
  enemy_cyclops: 9,
  enemy_cerberus: 15,
  enemy_fenrir: 22,
  enemy_jormungandr: 28,
  enemy_griffin: 40,
  enemy_cacus: 54,
};

const LIMITS: Readonly<
  Record<string, { rounds: [number, number]; cost: (level: number) => number }>
> = {
  wild: { rounds: [2, 5], cost: (level) => (level <= 6 ? 0.45 : 0.3) },
  mid_boss: { rounds: [3, 9], cost: () => 0.75 },
  zone_boss: { rounds: [4, 11], cost: () => 0.85 },
};

describe('GDD 2 §7 — fight-cost invariants over the shipped rosters', () => {
  const rosters = [...CONTENT.enemies.values()].filter((entry) => entry.role !== 'tutorial');

  it('holds I1 (fight length) and I2 (fight cost) for every enemy at every fightable level', () => {
    const violations: string[] = [];

    for (const entry of rosters) {
      const from = GATE_FROM[entry.id] ?? ZONE_FROM[entry.zoneId ?? ''];
      const limits = LIMITS[entry.role];

      // An enemy with no zone, or a role with no limits, is content this test does not know how to
      // judge — a new role or a second typeless enemy must fail loudly rather than be skipped.
      if (from === undefined || limits === undefined) {
        violations.push(`${entry.id}: no invariant defined for role "${entry.role}"`);

        continue;
      }

      for (let level = from; level <= 60; level++) {
        const { rounds, cost } = fight(entry.id, level);

        if (rounds < limits.rounds[0] || rounds > limits.rounds[1] || cost > limits.cost(level)) {
          violations.push(
            `${entry.id} L${level}: ${rounds} rounds, ${(cost * 100).toFixed(0)}% of the bar`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('covers all twelve canon enemies', () => {
    expect(rosters).toHaveLength(12);
  });
});
