import { Stack } from 'expo-router';

import { colors } from '@/ui/theme';

/**
 * GDD 10's first-launch sequence, M1's subset: 01 splash → 02 health → 03 story → 04 name → tabs.
 *
 * `gestureEnabled: false` — stated rather than assumed, per tech-04 §4.2. A step that can be
 * swiped away mid-registration is a step that can be half-completed.
 *
 * Hardware back keeps its default within the stack (it pops, the correct Android affordance) and
 * exits at 01. The step that must not be interrupted is registration, intercepted in `04-name`.
 */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
