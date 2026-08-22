import type { Labels } from '../../content/labels';
import { labelFor } from '../../content/labels';
import type { BattleEvent } from '../../battle/state';

/**
 * The event queue turned into what the player reads (GDD 13 §6.2, T5 §9).
 *
 * Pure, and separate from the components: this is the packet's only real logic, and the property
 * that matters — that the callout and the pre-selection chevron can never disagree with the damage
 * actually dealt — is a property of `typeMultiplier` travelling on the event rather than being
 * recomputed here. Both functions below read that one field and nothing else.
 */

export const SUPER_EFFECTIVE = 'Super Effective!';
export const RESISTED = 'Resisted…';

export type ChevronTone = 'strong' | 'neutral' | 'weak';

export interface Callout {
  readonly text: string;
  /**
   * The same vocabulary the pre-selection chevron uses, and deliberately so: the player learns ▽ in
   * `madder` in the Skill menu, and the callout that answers the tap is the same colour. Two
   * surfaces describing one fact should not be two colour schemes.
   */
  readonly tone: ChevronTone;
}

/**
 * GDD 13 §6.2. Neutral is **silence**, not "Normal damage" — the spec is explicit that saying
 * nothing is itself informative, and a third line would make the two that matter harder to spot.
 */
export function calloutOf(typeMultiplier: number): Callout | null {
  if (typeMultiplier > 1) {
    return { text: SUPER_EFFECTIVE, tone: 'strong' };
  }

  return typeMultiplier < 1 ? { text: RESISTED, tone: 'weak' } : null;
}

/** The wording alone, for the combat log — which is prose and carries no tone. */
export function calloutFor(typeMultiplier: number): string | null {
  return calloutOf(typeMultiplier)?.text ?? null;
}

export interface Chevron {
  readonly glyph: string;
  readonly tone: ChevronTone;
  /** GDD 13 §6.2's direction disambiguation — never a bare type name in either surface. */
  readonly description: string;
}

/**
 * The pre-selection hint on a typed move (GDD 13 §6.2), computed against the current target.
 *
 * ↯ Framed as "[Move Type] vs. [Enemy Type]" in the label, never as one type alone. GDD 6/7 flag
 * three times that Sea/Wisdom reverses depending on who is attacking, so a hint reading "Sea" is
 * ambiguous in exactly the pair players already find counterintuitive.
 */
export function chevronFor(
  typeMultiplier: number,
  moveTypeName: string,
  enemyTypeName: string,
): Chevron {
  const description = `${moveTypeName} vs. ${enemyTypeName}`;

  if (typeMultiplier > 1) {
    return { glyph: '▲▲', tone: 'strong', description: `${description}: super effective` };
  }

  if (typeMultiplier < 1) {
    return { glyph: '▽', tone: 'weak', description: `${description}: resisted` };
  }

  return { glyph: '–', tone: 'neutral', description: `${description}: neutral` };
}

/**
 * The combat log, oldest first.
 *
 * A move and the damage it did arrive as two events and read as one line, so `move_used` is held
 * until its `damage_dealt` lands rather than printed on its own — a hit that killed the target
 * still emits both, so nothing is stranded.
 */
export function logLines(events: readonly BattleEvent[], labels: Labels): string[] {
  const lines: string[] = [];
  let pending: string | null = null;

  const flush = () => {
    if (pending !== null) {
      lines.push(pending);
      pending = null;
    }
  };

  for (const event of events) {
    switch (event.type) {
      case 'move_used':
        flush();
        pending = labelFor(labels, event.moveId);
        break;

      case 'damage_dealt': {
        const callout = calloutFor(event.typeMultiplier);
        const parts = [
          ...(pending === null ? [] : [pending]),
          ...(event.wasCrit ? ['Critical hit!'] : []),
          ...(callout === null ? [] : [callout]),
          `${event.amount} damage.`,
        ];

        pending = null;
        lines.push(parts.join(' — '));
        break;
      }

      case 'item_used':
        flush();
        lines.push(
          event.healed === null || event.healed === 0
            ? `${labelFor(labels, event.itemDefId)} used.`
            : `${labelFor(labels, event.itemDefId)} — ${event.healed} Vigor restored.`,
        );
        break;

      case 'loot_rolled':
        // Nothing renders a drop at M2: GDD 13 §6.3's Reveal Card is unbuilt, and an ordinary sync
        // never refreshes the satchel (DECISIONS 2026-08-22). Silence is the honest answer.
        flush();
        break;

      default:
        break;
    }
  }

  flush();

  return lines;
}
