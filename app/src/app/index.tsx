import { StyleSheet, Text, View } from 'react-native';

// Placeholder home. M0 proved the pipeline; M1's screens (GDD 13 §3) replace this.
export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Traverser</Text>
      <Text style={styles.subtitle}>M1 begins here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
});
