import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { OwnedGear } from '../battle/mirror';
import { type Labels, labelFor } from '../content/labels';
import { gearBonuses } from '../progression/stats';
import type { StatDeltas } from '../sync/writes';
import { Button, Card } from './primitives';
import { GRADE_BORDER } from './RevealCard';
import { MIN_TOUCH_TARGET, colors, radius, space, tabular, type } from './theme';

/**
 * GDD 13 §5.1 — the four slots in a row; tapping one opens its comparison.
 *
 * Each held piece shows the stats it would leave you with before the tap, so one tap is enough:
 * equipping is reversible, unlike an allocation.
 */
const SLOTS = ['weapon', 'armor', 'accessory', 'trinket'] as const;

/** Not derived from the IDs: the IDs are American (`armor`, `vigor`) and the copy is Canadian. */
const NAMES: Record<string, string> = {
  weapon: 'Weapon',
  armor: 'Armour',
  accessory: 'Accessory',
  trinket: 'Trinket',
  might: 'Might',
  resolve: 'Resolve',
  vigor: 'Vigour',
  favor: 'Favour',
  aegis: 'Aegis',
  mortal: 'Mortal',
  heroic: 'Heroic',
  mythic: 'Mythic',
  divine: 'Divine',
};

const nameOf = (key: string) => NAMES[key] ?? key;

const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

export function GearRack({
  gear,
  labels,
  stats,
  fighting,
  onEquip,
}: {
  gear: readonly OwnedGear[];
  labels: Labels;
  /** Effective stats with what is worn now. */
  stats: StatDeltas;
  fighting: boolean;
  onEquip: (playerGearId: string, equip: boolean) => void;
}) {
  const [open, setOpen] = useState<(typeof SLOTS)[number]>('weapon');

  const pieces = gear.filter((piece) => piece.slot === open);
  const worn = pieces.find((piece) => piece.equippedSlot !== null);
  const held = pieces.filter((piece) => piece !== worn);
  const wornBonus = new Map(worn === undefined ? [] : gearBonuses(open, worn));

  return (
    <View style={styles.rack}>
      <View style={styles.slots}>
        {SLOTS.map((slot) => {
          const piece = gear.find((each) => each.slot === slot && each.equippedSlot !== null);

          return (
            <Pressable
              key={slot}
              accessibilityRole="tab"
              accessibilityState={{ selected: slot === open }}
              onPress={() => setOpen(slot)}
              style={[
                styles.slot,
                { borderColor: piece === undefined ? colors.border : (GRADE_BORDER[piece.tier] ?? colors.border) },
                slot === open && styles.slotOpen,
              ]}
            >
              <Text style={styles.slotName}>{nameOf(slot)}</Text>
              <Text style={styles.slotPiece} numberOfLines={2}>
                {piece === undefined ? 'Empty' : labelFor(labels, piece.gearDefId)}
              </Text>
              {piece?.zoneId == null ? null : (
                <Text style={styles.badge}>{labelFor(labels, piece.zoneId)}</Text>
              )}
            </Pressable>
          );
        })}
      </View>

      <Card style={styles.card}>
        {worn === undefined ? (
          <Text style={styles.note}>Nothing worn.</Text>
        ) : (
          <Row piece={worn} labels={labels} lines={[...wornBonus].map(([stat, bonus]) => `+${bonus} ${nameOf(stat)}`)}>
            <Button label="Take off" variant="secondary" disabled={fighting} onPress={() => onEquip(worn.playerGearId, false)} />
          </Row>
        )}

        {held.length === 0 ? <Text style={styles.note}>Nothing else held for this slot.</Text> : null}

        {held.map((piece) => {
          const bonus = new Map(gearBonuses(open, piece));
          const changed = [...new Set([...wornBonus.keys(), ...bonus.keys()])];

          return (
            <Row
              key={piece.playerGearId}
              piece={piece}
              labels={labels}
              lines={changed.map((stat) => {
                const delta = (bonus.get(stat) ?? 0) - (wornBonus.get(stat) ?? 0);

                return `${nameOf(stat)} ${stats[stat]} → ${stats[stat] + delta} (${signed(delta)})`;
              })}
            >
              <Button label="Wear" variant="secondary" disabled={fighting} onPress={() => onEquip(piece.playerGearId, true)} />
            </Row>
          );
        })}

        {fighting ? <Text style={styles.note}>A fight is still open. Settle or flee it first.</Text> : null}
      </Card>
    </View>
  );
}

function Row({
  piece,
  labels,
  lines,
  children,
}: {
  piece: OwnedGear;
  labels: Labels;
  lines: string[];
  children: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.name}>
          {labelFor(labels, piece.gearDefId)}
          {piece.equippedSlot === null ? null : <Text style={styles.worn}> · worn</Text>}
        </Text>
        <Text style={styles.note}>{nameOf(piece.tier)}</Text>
        {lines.map((line) => (
          <Text key={line} style={styles.note}>
            {line}
          </Text>
        ))}
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  rack: { gap: space.md },
  slots: { flexDirection: 'row', gap: space.sm },
  slot: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET * 2,
    padding: space.sm,
    gap: space.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  slotOpen: { backgroundColor: colors.surfaceRaised },
  slotName: { ...type.small, color: colors.textDim },
  slotPiece: { ...type.small, color: colors.text },
  badge: { ...type.small, color: colors.accent },
  card: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  text: { flex: 1 },
  name: { ...type.body, color: colors.text },
  worn: { ...type.small, color: colors.accent },
  note: { ...type.small, ...tabular, color: colors.textDim },
});
