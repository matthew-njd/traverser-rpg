import { StyleSheet, Text } from 'react-native';

import { Button, Card } from './primitives';
import { colors, space, type } from './theme';

/**
 * GDD 13 §3.1's Rest Day control. The confirmation is GDD 11 §5's copy verbatim, and it doubles as
 * the already-tagged state — the same line either way, which is what §3.1 asks for.
 *
 * Nothing here is punitive and nothing counts: no cap, no cooldown, no "are you sure".
 *
 * **Refused while a battle is open, and the note says so.** A running fight holds its own copy of
 * Vigor (`session.ts` reads it once at build) and `settleBattle` writes that copy back on the way
 * out, so a tag landing mid-fight is overwritten by the fight's own result — the player loses their
 * one daily restore and, with no Vigor readout on this screen, never sees that it happened (drills
 * note 13). The snapshot is the signal because it spans both paths: it is written when the
 * encounter starts and cleared only on settle or flee, so a battle left open across a restart is
 * still refused.
 */
export function RestDay({
  name,
  tagged,
  fighting,
  onTag,
}: {
  name: string;
  tagged: boolean;
  fighting: boolean;
  onTag: () => void;
}) {
  return (
    <Card>
      <Button
        label={tagged ? '✓ Rest Day tagged' : 'Tag today as a Rest Day'}
        variant="secondary"
        disabled={tagged || fighting}
        onPress={onTag}
      />

      {!tagged && fighting ? (
        <Text style={styles.note}>
          A fight is still open. Settle or flee it first — the rest will keep.
        </Text>
      ) : null}

      {tagged ? (
        <Text style={styles.note}>
          Rest tagged. {name || 'The Traverser'}&apos;s strength returns — the road isn&apos;t going
          anywhere.
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  note: { ...type.small, color: colors.textDim, marginTop: space.sm },
});
