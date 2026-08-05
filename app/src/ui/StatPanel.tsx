import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { StatDeltas } from '../sync/writes';
import { NO_STATS, totalPoints } from '../sync/writes';
import { Button, Card, Heading } from './primitives';
import { MIN_TOUCH_TARGET, colors, radius, space, type } from './theme';

/**
 * GDD 13 §3.2's six-stat allocation panel.
 *
 * ↯ **The stepper's ± values are L4 ephemeral state** (tech-04 §5.4) — they live in this component
 * and nowhere else until Confirm, which moves them to L2 and the replay queue in one transaction.
 * That split is the whole reason a draft is safe: nothing is spent, queued or shown to the server
 * until the player says so.
 *
 * ↯ **Permanent on confirm.** The locked GDD names no respec mechanic anywhere, so there is no undo
 * — which is why Confirm is a deliberate second action rather than each `+` spending a point.
 */
const STATS = [
  { key: 'vigor', label: 'Vigor', note: 'Health pool' },
  { key: 'might', label: 'Might', note: 'Physical damage' },
  { key: 'resolve', label: 'Resolve', note: 'Physical defence' },
  { key: 'favor', label: 'Favor', note: 'Divine damage' },
  { key: 'aegis', label: 'Aegis', note: 'Divine defence' },
  { key: 'stride', label: 'Stride', note: 'Turn order' },
] as const satisfies readonly { key: keyof StatDeltas; label: string; note: string }[];

/**
 * One press applied to a draft, or the draft unchanged if it would break the budget.
 *
 * ↯ Exported and pure so the rule can be tested without a renderer, and so it is checked against the
 * draft it is updating *from* rather than against the balance closed over by whatever render
 * dispatched the press. React batches state updates: two presses in one tick both see the same
 * render, and the `+` button's `disabled` prop is stale for exactly the same reason — so the prop
 * cannot be the only guard even though it is the one the player normally meets.
 */
export function nextDraft(
  draft: StatDeltas,
  key: keyof StatDeltas,
  by: number,
  unspent: number,
): StatDeltas {
  const next = draft[key] + by;

  if (next < 0 || (by > 0 && totalPoints(draft) >= unspent)) {
    return draft;
  }

  return { ...draft, [key]: next };
}

export function StatPanel({
  unspent,
  current,
  onConfirm,
  busy = false,
}: {
  unspent: number;
  /** Effective values before this draft — base plus everything already allocated. */
  current: StatDeltas;
  onConfirm: (deltas: StatDeltas) => void;
  busy?: boolean;
}) {
  const [draft, setDraft] = useState<StatDeltas>(NO_STATS);
  const spent = totalPoints(draft);
  const remaining = unspent - spent;

  const adjust = (key: keyof StatDeltas, by: number) => {
    setDraft((previous) => nextDraft(previous, key, by, unspent));
  };

  return (
    <Card>
      <View style={styles.header}>
        <Heading>Stats</Heading>
        {unspent > 0 ? (
          <Text style={styles.unspent}>
            {remaining} point{remaining === 1 ? '' : 's'} to spend
          </Text>
        ) : (
          <Text style={styles.none}>No points to spend</Text>
        )}
      </View>

      {STATS.map((stat) => (
        <View key={stat.key} style={styles.row}>
          <View style={styles.labels}>
            <Text style={styles.label}>{stat.label}</Text>
            <Text style={styles.note}>{stat.note}</Text>
          </View>

          <Text style={styles.value}>
            {current[stat.key]}
            {draft[stat.key] > 0 ? <Text style={styles.pending}> +{draft[stat.key]}</Text> : null}
          </Text>

          {unspent > 0 ? (
            <View style={styles.stepper}>
              <Step
                label="−"
                accessibilityLabel={`Remove a point from ${stat.label}`}
                disabled={draft[stat.key] === 0}
                onPress={() => adjust(stat.key, -1)}
              />
              <Step
                label="+"
                accessibilityLabel={`Add a point to ${stat.label}`}
                disabled={remaining <= 0}
                onPress={() => adjust(stat.key, 1)}
              />
            </View>
          ) : null}
        </View>
      ))}

      {spent > 0 ? (
        <View style={styles.actions}>
          <Text style={styles.warning}>Allocation is permanent.</Text>
          <Button
            label={`Confirm ${spent} point${spent === 1 ? '' : 's'}`}
            busy={busy}
            onPress={() => {
              onConfirm(draft);
              setDraft(NO_STATS);
            }}
          />
          <Button label="Reset" variant="secondary" onPress={() => setDraft(NO_STATS)} />
        </View>
      ) : null}
    </Card>
  );
}

function Step({
  label,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.step, pressed && styles.stepPressed, disabled && styles.stepOff]}
    >
      <Text style={styles.stepLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  unspent: { ...type.small, color: colors.gold, fontWeight: '600' },
  none: { ...type.small, color: colors.textDim },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: MIN_TOUCH_TARGET },
  labels: { flex: 1 },
  label: { ...type.body, color: colors.text },
  note: { ...type.small, color: colors.textDim },
  value: { ...type.heading, color: colors.text, minWidth: 56, textAlign: 'right' },
  pending: { color: colors.gold },

  stepper: { flexDirection: 'row', gap: space.xs },
  step: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
  },
  stepPressed: { opacity: 0.7 },
  stepOff: { opacity: 0.35 },
  stepLabel: { ...type.heading, color: colors.text },

  actions: { gap: space.sm, marginTop: space.sm },
  warning: { ...type.small, color: colors.textDim },
});
