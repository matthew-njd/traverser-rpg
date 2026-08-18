import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { bootRuntime, syncNow } from '@/runtime';
import { initSentry, wrapRoot } from '@/sentry';
import { useAppStore } from '@/state/appStore';
import { colors } from '@/ui/theme';

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
    </SafeAreaProvider>
  );
}

export default wrapRoot(RootLayout);
