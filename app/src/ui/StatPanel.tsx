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
/**
 * M4/P4 — what each stat does, at the point of spending (drills note 9). The move categories are the
 * words every skill slot shows, so a note can be checked against the loadout it describes.
 *
 * ↯ Vigor sits apart from the five that decide a fight: a drill build put 30 of 45 points into it
 * and could not win, and nothing here said that was a choice with a cost.
 */
export const STATS = [
  { key: 'vigor', label: 'Vigor', note: 'Your health. Lets you take more hits.', group: 'Survive' },
  { key: 'might', label: 'Might', note: 'Increases damage of Physical moves, Attack included.', group: 'Fight' },
  { key: 'resolve', label: 'Resolve', note: 'Less damage from enemy Physical moves.', group: 'Fight' },
  { key: 'favor', label: 'Favor', note: 'Increases damage of Divine moves.', group: 'Fight' },
  { key: 'aegis', label: 'Aegis', note: 'Less damage from enemy Divine moves.', group: 'Fight' },
  { key: 'stride', label: 'Stride', note: 'Turn order. Higher acts first each round.', group: 'Fight' },
] as const satisfies readonly {
  key: keyof StatDeltas;
  label: string;
  note: string;
  group: 'Survive' | 'Fight';
}[];

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

      {STATS.map((stat, index) => {
        const opensGroup = index === 0 || STATS[index - 1]?.group !== stat.group;

        return (
          <View key={stat.key}>
            {opensGroup ? (
              <Text style={[styles.group, index > 0 && styles.groupBreak]}>{stat.group}</Text>
            ) : null}

            <View style={[styles.row, !opensGroup && styles.ruled]}>
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
          </View>
        );
      })}

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
  group: { ...type.small, color: colors.accent, fontWeight: '600', marginTop: space.sm },
  groupBreak: { marginTop: space.md },
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
