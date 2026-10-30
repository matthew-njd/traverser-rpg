import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import type { ChevronTone } from './battle/log';
import { colors } from './theme';

/**
 * Drawn icons, not text glyphs: a bundled icon font renders the same on every phone, where `›` and
 * `▽` fall to whatever the system font has, and `›` read as a dot (M5 drill note 5).
 */
const TONE_COLOUR: Record<ChevronTone, string> = {
  strong: colors.verdigris,
  neutral: colors.textDim,
  weak: colors.madder,
};

/** GDD 13 §6.2 — a double chevron up for 2×, a dash for 1×, a chevron down for 0.5×. */
export function MatchChevron({ tone, size = 18 }: { tone: ChevronTone; size?: number }) {
  const color = TONE_COLOUR[tone];

  if (tone === 'strong') {
    return (
      <View testID="chevron-strong" style={styles.stack}>
        <Ionicons name="chevron-up" size={size} color={color} />
        <Ionicons name="chevron-up" size={size} color={color} style={{ marginTop: -size * 0.6 }} />
      </View>
    );
  }

  return <Ionicons testID={`chevron-${tone}`} name={tone === 'weak' ? 'chevron-down' : 'remove'} size={size} color={color} />;
}

/** The forward mark after **Battle** and other go-on links. */
export function Forward({ size = 14, color = colors.accent }: { size?: number; color?: string }) {
  return <Ionicons name="chevron-forward" size={size} color={color} />;
}

const styles = StyleSheet.create({
  stack: { alignItems: 'center' },
});
