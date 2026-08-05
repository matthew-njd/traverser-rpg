import type { MirrorPlayer } from '../sync/mirror';
import type { StatDeltas } from '../sync/writes';

/**
 * GDD 1 §5 — the Level 1 baseline.
 *
 * ↯ Vigor starts higher because it is the HP pool and needs headroom to make early battles
 * survivable before any points are invested. fixtures §5 pins the same numbers ("Start: Vigor 20,
 * others 10") and the tutorial battle is scripted against them.
 */
export const BASE_STATS: StatDeltas = {
  vigor: 20,
  might: 10,
  resolve: 10,
  favor: 10,
  aegis: 10,
  stride: 10,
};

/**
 * Base plus allocation. **Gear bonuses are not included** — gear arrives at M3, and when it does it
 * adds here rather than to the stored allocation (tech-01 §4 keeps the rolled bonus frozen on the
 * item, never folded into the player row).
 *
 * ↯ And when it does arrive: **Stride never receives gear bonuses** (GDD 1 §5). That rule lives with
 * the gear layer, but it is worth knowing before this function grows a third term.
 */
export function effectiveStats(player: MirrorPlayer): StatDeltas {
  return {
    vigor: BASE_STATS.vigor + player.allocVigor,
    might: BASE_STATS.might + player.allocMight,
    resolve: BASE_STATS.resolve + player.allocResolve,
    favor: BASE_STATS.favor + player.allocFavor,
    aegis: BASE_STATS.aegis + player.allocAegis,
    stride: BASE_STATS.stride + player.allocStride,
  };
}
