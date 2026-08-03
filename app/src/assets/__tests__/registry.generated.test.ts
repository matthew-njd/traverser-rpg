// ↯ Relative, not `@/assets/...`. `tsconfig.json` maps `@/assets/*` to the *binary* `assets/`
// directory (PNG/audio files), which shadows `src/assets/` — the two directories share a name and
// the more specific alias wins. Anything importing these generated modules by path must use a
// relative import, or the alias must be renamed first.
import { AUDIO, SPRITES } from '../registry.generated';

/**
 * Harness smoke test (M1 P1). The project had no JS test runner before this packet, so this file
 * exists to prove the three things every later test depends on actually work: the `jest-expo/android`
 * preset transforms TypeScript, `moduleNameMapper` resolves the `@/` alias the same way
 * `tsconfig.json` does, and the asset transformer handles `require()` of a binary.
 *
 * It is deliberately NOT the tech-04 §9.2 registry test. Those three checks (every key has a file,
 * every file has a key, filenames are exactly `{key}.png` / `{key}.ogg`) are enforced by
 * `scripts/gen-assets.ts`, which fails the build — duplicating them here would assert the same
 * thing later and more weakly.
 *
 * What it does catch is a registry entry pointing at a path that no longer exists: the import
 * throws at module load, before any expectation runs.
 */
describe('generated asset registry', () => {
  it('resolves every sprite', () => {
    const entries = Object.entries(SPRITES);

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.filter(([, asset]) => asset == null)).toEqual([]);
  });

  it('loads every audio asset', () => {
    const entries = Object.entries(AUDIO);

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.filter(([, asset]) => asset == null)).toEqual([]);
  });
});
