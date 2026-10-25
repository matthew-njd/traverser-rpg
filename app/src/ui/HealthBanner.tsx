import { Linking } from 'react-native';

import { BANNER_COPY, type BannerKind } from '../health/banner';
import { healthConnectProvider } from '../health/healthconnect';
import { Banner } from './primitives';

/**
 * GDD 10 §3.2 / GDD 13 §3.1 — the low-key, persistent banner.
 *
 * Low-key is a requirement, not a preference: the denied state is *legal*, so a red alert would
 * report a fault where there is none.
 *
 * Tapping deep-links to settings and never re-triggers `requestPermission` (tech-03 §3) — Android
 * suppresses repeat prompts after a denial, so the button would just appear broken.
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
        // A device with no Play Store cannot be sent to one; the banner still explains why.
      });

      return;
    }

    onOpenAppSettings?.();
  };

  return <Banner message={content.message} action={content.action} onPress={open} />;
}
