import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Button, Screen } from '@/ui/primitives';
import { colors, space, type } from '@/ui/theme';

/** GDD 10 screen 1. The native splash has already gone by the time this renders (tech-04 §7.1). */
export default function Splash() {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.centre}>
        <Text style={styles.wordmark}>TRAVERSER</Text>
        <Body dim>The old roads are stirring.</Body>
      </View>

      <View style={styles.actions}>
        <Button label="Begin" onPress={() => router.push('/02-health')} />
        {/*
          tech-06 §13.1's restore branch. It sits here, on the first screen, because it is only
          reachable before an identity exists — once the device has registered, this whole stack is
          unreachable. A player restoring a backup after a lost phone has exactly one moment to say
          so, and this is it.
        */}
        <Button
          label="Restore from a backup"
          variant="secondary"
          onPress={() => router.push('/restore')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  wordmark: { ...type.display, color: colors.accent, letterSpacing: 4 },
  actions: { gap: space.sm },
});
