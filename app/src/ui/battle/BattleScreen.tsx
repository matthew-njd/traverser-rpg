import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { BattleContext, BattleEvent, BattleState } from '../../battle/state';
import type { Move } from '../../battle/types';
import { type Labels, labelFor } from '../../content/labels';
import { Button, Screen } from '../primitives';
import { colors, radius, space, tabular, type } from '../theme';
import { ActionMenu, type ItemOption } from './ActionMenu';
import { CombatLog } from './CombatLog';
import { VigorBar } from './VigorBar';
import { type Callout, calloutOf, logLines } from './log';
import { skillOptions } from './options';

/**
 * GDD 13 §6's battle screen — enemy panel, player panel, combat log, action menu, in that order.
 *
 * Presentational: it takes a state and an event list and returns a tree. Everything that decides
 * anything lives in `src/battle/`, and the store between them is T5 §9's thin adapter. That split is
 * what lets this file be tested by rendering a hand-built state rather than by fighting a battle.
 */
export function BattleScreen({
  state,
  context,
  moves,
  labels,
  events,
  items,
  chevronsUnlocked,
  resolving = false,
  onBegin,
  onMove,
  onItem,
  onFlee,
  onDone,
}: {
  state: BattleState;
  context: BattleContext;
  /**
   * What this player may pick from — Basic Attack plus their *unlocked* Skills. Deliberately not
   * derived from `context.moves`, which is the engine's lookup and holds every move in the game.
   */
  moves: readonly Move[];
  labels: Labels;
  events: readonly BattleEvent[];
  items: readonly ItemOption[];
  chevronsUnlocked: boolean;
  resolving?: boolean;
  onBegin: () => void;
  onMove: (moveId: string) => void;
  onItem: (item: ItemOption) => void;
  onFlee: () => void;
  onDone: () => void;
}) {
  const lines = useMemo(() => logLines(events, labels), [events, labels]);

  const options = useMemo(
    () =>
      skillOptions({
        moves,
        uses: state.uses,
        chart: context.content.chart,
        enemyTypeId: context.enemy.typeId,
        labels,
        chevronsUnlocked,
      }),
    [moves, context, state.uses, labels, chevronsUnlocked],
  );

  // Basic Attack is the one move with no per-battle limit (GDD 2 §5) — identified by that rather
  // than by its id, so the Attack button follows the content rather than a hardcoded key.
  const attack = options.find((option) => option.usesLeft === null);
  const skills = options.filter((option) => option !== attack);

  const callout = latestCallout(events);
  const over = state.outcome !== null;

  return (
    <Screen style={styles.screen}>
      <View style={styles.enemy}>
        <View style={styles.plate}>
          <Text style={styles.plateGlyph}>◈</Text>

          {/*
            ↯ A dark chip rather than ink straight onto the plate. On `marble` the only palette
            colour that clears 4.5:1 is `oxblood` — `gold` sits at 1.5:1 and `madder` at 3.0:1 — so
            a two-tone callout is unreadable there and a one-tone one cannot say which it is. On the
            chip's own ground both clear AA (9.9:1 and 5.0:1) and match the chevron the player just
            read in the Skill menu.
          */}
          {callout === null ? null : (
            <View style={styles.calloutChip}>
              <Text accessibilityRole="alert" style={[styles.callout, calloutTone[callout.tone]]}>
                {callout.text}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.nameRow}>
          <Text style={styles.enemyName}>{labelFor(labels, state.enemyId)}</Text>
          {context.enemy.typeId === null ? null : (
            <Text style={styles.typeTag}>{labelFor(labels, context.enemy.typeId)}</Text>
          )}
        </View>

        <VigorBar side="enemy" vigor={state.enemy.vigor} vigorMax={state.enemy.vigorMax} />
      </View>

      <View style={styles.player}>
        <Text style={styles.roundLabel}>Round {state.round}</Text>
        <VigorBar side="player" vigor={state.player.vigor} vigorMax={state.player.vigorMax} />
      </View>

      <CombatLog lines={lines} />

      {state.phase === 'enemy_intro' ? (
        <Button label="Begin" onPress={onBegin} />
      ) : over ? (
        <View style={styles.outcome}>
          <Text style={styles.outcomeLabel}>{OUTCOME_COPY[state.outcome ?? 'flee']}</Text>
          <Button label="Continue" onPress={onDone} />
        </View>
      ) : attack === undefined ? null : (
        <ActionMenu
          attack={attack}
          skills={skills}
          items={items}
          skillsEnabled={state.rules.skillsEnabled}
          itemsEnabled={state.rules.itemsEnabled}
          fleeable={state.rules.fleeable}
          skillLockedNote="Skills unlock at Level 4."
          fleeLockedNote="You can't flee this fight — it's perfectly safe."
          disabled={resolving}
          onAttack={onMove}
          onSkill={onMove}
          onItem={onItem}
          onFlee={onFlee}
        />
      )}
    </Screen>
  );
}

/** The chevron's tones, on the chip's dark ground. One vocabulary across both surfaces (§6.2). */
const calloutTone = StyleSheet.create({
  strong: { color: colors.gold },
  neutral: { color: colors.text },
  weak: { color: colors.madder },
});

const OUTCOME_COPY = {
  win: 'The road remembers this.',
  loss: 'You are turned back — but not for long.',
  flee: 'You withdraw. The road keeps.',
} as const;

/** The callout belongs to the most recent hit and nothing older (GDD 13 §6.2). */
function latestCallout(events: readonly BattleEvent[]): Callout | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];

    if (event?.type === 'damage_dealt') {
      return event.target === 'enemy' ? calloutOf(event.typeMultiplier) : null;
    }
  }

  return null;
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'space-between' },

  enemy: { gap: space.sm },
  // GDD 13 §11's art rule: an inked silhouette on a cream plate. The glyph is the placeholder the
  // real sprite replaces (tech-04 §9.3) — the plate is what makes the swap cosmetic.
  plate: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.marble,
    borderRadius: radius.md,
  },
  plateGlyph: { fontSize: 84, color: colors.background },
  calloutChip: {
    position: 'absolute',
    bottom: space.sm,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  callout: { ...type.heading, fontWeight: '700' },

  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  enemyName: { ...type.title, color: colors.text },
  typeTag: {
    ...type.small,
    color: colors.textDim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.xs,
  },

  player: { gap: space.xs },
  roundLabel: { ...type.small, ...tabular, color: colors.textDim },

  outcome: { gap: space.sm },
  outcomeLabel: { ...type.heading, color: colors.text, textAlign: 'center' },
});
