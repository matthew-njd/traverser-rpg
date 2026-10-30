import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { readSatchel } from '@/battle/mirror';
import { loadLabels, labelFor } from '@/content/labels';
import { getDatabase } from '@/db/open';
import { Body, Button, Screen, Title } from '@/ui/primitives';
import { Sprite } from '@/ui/Sprite';
import { colors, radius, space, tabular, type } from '@/ui/theme';

/**
 * GDD 10 Screen 5 (§5.2) — the road provisioning the Traverser before their first steps.
 *
 * ↯ **Nothing is granted here.** The Blade and the three Salves are created server-side at
 * registration and arrive in that response, so this screen only *reveals* what the mirror already
 * holds. Granting on the device would mint `player_item.id`s the server never had, and every later
 * `items_consumed` naming one would delete nothing (T5 §10.3).
 *
 * Armor and Accessory stay empty on purpose — §5.2 wants the first Mortal drop to feel earned
 * rather than to fill a slot that was already full.
 */
export default function Loadout() {
  const router = useRouter();
  const db = getDatabase();
  const labels = loadLabels(db);

  const satchel = readSatchel(db);
  const weapon = db.getFirstSync<{ gear_def_id: string; bonus_primary: number }>(
    "SELECT gear_def_id, bonus_primary FROM player_gear WHERE equipped_slot = 'weapon'",
  );

  // One row per physical item (GDD 4 §5.1), so the count is what the player sees, not a quantity.
  const salves = satchel.filter((item) => item.itemDefId === 'item_travelers_salve').length;

  return (
    <Screen scroll>
      <View style={styles.body}>
        <Title>The road provides</Title>
        <Body dim>
          Nobody sets out empty-handed. Take these — you will want them before the first waystone.
        </Body>

        {weapon === null ? null : (
          <Plate
            subject={weapon.gear_def_id}
            glyph="†"
            name={labelFor(labels, weapon.gear_def_id)}
            note={`Equipped · +${weapon.bonus_primary} Might`}
          />
        )}

        {salves === 0 ? null : (
          <Plate
            subject="item_travelers_salve"
            glyph="✳"
            name={labelFor(labels, 'item_travelers_salve')}
            note={`×${salves} · restores Vigour mid-fight`}
          />
        )}
      </View>

      <Button label="Continue" onPress={() => router.push('/06-tutorial')} />
    </Screen>
  );
}

/** GDD 13 §11's art rule: an inked silhouette on a cream plate. */
function Plate({ subject, glyph, name, note }: { subject: string; glyph: string; name: string; note: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.plate}>
        <Sprite subject={subject} size={72} glyph={glyph} />
      </View>

      <View style={styles.text}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.note}>{note}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', gap: space.md, paddingVertical: space.lg },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  plate: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.marble,
    borderRadius: radius.md,
  },

  text: { flex: 1, gap: space.xs },
  name: { ...type.heading, color: colors.text },
  note: { ...type.small, ...tabular, color: colors.textDim },
});
