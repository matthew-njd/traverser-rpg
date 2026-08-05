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

  // ↯ tech-04 §7.1: boot touches the network **zero times** and the health provider zero times. It
  // opens SQLite, migrates, reads the boot slice and hydrates. A sync that takes eight seconds
  // against a PC that is off must never be something the player waits through, so the first sync
  // starts *after* the first frame — the effect below, gated on `booted`.
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
   * ↯ `AppState` replaces `visibilitychange`, and a transition to `'active'` is the **only** sync
   * trigger (tech-04 §7.2, tech-03 §1.5). Nothing polls and nothing is scheduled.
   *
   * Two divergences that matter: `'background'` is not `beforeunload` — the process may be killed
   * later with no further callback, so nothing may be deferred to it — and the first foreground
   * after a permission change in Health Connect settings is a *cold start*, because changing
   * permissions restarts the app process. That is why the pass re-runs `getSdkStatus` →
   * `initialize` → `getGrantedPermissions` every time rather than caching them.
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
