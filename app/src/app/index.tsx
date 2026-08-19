import { Redirect } from 'expo-router';

import { getDatabase } from '@/db/open';
import { hasFinishedTutorial } from '@/onboarding/tutorial';
import { useAppStore } from '@/state/appStore';
import { useBattleStore } from '@/state/battleStore';

/**
 * tech-04 §7.1 step 5 — the boot router.
 *
 * ↯ Renders nothing until boot finishes, with the native splash still up. Redirecting before the
 * mirror is read flashes onboarding at a registered player — visible on Android, where a warm DOM
 * would have forgiven it.
 *
 * Four destinations, in priority order. **A battle in progress outranks everything**: boot has
 * already decided whether the snapshot is resumable (T5 §8.1), and one that is must be re-entered
 * before any screen that could start a second fight over the top of it.
 */
export default function BootRouter() {
  const booted = useAppStore((state) => state.booted);
  const registered = useAppStore((state) => state.registered);
  const snapshot = useBattleStore((state) => state.snapshot);

  if (!booted) {
    return null;
  }

  if (!registered) {
    return <Redirect href="/01-splash" />;
  }

  if (snapshot !== null) {
    return (
      <Redirect
        href={snapshot.state.encounterKind === 'tutorial' ? '/06-tutorial' : '/battle'}
      />
    );
  }

  // Registration writes the player row, but onboarding does not end there any more — GDD 10 screens
  // 5–7 follow it, and a player who closed the app between naming and the tutorial resumes at the
  // step they stopped on rather than landing on the hub having skipped it.
  if (!hasFinishedTutorial(getDatabase())) {
    return <Redirect href="/05-loadout" />;
  }

  return <Redirect href="/character" />;
}
