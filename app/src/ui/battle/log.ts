import type { Labels } from '../../content/labels';
import { labelFor } from '../../content/labels';
import type { BattleEvent } from '../../battle/state';
import type { BattleSide } from '../../battle/types';

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
/** GDD 3 §4.3's effect table, for the Trinket move that leaves one behind. */
const EFFECT_LINES: Readonly<Record<string, string>> = {
  rend: 'Rend — the next hit it takes deals 150%.',
  weaken: 'Weaken — its next attack deals half damage.',
  fortify: 'Fortify — the next hit you take deals half damage.',
  swift: 'Swift — you act first next round.',
};

/** A Vigor bar moving, as one line of the log caused it. */
export interface VigorChange {
  readonly side: BattleSide;
  readonly from: number;
  readonly to: number;
}

/**
 * One log line, whose turn produced it, in which round — what the pause between sides keys on — and
 * the Vigor it moved, so the bars move when the line appears and not before.
 */
export interface LogLine {
  readonly text: string;
  readonly actor: BattleSide;
  readonly round: number;
  readonly changes: readonly VigorChange[];
  /** Set on the player's typed hits only, which are the only ones that carry a callout (GDD 2). */
  readonly typeMultiplier?: number;
}

/**
 * What a bar shows while the log is still revealing: its value before the first change on a line
 * not yet shown, or `current` once every line is out.
 */
export function shownVigor(hidden: readonly LogLine[], side: BattleSide, current: number): number {
  for (const line of hidden) {
    const change = line.changes.find((candidate) => candidate.side === side);

    if (change !== undefined) {
      return change.from;
    }
  }

  return current;
}

export function logLines(events: readonly BattleEvent[], labels: Labels): string[] {
  return logEntries(events, labels).map((line) => line.text);
}

export function logEntries(events: readonly BattleEvent[], labels: Labels): LogLine[] {
  const lines: LogLine[] = [];
  let pending: string | null = null;
  // An item is the player's, and a Trinket's effect line belongs to the move before it.
  let actor: BattleSide = 'player';
  let round = 0;
  // ↯ A hit's `vigor_changed` follows its line, but a heal's comes before `item_used`. So a change
  // after `damage_dealt` joins the line just pushed, and any other waits for the next one.
  let changes: VigorChange[] = [];

  const push = (text: string, typeMultiplier?: number) => {
    lines.push({ text, actor, round, changes, typeMultiplier });
    changes = [];
  };

  const flush = () => {
    if (pending !== null) {
      push(pending);
      pending = null;
    }
  };

  events.forEach((event, index) => {
    switch (event.type) {
      case 'vigor_changed': {
        const change = { side: event.actor, from: event.from, to: event.to };
        const last = lines[lines.length - 1];

        if (events[index - 1]?.type === 'damage_dealt' && last !== undefined) {
          lines[lines.length - 1] = { ...last, changes: [...last.changes, change] };
        } else {
          changes.push(change);
        }
        break;
      }

      case 'turn_order_decided':
        flush();
        round += 1;
        break;

      case 'move_used':
        flush();
        actor = event.actor;
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
        actor = event.actor;
        push(parts.join(' — '), event.target === 'enemy' ? event.typeMultiplier : undefined);
        break;
      }

      case 'item_used':
        flush();
        actor = 'player';
        push(
          event.healed === null || event.healed === 0
            ? `${labelFor(labels, event.itemDefId)} used.`
            : `${labelFor(labels, event.itemDefId)} — ${event.healed} Vigour restored.`,
        );
        break;

      case 'effect_applied': {
        // ↯ An item's effect is announced by its own `item_used`, which follows it directly; only a
        // Trinket move's effect needs a line.
        const line = EFFECT_LINES[event.effect];

        if (events[index + 1]?.type !== 'item_used' && line !== undefined) {
          flush();
          push(line);
        }
        break;
      }

      case 'loot_rolled':
        // The log stays silent: GDD 13 §6.3's Reveal Card announces the drop on the outcome panel,
        // and saying it twice in two registers is worse than saying it once well.
        flush();
        break;

      default:
        break;
    }
  });

  flush();

  return lines;
}
