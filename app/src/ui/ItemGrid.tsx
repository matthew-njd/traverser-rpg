import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { SatchelItem } from '../battle/mirror';
import { type Labels, labelFor } from '../content/labels';
import { Button, SegmentedControl } from './primitives';
import { MIN_TOUCH_TARGET, colors, radius, space, tabular, type } from './theme';

/** GDD 4 §5.1 — one item per slot, never stacked. */
export const ITEM_SLOTS = 20;

export interface ItemKind {
  readonly category: string;
  readonly battleOnly: boolean;
  readonly healPct: number | null;
}

type Filter = 'all' | 'heal' | 'buff' | 'charm';

/** GDD 13 §5.2's chips. Surge and Breach are both Type Charms (GDD 4 §3). */
const FILTER_OF: Record<string, Filter> = { heal: 'heal', buff: 'buff', surge: 'charm', breach: 'charm' };

/**
 * GDD 13 §5.2 — the satchel as a grid, with battle-only items locked outside a fight. A healing
 * item can be used from here (GDD 4 §4).
 */
export function ItemGrid({
  items,
  kinds,
  labels,
  vigor,
  found = new Set(),
  fighting,
  onUse,
}: {
  items: readonly SatchelItem[];
  kinds: ReadonlyMap<string, ItemKind>;
  labels: Labels;
  vigor: { current: number; max: number } | null;
  /** GDD 13 §5.2's road finds, highlighted while Items stays open. */
  found?: ReadonlySet<string>;
  fighting: boolean;
  onUse: (playerItemId: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [picked, setPicked] = useState<string | null>(null);

  const shown = items.filter(
    (item) => filter === 'all' || FILTER_OF[kinds.get(item.itemDefId)?.category ?? ''] === filter,
  );
  // Empty slots only under All: under a filter they would count slots the filter is hiding.
  const empties = filter === 'all' ? Math.max(0, ITEM_SLOTS - items.length) : 0;
  const pick = items.find((item) => item.playerItemId === picked);
  const pickKind = pick === undefined ? undefined : kinds.get(pick.itemDefId);
  const full = vigor !== null && vigor.current >= vigor.max;

  return (
    <View style={styles.wrap}>
      <SegmentedControl
        options={[
          { value: 'all', label: 'All' },
          { value: 'heal', label: 'Healing' },
          { value: 'buff', label: 'Buffs' },
          { value: 'charm', label: 'Charms' },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {found.size === 0 ? null : (
        <Text style={styles.found}>
          Found along the road:{' '}
          {items
            .filter((item) => found.has(item.playerItemId))
            .map((item) => labelFor(labels, item.itemDefId))
            .join(', ')}
        </Text>
      )}

      <Text style={styles.count}>
        {items.length} / {ITEM_SLOTS}
        {vigor === null ? null : ` · Vigour ${vigor.current} / ${vigor.max}`}
      </Text>

      <View style={styles.grid}>
        {shown.map((item) => {
          const locked = kinds.get(item.itemDefId)?.battleOnly ?? true;

          return (
            <Pressable
              key={item.playerItemId}
              accessibilityRole="button"
              accessibilityLabel={labelFor(labels, item.itemDefId)}
              onPress={() => setPicked(item.playerItemId)}
              style={[
                styles.tile,
                locked && styles.locked,
                found.has(item.playerItemId) && styles.foundTile,
                item.playerItemId === picked && styles.picked,
              ]}
            >
              <Text style={styles.tileName} numberOfLines={3}>
                {labelFor(labels, item.itemDefId)}
              </Text>
              {locked ? <Text style={styles.lock}>🔒</Text> : null}
            </Pressable>
          );
        })}

        {Array.from({ length: empties }, (_, index) => (
          <View key={`empty-${index}`} style={[styles.tile, styles.empty]} />
        ))}
      </View>

      {pick === undefined ? null : (
        <View style={styles.detailRow}>
          <View style={styles.detailText}>
            <Text style={styles.detail}>{labelFor(labels, pick.itemDefId)}</Text>
            <Text style={styles.note}>
              {pickKind?.battleOnly ?? true
                ? 'Requires an active battle.'
                : `Restores ${pickKind?.healPct ?? 0}% of your Vigour.${
                    fighting ? ' A fight is still open.' : full ? ' Your Vigour is full.' : ''
                  }`}
            </Text>
          </View>

          {pickKind?.battleOnly ?? true ? null : (
            <Button
              label="Use"
              variant="secondary"
              disabled={fighting || full}
              onPress={() => {
                onUse(pick.playerItemId);
                setPicked(null);
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  count: { ...type.small, ...tabular, color: colors.textDim },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    width: '23%',
    aspectRatio: 1,
    minHeight: MIN_TOUCH_TARGET,
    padding: space.xs,
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locked: { opacity: 0.5 },
  picked: { borderColor: colors.accent },
  foundTile: { borderColor: colors.gold, borderWidth: 2 },
  found: { ...type.small, color: colors.gold },
  empty: { backgroundColor: colors.background },
  tileName: { ...type.small, color: colors.text },
  lock: { fontSize: 12, alignSelf: 'flex-end' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  detailText: { flex: 1 },
  detail: { ...type.body, color: colors.text },
  note: { ...type.small, color: colors.textDim },
});
