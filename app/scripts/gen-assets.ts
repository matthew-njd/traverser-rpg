/**
 * Manifest → asset registry codegen (tech-04 §9.2).
 *
 * Parses docs/traverser-data-manifest.md and emits:
 *   src/assets/keys.generated.ts      — string-literal union types per key family
 *   src/assets/registry.generated.ts  — SPRITES/AUDIO require() maps Metro resolves at build time
 *
 * Then runs the three checks, all fatal (tech-04 §9.2): every asset key has a file, every file
 * has a key, filenames are exactly `{key}.{ext}`. Sprite keys are enemies + items + gear; skills
 * and moves get key types but no files (they have no art — manifest Rules 3 covers art/audio
 * exports only, and §Zone Gates / §Analytics are explicitly not asset keys).
 *
 *   npm run gen:assets                 — verify + regenerate (no-op diff unless the manifest moved)
 *   npm run gen:assets -- --placeholders  — first create placeholder files for missing keys
 *                                          (flat-colour PNG with the key as text; silent WAV)
 *
 * Audio placeholders are .wav, not §9.3's .ogg: the $0 toolchain has no OGG encoder, and Metro's
 * default assetExts does not even include `ogg` — real OGGs need a metro.config.js entry, which
 * this project defers until M5 introduces one anyway (DECISIONS 2026-08-01). The registry prefers
 * `{key}.ogg` when it exists, so the audio project's deliveries are drop-in: replace the .wav,
 * delete it, rerun codegen.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const appRoot = path.resolve(import.meta.dirname, '..');
const manifestPath = path.resolve(appRoot, '../docs/traverser-data-manifest.md');
const spritesDir = path.join(appRoot, 'assets', 'sprites');
const audioDir = path.join(appRoot, 'assets', 'audio');
const generatedDir = path.join(appRoot, 'src', 'assets');

const makePlaceholders = process.argv.includes('--placeholders');

// ---------------------------------------------------------------------------
// Manifest parsing
// ---------------------------------------------------------------------------

/** Collect `key` tokens with the given prefix inside one `## `-delimited section. */
function sectionKeys(manifest: string, heading: string, prefix: string): string[] {
  // Anchor to a heading line and reject prefix collisions ("## Gear" must not match
  // "## Gear-Granted Moves").
  const headingRe = new RegExp(`^## ${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'm');
  const start = manifest.search(headingRe);
  if (start < 0) throw new Error(`manifest section not found: "## ${heading}"`);
  const rest = manifest.slice(start + 3);
  const end = rest.indexOf('\n## ');
  const body = end < 0 ? rest : rest.slice(0, end);

  const keys: string[] = [];
  for (const match of body.matchAll(/`([a-z0-9_]+)`/g)) {
    const key = match[1];
    if (key !== undefined && key.startsWith(prefix) && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

/** The counts as of 2026-08-01 — a parser or manifest regression fails loudly rather than
 *  silently emitting a smaller registry (same floor-assertion move as ContentValidationTests). */
function atLeast(keys: string[], floor: number, what: string): string[] {
  if (keys.length < floor) {
    throw new Error(`parsed only ${keys.length} ${what} keys (expected >= ${floor}) — manifest format drift?`);
  }
  return keys;
}

const manifest = fs.readFileSync(manifestPath, 'utf8');

const enemyKeys = atLeast(sectionKeys(manifest, 'Enemies', 'enemy_'), 13, 'enemy');
const skillKeys = atLeast(sectionKeys(manifest, 'Player Skills', 'skill_'), 10, 'skill');
const gearMoveKeys = atLeast(sectionKeys(manifest, 'Gear-Granted Moves', 'move_'), 6, 'gear move');
const enemyMoveKeys = atLeast(sectionKeys(manifest, 'Enemy Moves', 'emove_'), 28, 'enemy move');
const itemKeys = atLeast(sectionKeys(manifest, 'Battle Items', 'item_'), 18, 'item');
const gearKeys = atLeast(sectionKeys(manifest, 'Gear', 'gear_'), 21, 'gear');
const musicKeys = atLeast(sectionKeys(manifest, 'Audio IDs', 'mus_'), 19, 'music');
const stingKeys = atLeast(sectionKeys(manifest, 'Audio IDs', 'stg_'), 14, 'stinger');
const sfxKeys = atLeast(sectionKeys(manifest, 'Audio IDs', 'sfx_'), 30, 'sfx');

const spriteKeys = [...enemyKeys, ...itemKeys, ...gearKeys];
const audioKeys = [...musicKeys, ...stingKeys, ...sfxKeys];

// ---------------------------------------------------------------------------
// Placeholder PNG — flat colour derived from the key, key text in a 5×7 bitmap font (§9.3),
// so a development screenshot names its own missing assets.
// ---------------------------------------------------------------------------

// 5×7 glyphs, one 5-bit value per row. Keys are lowercase; placeholders render uppercase.
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1c, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1c],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x11, 0x19, 0x15, 0x13, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  _: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f],
};

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Flat-colour hue from the key so adjacent placeholders are visually distinct. */
function keyColor(key: string): [number, number, number] {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  // HSL(hue, 45%, 35%) → RGB.
  const c = (1 - Math.abs(2 * 0.35 - 1)) * 0.45;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = 0.35 - c / 2;
  const sextant = Math.floor(hue / 60) % 6;
  const rgb1: [number, number, number][] = [
    [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
  ];
  const [r, g, b] = rgb1[sextant] as [number, number, number];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function placeholderPng(key: string): Buffer {
  const size = 128;
  const scale = 2;
  const charsPerLine = 10; // 6px advance × scale 2 = 12px; 10 chars = 120px in a 128px frame
  const [r, g, b] = keyColor(key);

  const pixels = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) pixels.writeUInt8(r, i * 3), pixels.writeUInt8(g, i * 3 + 1), pixels.writeUInt8(b, i * 3 + 2);

  const text = key.toUpperCase();
  const lines: string[] = [];
  for (let i = 0; i < text.length; i += charsPerLine) lines.push(text.slice(i, i + charsPerLine));

  const lineHeight = 9 * scale;
  const blockTop = Math.max(0, Math.floor((size - lines.length * lineHeight) / 2));
  lines.forEach((line, lineIdx) => {
    const lineLeft = Math.max(0, Math.floor((size - line.length * 6 * scale) / 2));
    for (let ci = 0; ci < line.length; ci++) {
      const glyph = FONT[line[ci] as string];
      if (!glyph) continue;
      for (let gy = 0; gy < 7; gy++) {
        const row = glyph[gy] as number;
        for (let gx = 0; gx < 5; gx++) {
          if (!(row & (1 << (4 - gx)))) continue;
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const px = lineLeft + (ci * 6 + gx) * scale + sx;
              const py = blockTop + lineIdx * lineHeight + gy * scale + sy;
              if (px >= size || py >= size) continue;
              const off = (py * size + px) * 3;
              pixels.writeUInt8(255, off), pixels.writeUInt8(255, off + 1), pixels.writeUInt8(255, off + 2);
            }
          }
        }
      }
    }
  });

  // Scanlines with filter byte 0, deflated — the whole of a minimal truecolour PNG.
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    pixels.copy(raw, y * (1 + size * 3) + 1, y * size * 3, (y + 1) * size * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(2, 9); // colour type: truecolour

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** 300 ms of 16-bit mono silence at 8 kHz — valid by construction, ~5 KB. */
function placeholderWav(): Buffer {
  const sampleRate = 8000;
  const samples = Math.floor(sampleRate * 0.3);
  const data = Buffer.alloc(samples * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// ---------------------------------------------------------------------------
// Placeholders (opt-in), then the three checks — all fatal (§9.2)
// ---------------------------------------------------------------------------

fs.mkdirSync(spritesDir, { recursive: true });
fs.mkdirSync(audioDir, { recursive: true });

if (makePlaceholders) {
  let created = 0;
  for (const key of spriteKeys) {
    const file = path.join(spritesDir, `${key}.png`);
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, placeholderPng(key));
      created++;
    }
  }
  for (const key of audioKeys) {
    if (!fs.existsSync(path.join(audioDir, `${key}.ogg`)) && !fs.existsSync(path.join(audioDir, `${key}.wav`))) {
      fs.writeFileSync(path.join(audioDir, `${key}.wav`), placeholderWav());
      created++;
    }
  }
  console.log(`placeholders: created ${created} file(s)`);
}

const errors: string[] = [];

const spriteFiles = fs.readdirSync(spritesDir);
const audioFiles = fs.readdirSync(audioDir);

for (const key of spriteKeys) {
  if (!spriteFiles.includes(`${key}.png`)) errors.push(`missing sprite: assets/sprites/${key}.png`);
}
const audioExt = new Map<string, string>();
for (const key of audioKeys) {
  const hasOgg = audioFiles.includes(`${key}.ogg`);
  const hasWav = audioFiles.includes(`${key}.wav`);
  if (hasOgg && hasWav) errors.push(`both .ogg and .wav exist for ${key} — delete the placeholder .wav`);
  else if (hasOgg) audioExt.set(key, 'ogg');
  else if (hasWav) audioExt.set(key, 'wav');
  else errors.push(`missing audio: assets/audio/${key}.ogg (or placeholder .wav)`);
}

// An orphan file is a manifest omission — CLAUDE.md's rule is add to the manifest *first*.
const spriteKeySet = new Set(spriteKeys);
const audioKeySet = new Set(audioKeys);
for (const file of spriteFiles) {
  const wellFormed = /^([a-z0-9_]+)\.png$/.exec(file);
  if (!wellFormed || !spriteKeySet.has(wellFormed[1] as string)) errors.push(`orphan file (no manifest key): assets/sprites/${file}`);
}
for (const file of audioFiles) {
  const wellFormed = /^([a-z0-9_]+)\.(ogg|wav)$/.exec(file);
  if (!wellFormed || !audioKeySet.has(wellFormed[1] as string)) errors.push(`orphan file (no manifest key): assets/audio/${file}`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`gen-assets: ${error}`);
  console.error(`gen-assets: ${errors.length} error(s). Placeholders for new keys: npm run gen:assets -- --placeholders`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Emit — both files are committed so a clean checkout builds without codegen (§9.2)
// ---------------------------------------------------------------------------

const banner = `// GENERATED by scripts/gen-assets.ts from docs/traverser-data-manifest.md — do not edit.
// Regenerate with \`npm run gen:assets\` (expected to be a no-op diff unless the manifest changed).
`;

function union(name: string, keys: string[]): string {
  return `export type ${name} =\n${keys.map((k) => `  | '${k}'`).join('\n')};\n`;
}

const keysTs = `${banner}
${union('EnemyKey', enemyKeys)}
${union('SkillKey', skillKeys)}
${union('GearMoveKey', gearMoveKeys)}
${union('EnemyMoveKey', enemyMoveKeys)}
${union('ItemKey', itemKeys)}
${union('GearKey', gearKeys)}
${union('MusicKey', musicKeys)}
${union('StingKey', stingKeys)}
${union('SfxKey', sfxKeys)}
/** Keys with art — skills and moves are key types only, with no sprite. */
export type SpriteKey = EnemyKey | ItemKey | GearKey;

export type AudioKey = MusicKey | StingKey | SfxKey;

export type AssetKey = SpriteKey | AudioKey;
`;

const registryTs = `${banner}import type { AudioKey, SpriteKey } from './keys.generated';

export const SPRITES: Record<SpriteKey, number> = {
${spriteKeys.map((k) => `  ${k}: require('../../assets/sprites/${k}.png'),`).join('\n')}
};

export const AUDIO: Record<AudioKey, number> = {
${audioKeys.map((k) => `  ${k}: require('../../assets/audio/${k}.${audioExt.get(k)}'),`).join('\n')}
};
`;

fs.mkdirSync(generatedDir, { recursive: true });
fs.writeFileSync(path.join(generatedDir, 'keys.generated.ts'), keysTs);
fs.writeFileSync(path.join(generatedDir, 'registry.generated.ts'), registryTs);

console.log(
  `gen-assets: ${spriteKeys.length} sprites, ${audioKeys.length} audio ` +
    `(${enemyKeys.length} enemies, ${itemKeys.length} items, ${gearKeys.length} gear; ` +
    `${musicKeys.length} music, ${stingKeys.length} stingers, ${sfxKeys.length} sfx) — registry written`,
);
