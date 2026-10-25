import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { type OwnedGear, type SatchelItem, readEquippedGear, readOwnedGear, readSatchel, readSnapshot } from '@/battle/mirror';
import { readContentRows } from '@/content/bundle';
import { type Labels, loadLabels } from '@/content/labels';
import { getDatabase } from '@/db/open';
import { deviceLocalDates } from '@/health/localDate';
import { type EquippedBonus, effectiveStats } from '@/progression/stats';
import { maxVigorFor, vigorReadout } from '@/progression/vigor';
import { syncNow } from '@/runtime';
import { usePlayerStore } from '@/state/playerStore';
import { type MirrorPlayer, readPlayer } from '@/sync/mirror';
import { EquipError, consumeItem, equipGear } from '@/sync/writes';
import { GearRack } from '@/ui/GearRack';
import { type ItemKind, ItemGrid } from '@/ui/ItemGrid';
import { Screen, SegmentedControl, Title } from '@/ui/primitives';
import { space } from '@/ui/theme';

/**
 * GDD 13 §5 — the Satchel. Gear and Items are sub-views, not routes (tech-04 §4.3); the Bestiary
 * joins them at M5/P5.
 */
export default function Inventory() {
  const [view, setView] = useState<'gear' | 'items'>('gear');
  const [player, setPlayer] = useState<MirrorPlayer | null>(null);
  const [equipped, setEquipped] = useState<readonly EquippedBonus[]>([]);
  const [owned, setOwned] = useState<readonly OwnedGear[]>([]);
  const [items, setItems] = useState<readonly SatchelItem[]>([]);
  const [kinds, setKinds] = useState<ReadonlyMap<string, ItemKind>>(new Map());
  const [labels, setLabels] = useState<Labels>(new Map());
  const [fighting, setFighting] = useState(false);
  const [vigor, setVigor] = useState<{ current: number; max: number } | null>(null);

  const reload = useCallback(() => {
    const db = getDatabase();
    const mirror = readPlayer(db);

    setPlayer(mirror);

    if (mirror === null) {
      setVigor(null);
    } else {
      const max = maxVigorFor(db, mirror);

      setVigor({ current: vigorReadout(mirror, max, Date.now(), deviceLocalDates), max });
    }

    setEquipped(readEquippedGear(db));
    setOwned(readOwnedGear(db));
    setItems(readSatchel(db));
    setKinds(
      new Map(
        readContentRows(db, 'item_def').map((row) => [
          String(row.id),
          {
            category: String(row.category),
            battleOnly: row.battle_only === 1,
            healPct: typeof row.heal_pct === 'number' ? row.heal_pct : null,
          },
        ]),
      ),
    );
    setLabels(loadLabels(db));
    setFighting(readSnapshot(db) !== null);
  }, []);

  useFocusEffect(reload);

  /** GDD 8 §2. Local first, like every write here; the replay is best-effort. */
  const equip = (playerGearId: string, wear: boolean) => {
    try {
      equipGear(getDatabase(), playerGearId, wear, Date.now());
    } catch (error) {
      // A fight opened or the piece left since the last render. The rack re-reads either way.
      if (!(error instanceof EquipError)) {
        throw error;
      }
    }

    usePlayerStore.getState().hydrate(getDatabase());
    reload();

    void syncNow(Date.now(), { withNewWork: true }).catch(() => undefined);
  };

  /** GDD 4 §4. A refused use writes nothing; the re-read shows why. */
  const heal = (playerItemId: string) => {
    if (consumeItem(getDatabase(), playerItemId, Date.now(), deviceLocalDates) !== null) {
      usePlayerStore.getState().hydrate(getDatabase());
      void syncNow(Date.now(), { withNewWork: true }).catch(() => undefined);
    }

    reload();
  };

  return (
    <Screen tabbed>
      <Title>Satchel</Title>

      <SegmentedControl
        options={[
          { value: 'gear', label: 'Gear' },
          { value: 'items', label: 'Items' },
        ]}
        value={view}
        onChange={setView}
      />

      <View style={[styles.pane, view === 'gear' ? null : styles.hidden]}>
        <ScrollView contentContainerStyle={styles.paneContent}>
          {player === null ? null : (
            <GearRack
              gear={owned}
              labels={labels}
              stats={effectiveStats(player, equipped)}
              fighting={fighting}
              onEquip={equip}
            />
          )}
        </ScrollView>
      </View>

      <View style={[styles.pane, view === 'items' ? null : styles.hidden]}>
        <ScrollView contentContainerStyle={styles.paneContent}>
          <ItemGrid
            items={items}
            kinds={kinds}
            labels={labels}
            vigor={vigor}
            fighting={fighting}
            onUse={heal}
          />
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pane: { flex: 1 },
  paneContent: { paddingBottom: space.md },
  hidden: { display: 'none' },
});
