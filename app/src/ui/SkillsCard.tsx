import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LOADOUT_SLOTS, type LimitedMove } from '../battle/session';
import { type Labels, labelFor } from '../content/labels';
import { playSfx } from '../audio/bus';
import { Button, Card, Heading } from './primitives';
import { MIN_TOUCH_TARGET, colors, radius, space, tabular, type } from './theme';

/**
 * GDD 13 §3.2 (amended 2026-10-25) — pick four from everything available (GDD 3 §4.1).
 *
 * ↯ Staged, then saved: a swap passes through three selected, and saving that half-step would let
 * `loadoutFor`'s fill take the empty slot. Saved in `available`'s unlock order, never tap order, so
 * the battle menu's quadrants stay put (GDD 13 §6.1).
 */
export function SkillsCard({
  available,
  equipped,
  labels,
  fighting,
  onSet,
}: {
  available: readonly LimitedMove[];
  equipped: readonly LimitedMove[];
  labels: Labels;
  fighting: boolean;
  onSet: (skillIds: string[]) => void;
}) {
  const saved = equipped.map((move) => move.id).join(',');
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set(equipped.map((move) => move.id)));

  // A reload (a save, a Trinket change) replaces the draft with what is stored.
  useEffect(() => setPicked(new Set(saved.split(',').filter(Boolean))), [saved]);

  const needed = Math.min(LOADOUT_SLOTS, available.length);
  const full = picked.size >= LOADOUT_SLOTS;
  const ids = available.filter((move) => picked.has(move.id)).map((move) => move.id);
  const changed = ids.length !== equipped.length || equipped.some((move) => !picked.has(move.id));

  const toggle = (id: string) => {
    const next = new Set(picked);

    if (!next.delete(id)) {
      next.add(id);
    }

    setPicked(next);
  };

  const detail = (move: LimitedMove) =>
    `${move.typeId === null ? 'Physical' : labelFor(labels, move.typeId)} · Power ${move.power} · ${move.uses} uses`;

  return (
    <Card style={styles.card}>
      <Heading>Skills</Heading>

      <Text style={styles.note}>
        {available.length <= LOADOUT_SLOTS
          ? 'Every move you have is equipped. A new skill or a Trinket’s move will appear here.'
          : `Choose ${LOADOUT_SLOTS} · ${picked.size} selected${full ? '. Deselect one to choose another.' : ''}`}
      </Text>

      {available.map((move) => {
        const on = picked.has(move.id);
        const locked = fighting || available.length <= LOADOUT_SLOTS || (!on && full);

        return (
          <Pressable
            key={move.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on, disabled: locked }}
            accessibilityLabel={labelFor(labels, move.id)}
            disabled={locked}
            onPress={() => {
              playSfx('sfx_toggle');
              toggle(move.id);
            }}
            style={[styles.row, on && styles.rowOn]}
          >
            <View style={styles.text}>
              <Text style={styles.name}>{labelFor(labels, move.id)}</Text>
              <Text style={styles.note}>{detail(move)}</Text>
            </View>

            {on ? <Text style={styles.equipped}>Equipped</Text> : null}
          </Pressable>
        );
      })}

      {available.length <= LOADOUT_SLOTS ? null : (
        <Button
          label="Save"
          disabled={fighting || !changed || picked.size !== needed}
          onPress={() => onSet(ids)}
        />
      )}

      {fighting ? <Text style={styles.note}>A fight is still open. Settle or flee it first.</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  row: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowOn: { borderColor: colors.accent, backgroundColor: colors.surfaceRaised },
  text: { flex: 1 },
  name: { ...type.body, color: colors.text },
  equipped: { ...type.small, color: colors.accent },
  note: { ...type.small, ...tabular, color: colors.textDim },
});
