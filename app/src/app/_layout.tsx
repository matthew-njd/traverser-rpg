import { Stack } from 'expo-router';

import { initSentry, wrapRoot } from '@/sentry';

// Before anything else renders, so a crash during first paint is still reported (tech-06 §9).
initSentry();

function RootLayout() {
  return <Stack />;
}

export default wrapRoot(RootLayout);
