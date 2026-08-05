import { Redirect } from 'expo-router';

import { useAppStore } from '@/state/appStore';

/**
 * tech-04 §7.1 step 5 — the boot router.
 *
 * ↯ Renders nothing until boot has finished, and the native splash is still up while that is true
 * (`_layout.tsx` holds it). Redirecting before the mirror has been read would send a registered
 * player through onboarding for a frame, which on Android is a visible flash of the wrong screen
 * rather than the instant re-render a warm web DOM would forgive.
 *
 * "Registered" is the whole onboarding-complete signal in M1: naming is the last onboarding step and
 * it is the step that writes the player row. When M2 inserts GDD 10's screens 5–7 between naming and
 * the hub that stops being true, and this needs a flag of its own.
 */
export default function BootRouter() {
  const booted = useAppStore((state) => state.booted);
  const registered = useAppStore((state) => state.registered);

  if (!booted) {
    return null;
  }

  return <Redirect href={registered ? '/character' : '/01-splash'} />;
}
