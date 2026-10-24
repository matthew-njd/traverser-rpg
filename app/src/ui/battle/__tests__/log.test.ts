import type { BattleEvent } from '../../../battle/state';
import { RESISTED, SUPER_EFFECTIVE, calloutFor, calloutOf, chevronFor, logLines } from '../log';

/**
 * The event queue turned into what the player reads (GDD 13 §6.2).
 *
 * The engine's arithmetic is asserted in `src/battle/` and is deliberately not re-asserted here —
 * duplicating damage values in a rendering test is the second transcription M0 spent a packet
 * avoiding (M2 plan P6). What is unproven below the engine is the *reading*: that a hit and its
 * callout compose into one line, and that a neutral hit says nothing.
 */
const LABELS = new Map([
  ['skill_thunderers_wrath', "Thunderer's Wrath"],
  ['skill_basic_attack', 'Basic Attack'],
  ['item_travelers_salve', "Traveller's Salve"],
  ['storm', 'Storm'],
  ['sea', 'Sea'],
]);

const hit = (overrides: Partial<Extract<BattleEvent, { type: 'damage_dealt' }>> = {}): BattleEvent => ({
  type: 'damage_dealt',
  actor: 'player',
  target: 'enemy',
  amount: 26,
  typeMultiplier: 1,
  wasCrit: false,
  ...overrides,
});

const used = (moveId: string): BattleEvent => ({
  type: 'move_used',
  actor: 'player',
  moveId,
  usesLeft: null,
});

describe('calloutFor', () => {
  it('names a super-effective hit and a resisted one', () => {
    expect(calloutFor(2)).toBe(SUPER_EFFECTIVE);
    expect(calloutFor(0.5)).toBe(RESISTED);
  });

  /** GDD 13 §6.2 — silence is itself informative, so neutral gets no line of its own. */
  it('says nothing at all on a neutral hit', () => {
    expect(calloutFor(1)).toBeNull();
  });

  /**
   * Breach forces ×2.0 and Surge multiplies the damage without touching the chart, so the callout
   * reads the multiplier rather than a threshold. Anything above 1 is super effective.
   */
  it('reads the multiplier, not a fixed pair of values', () => {
    expect(calloutFor(4)).toBe(SUPER_EFFECTIVE);
    expect(calloutFor(0.25)).toBe(RESISTED);
  });
});

describe('calloutOf', () => {
  /**
   * The tone is the chevron's, not a second scale — which is what lets the callout and the
   * pre-selection hint be coloured from one table (GDD 13 §6.2, §11).
   */
  it('carries the same tone the chevron would have shown', () => {
    expect(calloutOf(2)).toEqual({ text: SUPER_EFFECTIVE, tone: 'strong' });
    expect(calloutOf(0.5)).toEqual({ text: RESISTED, tone: 'weak' });
    expect(calloutOf(1)).toBeNull();
  });

  it('agrees with chevronFor on every tone it emits', () => {
    for (const multiplier of [2, 0.5]) {
      expect(calloutOf(multiplier)?.tone).toBe(chevronFor(multiplier, 'Storm', 'Sea').tone);
    }
  });
});

describe('chevronFor', () => {
  it.each([
    [2, '▲▲', 'strong'],
    [1, '–', 'neutral'],
    [0.5, '▽', 'weak'],
  ])('shows %p as %s', (multiplier, glyph, tone) => {
    expect(chevronFor(multiplier, 'Storm', 'Sea')).toMatchObject({ glyph, tone });
  });

  /**
   * ↯ GDD 6/7 flag three times that Sea and Wisdom reverse depending on who attacks, so the hint
   * must never read as one bare type name. Both directions are spelled out.
   */
  it('always frames the match as move type versus enemy type', () => {
    expect(chevronFor(0.5, 'Wisdom', 'Sea').description).toContain('Wisdom vs. Sea');
    expect(chevronFor(2, 'Sea', 'Wisdom').description).toContain('Sea vs. Wisdom');
  });
});

describe('logLines', () => {
  it('composes the move and its damage into GDD 13 §6.1\'s one line', () => {
    const lines = logLines(
      [used('skill_thunderers_wrath'), hit({ typeMultiplier: 2 })],
      LABELS,
    );

    expect(lines).toEqual(["Thunderer's Wrath — Super Effective! — 26 damage."]);
  });

  it('leaves a neutral hit without a callout', () => {
    expect(logLines([used('skill_basic_attack'), hit({ amount: 7 })], LABELS)).toEqual([
      'Basic Attack — 7 damage.',
    ]);
  });

  it('reports a critical hit alongside the effectiveness', () => {
    expect(
      logLines([used('skill_thunderers_wrath'), hit({ wasCrit: true, typeMultiplier: 0.5 })], LABELS),
    ).toEqual(["Thunderer's Wrath — Critical hit! — Resisted… — 26 damage."]);
  });

  it('reads an item by its content name and says what it restored', () => {
    expect(
      logLines([{ type: 'item_used', itemDefId: 'item_travelers_salve', healed: 4 }], LABELS),
    ).toEqual(["Traveller's Salve — 4 Vigour restored."]);
  });

  it('does not claim a heal for an item that armed a charm instead', () => {
    expect(
      logLines([{ type: 'item_used', itemDefId: 'item_stormveil', healed: null }], LABELS),
    ).toEqual(['item_stormveil used.']);
  });

  /**
   * A move that misses its `damage_dealt` — nothing in the engine does this today — must not swallow
   * the line that follows it. The held move is flushed, not dropped.
   */
  it('does not lose a move whose damage never arrives', () => {
    const lines = logLines(
      [used('skill_thunderers_wrath'), used('skill_basic_attack'), hit({ amount: 3 })],
      LABELS,
    );

    expect(lines).toEqual(["Thunderer's Wrath", 'Basic Attack — 3 damage.']);
  });

  it('keeps both combatants\' turns, in the order they resolved', () => {
    const lines = logLines(
      [
        used('skill_basic_attack'),
        hit({ amount: 6 }),
        { type: 'move_used', actor: 'enemy', moveId: 'enemy_move_x', usesLeft: null },
        hit({ actor: 'enemy', target: 'player', amount: 4 }),
      ],
      LABELS,
    );

    expect(lines).toEqual(['Basic Attack — 6 damage.', 'enemy_move_x — 4 damage.']);
  });
});
