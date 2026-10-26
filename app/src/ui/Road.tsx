import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { GateState, RoadGate, RoadState, RoadZone } from '../progression/road';
import { segmentFill } from '../progression/road';
import { MIN_TOUCH_TARGET, colors, radius, space, tabular, type } from './theme';

/**
 * GDD 9 §4 — the Road as layout and state. Art is the art phase's (§6, GDD 13 §10).
 *
 * Presentational: it takes a `RoadState` and returns a tree. The derivation lives in
 * `progression/road.ts`, which is what lets this be tested by handing it a state rather than by
 * walking a player to a gate.
 */
export function Road({
  state,
  selected = null,
  onSelect,
  onFace,
  onZoneLayout,
}: {
  state: RoadState;
  /** Explore's target (GDD 13 §4.2, amended at M5/P6), highlighted. */
  selected?: string | null;
  /** GDD 9 §4.3 — only an unlocked segment can be Explore's target. */
  onSelect?: (zoneId: string) => void;
  /** GDD 9 §4.2 — tapping a reached gate starts the fight; a defeated one is a rematch (GDD 5 §5). */
  onFace?: (gate: RoadGate) => void;
  /** Reports each segment's y offset so the screen can scroll the Viewport to it (§4.3). */
  onZoneLayout?: (zoneId: string, y: number) => void;
}) {
  return (
    <View style={styles.road}>
      {state.zones.map((zone, index) => (
        <ZoneSegment
          key={zone.zoneId}
          zone={zone}
          next={state.zones[index + 1]}
          leagues={state.leagues}
          here={zone.zoneId === waymarkerZone(state)}
          selected={zone.zoneId === selected}
          onSelect={onSelect}
          onFace={onFace}
          onLayout={onZoneLayout}
        />
      ))}
    </View>
  );
}

/**
 * Which segment the Waymarker stands in: the furthest **unlocked** zone it has reached.
 *
 * ↯ Unlocked, not merely reached. A player can walk past Cerberus's threshold without beating him
 * and keep earning Leagues (GDD 9 §3's dual gate), and their Waymarker stays in Olympion — putting
 * it in a zone they cannot enter is the map contradicting the wall in front of them.
 */
export function waymarkerZone(state: RoadState): string | null {
  const reached = state.zones.filter(
    (zone) => zone.unlocked && state.leagues >= zone.entryThresholdLeagues,
  );

  return reached[reached.length - 1]?.zoneId ?? null;
}

function ZoneSegment({
  zone,
  next,
  leagues,
  here,
  selected,
  onSelect,
  onFace,
  onLayout,
}: {
  zone: RoadZone;
  next: RoadZone | undefined;
  leagues: number;
  here: boolean;
  selected: boolean;
  onSelect?: (zoneId: string) => void;
  onFace?: (gate: RoadGate) => void;
  onLayout?: (zoneId: string, y: number) => void;
}) {
  const fill = segmentFill(zone, next, leagues);
  const selectable = zone.unlocked && onSelect !== undefined;

  return (
    <Pressable
      accessibilityRole={selectable ? 'radio' : undefined}
      accessibilityState={selectable ? { checked: selected } : undefined}
      disabled={!selectable}
      onPress={() => onSelect?.(zone.zoneId)}
      style={[styles.segment, zone.unlocked ? null : styles.segmentLocked, selected && styles.segmentSelected]}
      onLayout={(event) => onLayout?.(zone.zoneId, event.nativeEvent.layout.y)}
    >
      <View style={styles.bannerRow}>
        <View style={styles.bannerName}>
          {/* The dot says the card can be picked, before any tap; a locked zone has none. */}
          {selectable ? <Text style={[styles.radio, selected && styles.radioOn]}>{selected ? '●' : '○'}</Text> : null}
          <Text style={[styles.banner, zone.unlocked ? null : styles.dimmed]}>{zone.displayName}</Text>
        </View>

        {/*
          Locked and unreleased are different sentences and must not collapse into one grey label:
          one is a road the player will open, the other is a road that does not exist yet (§4.2).
        */}
        {zone.isReleased ? (
          zone.unlocked ? null : <Text style={styles.tag}>Locked</Text>
        ) : (
          <Text style={styles.tag}>Coming soon</Text>
        )}
      </View>

      {/*
        §4.1 — **not to literal scale.** Every segment gets the same visual length with a fill scaled
        to its own threshold range, or Olympion's 220 Leagues would be invisible beside Imperion's
        2,000 and the earliest weeks of play would look like no progress at all.
      */}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(fill * 100)}%` }]} />
        {here ? <Text style={[styles.waymarker, { left: `${Math.round(fill * 100)}%` }]}>◆</Text> : null}
      </View>

      {zone.gates.map((gate) => (
        <GateNode key={gate.gateId} gate={gate} leagues={leagues} onFace={onFace} />
      ))}
    </Pressable>
  );
}

function GateNode({
  gate,
  leagues,
  onFace,
}: {
  gate: RoadGate;
  leagues: number;
  onFace?: (gate: RoadGate) => void;
}) {
  const remaining = gate.leagueThreshold - leagues;
  const faceable = onFace !== undefined && gate.state !== 'locked';

  return (
    <View style={styles.node}>
      <Text style={[styles.glyph, stateTone[gate.state]]}>{GLYPH[gate.state]}</Text>

      <View accessible accessibilityLabel={`${gate.displayName}, ${STATE_COPY[gate.state]}`} style={styles.nodeText}>
        <Text style={[styles.nodeName, gate.state === 'locked' ? styles.dimmed : null]}>
          {gate.displayName}
        </Text>

        <Text style={styles.nodeNote}>
          {gate.state === 'locked'
            ? `${remaining.toLocaleString()} Leagues away`
            : STATE_COPY[gate.state]}
          {/*
            §4.2 — a mid-boss is a checkpoint the player walks past and a final boss is a wall, and
            the difference has to be legible *before* the fight rather than discovered at it.
          */}
          {gate.isHardGate ? ' · the road stops here' : ' · you may walk on'}
        </Text>
      </View>

      {/*
        Only the label starts the fight. The row sits inside a selectable zone card, and a tap meant
        to pick the zone must not open an unfleeable boss fight.
      */}
      {faceable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Battle ${gate.displayName}${gate.state === 'defeated' ? ' again' : ''}`}
          onPress={() => onFace?.(gate)}
          style={({ pressed }) => [styles.battle, pressed ? styles.nodePressed : null]}
        >
          <Text style={styles.face}>{gate.state === 'defeated' ? 'Battle again ›' : 'Battle ›'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const GLYPH: Record<GateState, string> = {
  locked: '○',
  available: '◈',
  defeated: '✦',
};

const STATE_COPY: Record<GateState, string> = {
  locked: 'locked',
  available: 'ready to battle',
  defeated: 'defeated',
};

/** Never colour alone — every node states its condition in words beside the glyph (WCAG 1.4.1). */
const stateTone = StyleSheet.create({
  locked: { color: colors.border },
  available: { color: colors.accent },
  defeated: { color: colors.verdigris },
});

const styles = StyleSheet.create({
  road: { gap: space.md },

  segment: {
    gap: space.sm,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  segmentLocked: { backgroundColor: colors.background },
  segmentSelected: { borderColor: colors.accent, borderWidth: 2 },

  bannerRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  bannerName: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  radio: { fontSize: 16, color: colors.textDim },
  radioOn: { color: colors.accent },
  banner: { ...type.title, color: colors.text },
  dimmed: { color: colors.textDim },
  tag: {
    ...type.small,
    color: colors.textDim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.xs,
  },

  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
  },
  fill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.accent },
  waymarker: {
    position: 'absolute',
    marginLeft: -7,
    fontSize: 14,
    color: colors.gold,
  },

  node: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: MIN_TOUCH_TARGET },
  nodePressed: { opacity: 0.7 },
  battle: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', paddingLeft: space.sm },
  face: { ...type.small, color: colors.accent, fontWeight: '600' },
  glyph: { fontSize: 18, width: 22, textAlign: 'center' },
  nodeText: { flex: 1 },
  nodeName: { ...type.body, color: colors.text },
  nodeNote: { ...type.small, ...tabular, color: colors.textDim },
});
