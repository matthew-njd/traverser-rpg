import type { LogLine } from '../log';
import { motionFor } from '../motion';

const line = (actor: 'player' | 'enemy', cue?: LogLine['cue']): LogLine => ({
  text: 'Gust Strike — 12 damage.',
  actor,
  round: 1,
  changes: [],
  cue,
});

const hit = (crit: boolean) => ({ kind: 'hit' as const, moveId: 'skill_basic_attack', crit, typeMultiplier: null });

/** T5 §13 — each line moves the sprite it is about, and only a hit moves anything. */
describe('battle motion', () => {
  it('flinches the enemy on a hit, and staggers it on a crit', () => {
    expect(motionFor(line('player', hit(false)))).toBe('flinch');
    expect(motionFor(line('player', hit(true)))).toBe('stagger');
  });

  it('lunges the enemy when it is the one hitting', () => {
    expect(motionFor(line('enemy', hit(false)))).toBe('lunge');
  });

  it('keeps still for an item, an effect line, or no line at all', () => {
    expect(motionFor(line('player', { kind: 'item', itemDefId: 'item_travelers_salve' }))).toBeNull();
    expect(motionFor(line('player'))).toBeNull();
    expect(motionFor(undefined)).toBeNull();
  });
});
