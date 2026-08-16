import { type CombatantEffects, type ConsumableEffect, NO_EFFECTS } from './types';

/**
 * Applying and consuming the six flags (T5 §6).
 *
 * All four effects are single-trigger, non-stacking, and hold no duration. **Non-stacking is an
 * idempotent set, not a counter**: applying Fortify while Fortify is already held is a no-op, and
 * the item is still consumed by the caller (GDD 4 §1 — "consumed immediately on use, regardless of
 * whether the effect fires").
 */

export type EffectKey = keyof CombatantEffects;

/** Idempotent. Returns the same object when nothing changes, so a no-op re-apply is visible as one. */
export function applyEffect(
  effects: CombatantEffects,
  key: EffectKey,
  typeId: string | null = null,
): CombatantEffects {
  if (key === 'surge' || key === 'breach') {
    if (typeId === null) {
      throw new Error(`${key} is a typed charm and needs a type to arm`);
    }

    return effects[key] === typeId ? effects : { ...effects, [key]: typeId };
  }

  return effects[key] ? effects : { ...effects, [key]: true };
}

/** Clears what a resolved hit used up. The damage pipeline decides *what*; this does it. */
export function consumeEffects(
  effects: CombatantEffects,
  consumed: readonly ConsumableEffect[],
): CombatantEffects {
  if (consumed.length === 0) {
    return effects;
  }

  const next = { ...effects };

  for (const key of consumed) {
    if (key === 'surge' || key === 'breach') {
      next[key] = null;
    } else {
      next[key] = false;
    }
  }

  return next;
}

/** Consumed at the top of the round it governs, whether or not it changed the order (T5 §6). */
export function consumeSwift(effects: CombatantEffects): CombatantEffects {
  return effects.swift ? { ...effects, swift: false } : effects;
}

export function noEffects(): CombatantEffects {
  return NO_EFFECTS;
}
