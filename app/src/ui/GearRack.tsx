import { StyleSheet, Text, View } from 'react-native';

import type { OwnedGear } from '../battle/mirror';
import { type Labels, labelFor } from '../content/labels';
import { SLOT_STAT } from '../progression/stats';
import type { StatDeltas } from '../sync/writes';
import { Button, Card, Heading } from './primitives';
import { colors, space, tabular, type } from './theme';

/**
 * GDD 8 §2's three worn slots. The Trinket slot is M5's (M4 plan §3.1), so it is not listed.
 *
 * Each unworn piece shows the stat it would leave you with before the tap, so one tap is enough:
 * equipping is reversible, unlike an allocation.
 */
const SLOTS = Object.keys(SLOT_STAT) as (keyof typeof SLOT_STAT)[];

/** Not derived from the IDs: the IDs are American (`armor`, `vigor`) and the copy is Canadian. */
const NAMES: Record<string, string> = {
  weapon: 'Weapon',
  armor: 'Armour',
  accessory: 'Accessory',
  might: 'Might',
  resolve: 'Resolve',
  vigor: 'Vigour',
};

const statName = (key: string) => NAMES[key] ?? key;

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
  return (
    <Card style={styles.card}>
      <Heading>Gear</Heading>

      {SLOTS.map((slot) => {
        const stat = SLOT_STAT[slot];
        const pieces = gear.filter((piece) => piece.slot === slot);
        const wornBonus = pieces.find((piece) => piece.equippedSlot !== null)?.bonusPrimary ?? 0;

        return (
          <View key={slot} style={styles.slot}>
            <Text style={styles.slotName}>
              {statName(slot)} · {statName(stat)}
            </Text>

            {pieces.length === 0 ? <Text style={styles.note}>Nothing yet.</Text> : null}

            {pieces.map((piece) => {
              const worn = piece.equippedSlot !== null;
              const after = stats[stat] - wornBonus + (worn ? 0 : piece.bonusPrimary);

              return (
                <View key={piece.playerGearId} style={styles.row}>
                  <View style={styles.text}>
                    <Text style={styles.name}>
                      {labelFor(labels, piece.gearDefId)}
                      {worn ? <Text style={styles.worn}> · worn</Text> : null}
                    </Text>
                    <Text style={styles.note}>
                      +{piece.bonusPrimary} {statName(stat)}
                      {worn ? null : ` · ${statName(stat)} ${stats[stat]} → ${after}`}
                    </Text>
                  </View>

                  <Button
                    label={worn ? 'Take off' : 'Wear'}
                    variant="secondary"
                    disabled={fighting}
                    onPress={() => onEquip(piece.playerGearId, !worn)}
                  />
                </View>
              );
            })}
          </View>
        );
      })}

      {fighting ? (
        <Text style={styles.note}>A fight is still open. Settle or flee it first.</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  slot: { gap: space.sm },
  slotName: { ...type.small, color: colors.textDim },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  text: { flex: 1 },
  name: { ...type.body, color: colors.text },
  worn: { ...type.small, color: colors.accent },
  note: { ...type.small, ...tabular, color: colors.textDim },
});
