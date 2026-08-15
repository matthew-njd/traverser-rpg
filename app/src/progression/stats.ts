import type { MirrorPlayer } from '../sync/mirror';
import type { StatDeltas } from '../sync/writes';

/** GDD 1 §5 — the Level 1 baseline. fixtures §5 pins these and the tutorial battle is scripted on them. */
export const BASE_STATS: StatDeltas = {
  vigor: 20,
  might: 10,
  resolve: 10,
  favor: 10,
  aegis: 10,
  stride: 10,
};

/**
 * Base plus allocation. Gear is M3 and adds here, never to the stored allocation (tech-01 §4).
 *
 * When it arrives: **Stride never receives gear bonuses** (GDD 1 §5) — worth knowing before this
 * function grows a third term.
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
