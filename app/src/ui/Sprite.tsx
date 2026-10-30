import { Image, Text } from 'react-native';

import type { SpriteKey } from '../assets/keys.generated';
import { PLACEHOLDER_SPRITES, SPRITES } from '../assets/registry.generated';
import { colors } from './theme';

const isSpriteKey = (id: string): id is SpriteKey => id in SPRITES;

/**
 * GDD 13 §11.4's inked silhouette, for a plate to sit it on. A subject whose art has not been
 * delivered yet, or that has no art key at all, keeps its glyph, so each plate changes the moment its
 * key's art lands and never shows a placeholder PNG.
 */
export function Sprite({ subject, size, glyph }: { subject: string; size: number; glyph: string }) {
  if (!isSpriteKey(subject) || PLACEHOLDER_SPRITES.has(subject)) {
    return <Text style={{ fontSize: size / 2, color: colors.background }}>{glyph}</Text>;
  }

  return <Image source={SPRITES[subject]} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />;
}
