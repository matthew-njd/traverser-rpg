import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, type AppStateStatus, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { bootRuntime, cancelRetry, syncNow } from '@/runtime';
import { initSentry, wrapRoot } from '@/sentry';
import { useAppStore } from '@/state/appStore';
import { useBattleStore } from '@/state/battleStore';
import { Banner } from '@/ui/primitives';
import { colors, space } from '@/ui/theme';

// Before anything else renders, so a crash during first paint is still reported (tech-06 §9).
initSentry();

// tech-04 §7.1 step 1: the native splash holds until the app is genuinely interactive.
void SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const booted = useAppStore((state) => state.booted);

  // tech-04 §7.1: boot touches the network zero times. The first sync starts after the first frame,
  // via the effect below, gated on `booted`.
  useEffect(() => {
    void (async () => {
      try {
        await bootRuntime();
      } finally {
        await SplashScreen.hideAsync();
      }
    })();
  }, []);

  /**
   * ↯ `AppState` replaces `visibilitychange`, and `'active'` is the only sync trigger (tech-04
   * §7.2, tech-03 §1.5). Two divergences: `'background'` is **not** `beforeunload` — the process
   * may die later with no further callback, so nothing may be deferred to it — and a permission
   * change in Health Connect restarts the process, so the next foreground is a cold start.
   */
  useEffect(() => {
    if (!booted) {
      return;
    }

    const runSync = () => {
      // A failed pass is not a crash: the outbox is durable and the next foreground retries.
      void syncNow().catch(() => undefined);
    };

    runSync();

    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        runSync();
      } else {
        cancelRetry();
      }
    });

    return () => subscription.remove();
  }, [booted]);

  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        {/* Outside `(tabs)` deliberately — a battle owns the screen (T5 §9, GDD 13 §6.1). */}
        <Stack.Screen name="battle" options={{ gestureEnabled: false }} />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: true,
            title: 'Settings',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }}
        />
      </Stack>
      <Notices />
    </SafeAreaProvider>
  );
}

/**
 * The banners a sync raises, over whichever screen is frontmost when it lands (GDD 13 §6.5,
 * tech-04 §4.4): the overactivity warning, and the notice that a read skipped days (T3 §4.1).
 */
function Notices() {
  const overactive = useAppStore((state) => state.overactive);
  const missed = useAppStore((state) => state.missedBefore);
  const fighting = useBattleStore((state) => state.snapshot !== null);
  const insets = useSafeAreaInsets();

  if ((!overactive && missed === null) || fighting) {
    return null;
  }

  return (
    <View
      style={{ position: 'absolute', top: insets.top + space.sm, left: space.md, right: space.md, gap: space.sm }}
    >
      {overactive ? (
        <Banner
          message="You've been at it a while — the road will still be here after you rest."
          action="Dismiss"
          onPress={() => useAppStore.getState().dismissOveractivity()}
        />
      ) : null}

      {missed === null ? null : (
        <Banner
          message={`Welcome back. Traverser reads the last 3 days of activity when it opens, so steps before ${monthDay(missed)} weren't counted. Opening it every few days keeps every step.`}
          action="Dismiss"
          onPress={() => useAppStore.getState().dismissMissed()}
        />
      )}
    </View>
  );
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** `2026-10-21` → `October 21`, without depending on the device's Intl data. */
const monthDay = (date: string) => `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;

export default wrapRoot(RootLayout);
