import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { PLACEHOLDER_SPRITES, SPRITES } from '../assets/registry.generated';
import type { ZoneArtKey } from '../assets/keys.generated';
import { playSfx, playSting, stopSfx } from '../audio/bus';
import type { GateState, RoadGate, RoadState, RoadZone } from '../progression/road';
import { segmentFill } from '../progression/road';
import type { AvatarFigure } from '../sync/dto';
import { Sprite } from './Sprite';
import { figureKey } from './TraverserSprite';
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
  figure = 'male',
  walk = null,
  selected = null,
  onSelect,
  onFace,
  onZoneLayout,
}: {
  state: RoadState;
  figure?: AvatarFigure;
  /** GDD 9 §5 — the stretch of the Waymarker's segment to walk on arrival, from `walkSpan`. */
  walk?: Walk | null;
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
          figure={figure}
          walk={walk}
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
  figure,
  walk,
  selected,
  onSelect,
  onFace,
  onLayout,
}: {
  zone: RoadZone;
  next: RoadZone | undefined;
  leagues: number;
  here: boolean;
  figure: AvatarFigure;
  walk: Walk | null;
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
      <Banner zoneId={zone.zoneId} dim={!zone.unlocked} />

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
      {here ? (
        <Walker fill={fill} walk={walk} figure={figure} />
      ) : (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(fill * 100)}%` }]} />
        </View>
      )}

      {zone.gates.map((gate) => (
        <GateNode key={gate.gateId} gate={gate} leagues={leagues} onFace={onFace} />
      ))}
    </Pressable>
  );
}

/** GDD 9 §6's zone identity, across the top of its card; dimmed while the zone is locked. */
function Banner({ zoneId, dim }: { zoneId: string; dim: boolean }) {
  const key = `zone_${zoneId}`;

  if (!(key in SPRITES) || PLACEHOLDER_SPRITES.has(key as ZoneArtKey)) {
    return null;
  }

  return (
    <View importantForAccessibility="no-hide-descendants" style={[styles.art, dim && styles.artDim]}>
      <Image source={SPRITES[key as ZoneArtKey]} style={styles.artImage} resizeMode="contain" />
    </View>
  );
}

type Walk = { readonly from: number; readonly to: number };

/** Long enough to read as a walk, short enough not to hold the Map hostage. */
const walkMs = (walk: Walk) => Math.min(600 + 3000 * (walk.to - walk.from), 2500);

/**
 * The Waymarker's segment: the figure stands on the fill's leading edge, and on arrival walks it
 * forward to the footstep loop, then GDD 14 §3.8's chime. Reduced motion skips the walk, not the chime.
 */
function Walker({ fill, walk, figure }: { fill: number; walk: Walk | null; figure: AvatarFigure }) {
  const progress = useRef(new Animated.Value(walk?.from ?? fill)).current;

  useEffect(() => {
    if (walk === null) {
      progress.setValue(fill);

      return;
    }

    let live = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!live) {
        return;
      }

      if (reduced) {
        progress.setValue(walk.to);
        playSting('stg_waymarker');

        return;
      }

      playSfx('sfx_footstep_loop', true);

      // ↯ Not the native driver: it animates only transform and opacity, never a width or a `left`.
      Animated.timing(progress, {
        toValue: walk.to,
        duration: walkMs(walk),
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }).start(({ finished }) => {
        stopSfx('sfx_footstep_loop');

        if (finished) {
          playSting('stg_waymarker');
        }
      });
    });

    return () => {
      live = false;
      progress.stopAnimation();
      stopSfx('sfx_footstep_loop');
    };
  }, [walk, fill, progress]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.walker}>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width }]} />
      </View>
      <Animated.View testID="waymarker" style={[styles.waymarker, { left: width }]}>
        <Sprite subject={figureKey(figure)} size={WAYMARKER_SIZE - 6} glyph="◆" />
      </Animated.View>
    </View>
  );
}

const WAYMARKER_SIZE = 36;

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
  art: { backgroundColor: colors.marble, borderRadius: radius.sm, overflow: 'hidden' },
  artDim: { opacity: 0.4 },
  artImage: { width: '100%', height: undefined, aspectRatio: 4 },
  walker: { height: WAYMARKER_SIZE, justifyContent: 'center' },
  // GDD 13 §11.4: ink needs its marble plate, and the zone card is dark.
  waymarker: {
    position: 'absolute',
    top: 0,
    width: WAYMARKER_SIZE,
    height: WAYMARKER_SIZE,
    marginLeft: -WAYMARKER_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: WAYMARKER_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: colors.marble,
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
