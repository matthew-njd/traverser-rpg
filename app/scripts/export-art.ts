/**
 * Art sources → sprite PNGs (M6/P5a, GDD 13 §11.4).
 *
 *   npm run art:export        — every app/art/{key}.svg → assets/sprites/{key}.png, @2x, @3x
 *   npm run gen:assets        — afterwards, so the registry stops treating the key as a placeholder
 *
 * Every illustration is one ink on a cream plate, so a source's own colours are ignored: the
 * game-icons.net background square is dropped (leaving cut-outs transparent, so the plate shows
 * through them) and every fill becomes the ink. A source may therefore be a raw game-icons.net
 * download or an Inkscape composition in any colour.
 *
 * Metro picks `@2x`/`@3x` by screen density on its own; `{key}.png` stays the 1× file the registry
 * requires (tech-04 §9.2).
 */

import fs from 'node:fs';
import path from 'node:path';

import { Resvg } from '@resvg/resvg-js';

const appRoot = path.resolve(import.meta.dirname, '..');
const artDir = path.join(appRoot, 'art');
const spritesDir = path.join(appRoot, 'assets', 'sprites');

/** GDD 13 §11.1's `background` — the near-black ink §11.1 requires on a `marble` plate. */
const INK = '#100E0C';

/**
 * The 1× edge in dp, by family: an enemy fills the battle plate, an item or a piece of gear a card's
 * corner. Drawn larger than shown and scaled down, never up.
 */
const BASE_DP: readonly (readonly [string, number])[] = [
  ['enemy_', 160],
  ['item_', 64],
  ['gear_', 64],
];

/** Each side's margin, as a share of the canvas, so no shape touches its plate's edge. */
const MARGIN = 0.0625;

export function inked(svg: string): string {
  const viewBox = /viewBox="([\d.\s-]+)"/.exec(svg)?.[1]?.trim().split(/\s+/).map(Number);

  if (viewBox?.length !== 4) {
    throw new Error('an art source needs a viewBox');
  }

  const [x, y, w, h] = viewBox as [number, number, number, number];
  const pad = Math.max(w, h) * MARGIN;

  return svg
    .replace(new RegExp(`<path d="M${x} ${y}h${w}v${h}H${x}z"\\s*/>`), '')
    .replace(/fill="(?!none")[^"]*"/g, `fill="${INK}"`)
    .replace(/viewBox="[^"]*"/, `viewBox="${x - pad} ${y - pad} ${w + 2 * pad} ${h + 2 * pad}" fill="${INK}"`);
}

function baseDp(key: string): number {
  const size = BASE_DP.find(([prefix]) => key.startsWith(prefix))?.[1];

  if (size === undefined) {
    throw new Error(`no export size for ${key} — add its family to BASE_DP`);
  }

  return size;
}

if (process.argv[1] === import.meta.filename) {
  const sources = fs.readdirSync(artDir).filter((file) => file.endsWith('.svg'));

  for (const file of sources) {
    const key = path.basename(file, '.svg');
    const svg = inked(fs.readFileSync(path.join(artDir, file), 'utf8'));

    for (const [scale, suffix] of [[1, ''], [2, '@2x'], [3, '@3x']] as const) {
      const png = new Resvg(svg, { fitTo: { mode: 'width', value: baseDp(key) * scale } }).render().asPng();

      fs.writeFileSync(path.join(spritesDir, `${key}${suffix}.png`), png);
    }
  }

  console.log(`export-art: ${sources.length} sources → ${sources.length * 3} PNGs`);
}
