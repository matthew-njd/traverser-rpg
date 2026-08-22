import type { Drops } from '../../battle/loot';
import { type Labels, type RevealDetail, labelFor } from '../../content/labels';

/**
 * What a won battle announces (GDD 13 §6.3) — pure, so the reveal can be asserted without rendering.
 *
 * ↯ **A drop the content cannot describe produces no card**, rather than a card with a key in it.
 * That is the same discipline the server's skip-unresolvable guard applies (DECISIONS 2026-08-20):
 * announcing something the player cannot be shown is worse than announcing nothing.
 */
export interface Reveal {
  readonly defId: string;
  readonly name: string;
  /** `item_def.rarity` or `gear_def.tier` — what §6.3 colours the border by. */
  readonly grade: string;
  readonly flavor: string | null;
}

export function revealsFor(
  drops: Drops | null,
  labels: Labels,
  details: ReadonlyMap<string, RevealDetail>,
): readonly Reveal[] {
  if (drops === null) {
    return [];
  }

  const defIds = [
    ...drops.items,
    ...drops.gear.map((drop) => drop.defId),
    ...(drops.trinket === null ? [] : [drops.trinket.defId]),
  ];

  const reveals: Reveal[] = [];

  for (const defId of defIds) {
    const detail = details.get(defId);

    if (detail === undefined) {
      continue;
    }

    reveals.push({
      defId,
      name: labelFor(labels, defId),
      grade: detail.grade,
      flavor: detail.flavor,
    });
  }

  return reveals;
}
