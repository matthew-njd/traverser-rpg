import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { StatDeltas } from '../sync/writes';
import { NO_STATS, totalPoints } from '../sync/writes';
import { Button, Card, Heading } from './primitives';
import { MIN_TOUCH_TARGET, colors, radius, space, tabular, type } from './theme';

/**
 * GDD 13 §3.2's six-stat allocation panel.
 *
 * The stepper's ± values are L4 ephemeral state (tech-04 §5.4) — nothing is spent, queued or sent
 * until Confirm, which moves them to L2 and the replay queue in one transaction.
 *
 * Permanent on confirm: the GDD names no respec mechanic, so there is no undo. That is why
 * Confirm is a second deliberate action rather than each `+` spending a point.
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
 * Pure and checked against the draft it updates *from*, not the balance closed over by the render
 * that dispatched the press. React batches, so two presses in one tick see the same render and the
 * `disabled` prop is stale — it cannot be the only guard.
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

      {STATS.map((stat, index) => (
        <View key={stat.key} style={[styles.row, index > 0 && styles.ruled]}>
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
  unspent: { ...type.small, ...tabular, color: colors.gold, fontWeight: '600' },
  none: { ...type.small, color: colors.textDim },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: MIN_TOUCH_TARGET },
  // GDD 13 §11 — six stats read as one ruled table, not six stacked plates.
  ruled: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  labels: { flex: 1 },
  label: { ...type.body, color: colors.text },
  note: { ...type.small, color: colors.textDim },
  value: { ...type.heading, ...tabular, color: colors.text, minWidth: 56, textAlign: 'right' },
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
