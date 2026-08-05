import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { BANNER_COPY, type BannerKind } from '../health/banner';
import { healthConnectProvider } from '../health/healthconnect';
import { colors, radius, space, type } from './theme';

/**
 * GDD 10 §3.2 / GDD 13 §3.1 — the low-key, persistent banner.
 *
 * ↯ Low-key is a requirement, not a style preference. The permission-denied state is *legal*: the
 * app stays fully usable, onboarding completes, and battles still award XP. A red alert would be
 * telling the player something is broken when nothing is.
 *
 * ↯ Tapping deep-links to settings and **never re-triggers `requestPermission`** (tech-03 §3).
 * Android suppresses repeat prompts after a denial, so a button that called it again would simply
 * appear broken — the one failure mode worse than no button.
 */
const STORE_URL = 'market://details?id=com.google.android.apps.healthdata';

export function HealthBanner({
  kind,
  onOpenAppSettings,
}: {
  kind: BannerKind;
  onOpenAppSettings?: () => void;
}) {
  const content = BANNER_COPY[kind];

  const open = () => {
    if (content.target === 'health_settings') {
      healthConnectProvider.openSettings();

      return;
    }

    if (content.target === 'store') {
      void Linking.openURL(STORE_URL).catch(() => {
        // A device with no Play Store cannot be sent to one. The banner still explains why steps
        // are not counting, which is the part that matters.
      });

      return;
    }

    onOpenAppSettings?.();
  };

  return (
    <Pressable accessibilityRole="button" onPress={open} style={styles.banner}>
      <View style={styles.text}>
        <Text style={styles.message}>{content.message}</Text>
        <Text style={styles.action}>{content.action}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.notice,
    borderColor: colors.noticeBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  text: { gap: space.xs },
  message: { ...type.body, color: colors.text, lineHeight: 21 },
  action: { ...type.small, color: colors.accent, fontWeight: '600' },
});
