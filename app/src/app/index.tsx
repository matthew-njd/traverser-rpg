import { Redirect } from 'expo-router';

import { useAppStore } from '@/state/appStore';

/**
 * tech-04 §7.1 step 5 — the boot router.
 *
 * ↯ Renders nothing until boot finishes, with the native splash still up. Redirecting before the
 * mirror is read flashes onboarding at a registered player — visible on Android, where a warm DOM
 * would have forgiven it.
 *
 * "Registered" is M1's whole onboarding-complete signal, because naming writes the player row. M2
 * inserts GDD 10 screens 5–7 after naming, and this will need a flag of its own.
 */
export default function BootRouter() {
  const booted = useAppStore((state) => state.booted);
  const registered = useAppStore((state) => state.registered);

  if (!booted) {
    return null;
  }

  return <Redirect href={registered ? '/character' : '/01-splash'} />;
}
