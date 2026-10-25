import { useRouter } from 'expo-router';

import { Screen } from '@/ui/primitives';
import { TapThrough } from '@/ui/TapThrough';

/**
 * GDD 10 screen 3 — four lines, tap to advance, not skippable on first launch (§4). The Skip link
 * exists only for a detected reinstall, which M1 cannot detect. Lines are §4's, verbatim and in order.
 */
const LINES = [
  'Long before memory, roads connected every realm — Olympion, Valheon, Imperion, and worlds beyond. They call it Omnivium: the realm of all roads.',
  'The roads went quiet. Overgrown. Forgotten.',
  'But every step you take in the world beyond this one echoes here — and the old roads are stirring again.',
  'You are the Traverser. Where you walk, the roads reopen.',
] as const;

export default function Story() {
  const router = useRouter();

  return (
    <Screen>
      <TapThrough lines={LINES} onDone={() => router.push('/04-name')} />
    </Screen>
  );
}
