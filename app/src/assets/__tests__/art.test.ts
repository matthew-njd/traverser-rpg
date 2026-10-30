import fs from 'fs';
import path from 'path';

import credits from '../../../art/credits.json';
import { PLACEHOLDER_SPRITES, SPRITES } from '../registry.generated';

/**
 * M6/P5's art pipeline. What a mutation would slip past: an SVG added without its CC BY credit, which
 * ships unattributed art; or a new source never exported, which leaves its plate on the glyph.
 */
const appRoot = path.join(__dirname, '..', '..', '..');
const sources = fs
  .readdirSync(path.join(appRoot, 'art'))
  .filter((file) => file.endsWith('.svg'))
  .map((file) => path.basename(file, '.svg'));

it('credits every art source, and credits nothing that is not one', () => {
  expect(Object.keys(credits).sort()).toEqual([...sources].sort());

  // Art drawn for Traverser owes no attribution; anything else must name its authors and source.
  for (const credit of Object.values(credits)) {
    if (credit.source !== 'original') {
      expect(credit.authors.length).toBeGreaterThan(0);
      expect(credit.source).toMatch(/^https:\/\//);
    }
  }
});

it('names every art source after a manifest sprite key', () => {
  for (const key of sources) {
    expect(key in SPRITES).toBe(true);
  }
});

it('has exported every source at all three densities, and the registry knows it', () => {
  for (const key of sources) {
    for (const suffix of ['', '@2x', '@3x']) {
      const png = path.join(appRoot, 'assets', 'sprites', `${key}${suffix}.png`);

      expect(fs.existsSync(png)).toBe(true);
    }

    expect(PLACEHOLDER_SPRITES.has(key as never)).toBe(false);
  }
});
