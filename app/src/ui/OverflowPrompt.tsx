import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { type Labels, labelFor } from '../content/labels';
import type { Overflow } from '../progression/overflow';
import { Button, Heading } from './primitives';
import { MIN_TOUCH_TARGET, colors, radius, space, type } from './theme';

/** The row the player chose to let go: the incoming one, or something already held. */
export type OverflowPick = { readonly incoming: true } | { readonly incoming: false; readonly id: string };

/**
 * GDD 13 §5.1's keep/discard modal, one component for both satchel and gear rack (§5.2: "reused
 * rather than redesigned"). ↯ **Never dismissed without a choice** — back does nothing — because
 * GDD 4 §5.2 says nothing is lost without the player's acknowledgment, and nothing is kept past a cap
 * without it either.
 */
export function OverflowPrompt({
  overflow,
  labels,
  onLeave,
  onKeep,
}: {
  overflow: Overflow | null;
  labels: Labels;
  onLeave: (pick: OverflowPick) => void;
  onKeep: () => void;
}) {
  const [picked, setPicked] = useState<OverflowPick | null>(null);
  const key = overflow === null ? '' : `${overflow.pendingId ?? overflow.incoming.id}`;

  // A new decision starts from the suggestion, never from the last one's pick.
  useEffect(() => {
    const suggested = overflow?.others.find((other) => other.suggested);

    setPicked(suggested === undefined ? null : { incoming: false, id: suggested.id });
  }, [key]);

  if (overflow === null) {
    return null;
  }

  const name = labelFor(labels, overflow.incoming.defId);
  const full = overflow.kind === 'item' ? 'Your satchel is full' : 'Your gear is full';
  const isPicked = (pick: OverflowPick) =>
    picked !== null &&
    picked.incoming === pick.incoming &&
    (pick.incoming || (!picked.incoming && picked.id === pick.id));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <Heading>{overflow.room ? `Room for ${name}` : full}</Heading>
          <Text style={styles.note}>
            {overflow.room ? 'There is room now. Keep it, or choose something to leave behind.' : `Keep ${name}? Choose something to leave behind.`}
          </Text>

          <ScrollView contentContainerStyle={styles.list}>
            <Row label={name} tag="New" on={isPicked({ incoming: true })} onPress={() => setPicked({ incoming: true })} />

            {overflow.others.map((other) => (
              <Row
                key={other.id}
                label={labelFor(labels, other.defId)}
                tag={other.suggested ? 'Suggested' : null}
                on={isPicked({ incoming: false, id: other.id })}
                onPress={() => setPicked({ incoming: false, id: other.id })}
              />
            ))}
          </ScrollView>

          {overflow.room ? <Button label={`Keep ${name}`} onPress={onKeep} /> : null}
          <Button
            label="Leave behind"
            variant={overflow.room ? 'secondary' : 'primary'}
            disabled={picked === null}
            onPress={() => picked !== null && onLeave(picked)}
          />
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, tag, on, onPress }: { label: string; tag: string | null; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.row, on && styles.rowOn]}
    >
      <Text style={styles.name}>{label}</Text>
      {tag === null ? null : <Text style={styles.tag}>{tag}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'center', padding: space.md, backgroundColor: `${colors.background}D9` },
  sheet: {
    maxHeight: '85%',
    gap: space.md,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  list: { gap: space.sm },
  row: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowOn: { borderColor: colors.accent, backgroundColor: colors.surfaceRaised },
  name: { ...type.body, color: colors.text },
  tag: { ...type.small, color: colors.textDim },
  note: { ...type.small, color: colors.textDim },
});
