import { Stack } from 'expo-router';

import { colors } from '@/ui/theme';

/**
 * GDD 10's first-launch sequence, M1's subset: 01 splash → 02 health → 03 story → 04 name → tabs.
 *
 * ↯ `gestureEnabled: false`. On Android the swipe-back gesture is off by default, but this stack is
 * also reachable on a device where the system gesture is enabled, and an onboarding step that can be
 * swiped away mid-registration is a step that can be half-completed. Stated rather than assumed —
 * tech-04 §4.2's rule is that silence about back behaviour ships a bug.
 *
 * Hardware back is left at its default *within* the stack (it pops, which is the correct and
 * expected Android affordance for a linear flow) and cannot escape backwards past 01, where it
 * exits the app as any Android root screen does. The step that must not be interrupted is
 * registration itself, and `04-name` intercepts it there specifically.
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
