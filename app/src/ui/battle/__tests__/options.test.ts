import { CONTENT, skill } from '../../../battle/__tests__/fixtures';
import { skillOptions } from '../options';

/**
 * GDD 13 §6.2's pre-selection hint, and the three cases in which there is deliberately none.
 *
 * The chart here is the real one from the embedded bundle, so a seed that transposed the matrix
 * fails these as well as the engine's own — the point of the hint is that it agrees with the damage.
 */
const LABELS = new Map([
  ['skill_thunderers_wrath', "Thunderer's Wrath"],
  ['storm', 'Storm'],
  ['sea', 'Sea'],
  ['war', 'War'],
]);

const options = (input: { enemyTypeId: string | null; unlocked?: boolean; moves?: string[] }) =>
  skillOptions({
    moves: (input.moves ?? ['skill_thunderers_wrath']).map(skill),
    uses: { skill_thunderers_wrath: 4 },
    chart: CONTENT.chart,
    enemyTypeId: input.enemyTypeId,
    labels: LABELS,
    chevronsUnlocked: input.unlocked ?? true,
  });

describe('skillOptions', () => {
  it('hints a typed move against a typed enemy from the real chart', () => {
    // GDD 2 §2: Storm → War is 2×, Storm → Sea is 0.5×. Asserting both directions of the hint
    // catches a transposed chart, which a single advantaged pair would not.
    expect(options({ enemyTypeId: 'war' })[0]?.chevron).toMatchObject({ tone: 'strong' });
    expect(options({ enemyTypeId: 'sea' })[0]?.chevron).toMatchObject({ tone: 'weak' });
  });

  /** §6.2 — the hint requires having *fought* the enemy, which is later than Bestiary discovery. */
  it('withholds the hint entirely on a first encounter', () => {
    expect(options({ enemyTypeId: 'war', unlocked: false })[0]?.chevron).toBeNull();
  });

  /**
   * ↯ The chart applies only to the player's own Divine attacks (T5 §3.3). A Physical move takes no
   * multiplier in either direction, so showing it a neutral dash would teach that it *could* have
   * been effective — which is the rule the type-system tooltip has to undo later.
   */
  it('gives a Physical move no hint, not a neutral one', () => {
    expect(options({ enemyTypeId: 'war', moves: ['skill_basic_attack'] })[0]?.chevron).toBeNull();
  });

  /** The Wisp is typeless, so there is no pair to frame and nothing honest to show. */
  it('gives no hint against a typeless enemy', () => {
    expect(options({ enemyTypeId: null })[0]?.chevron).toBeNull();
  });

  it('carries the per-battle uses through, and null for the unlimited move', () => {
    expect(options({ enemyTypeId: 'war' })[0]?.usesLeft).toBe(4);
    expect(options({ enemyTypeId: 'war', moves: ['skill_basic_attack'] })[0]?.usesLeft).toBeNull();
  });

  it('names moves from the content bundle, never from a hardcoded string', () => {
    expect(options({ enemyTypeId: 'war' })[0]?.label).toBe("Thunderer's Wrath");
  });
});
