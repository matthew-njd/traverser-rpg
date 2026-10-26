import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { BattleContext, BattleEvent, BattleState } from '../../battle/state';
import type { Move } from '../../battle/types';
import { type Labels, labelFor } from '../../content/labels';
import type { BattleLore } from '../../content/lore';
import { Button, Screen } from '../primitives';
import { RevealCard } from '../RevealCard';
import { TapThrough } from '../TapThrough';
import type { Reveal } from './reveal';
import { colors, radius, space, tabular, type } from '../theme';
import { ActionMenu, type ItemOption } from './ActionMenu';
import { CombatLog } from './CombatLog';
import { VigorBar } from './VigorBar';
import { type Callout, calloutOf, logEntries, shownVigor } from './log';
import { ACTOR_CHANGE_DELAY_MS, LINE_DELAY_MS, usePacedLines } from './paced';
import { skillOptions, slotsFor } from './options';

/**
 * GDD 13 §6's battle screen — enemy panel, player panel, combat log, action menu, in that order.
 *
 * Presentational: it takes a state and an event list and returns a tree. Everything that decides
 * anything lives in `src/battle/`, and the store between them is T5 §9's thin adapter. That split is
 * what lets this file be tested by rendering a hand-built state rather than by fighting a battle.
 */
export interface BattleScript {
  /** The beat for the round the player is about to act in, or null once the fight is over. */
  readonly beat: { note: string | null; prompt: string; attackEnabled: boolean } | null;
  readonly attackLockedNote?: string;
  readonly skillLockedNote?: string;
  readonly fleeLockedNote?: string;
}

/**
 * Outside the tutorial these two are the honest general cases: Skills unlock with levels (GDD 2 §5)
 * and the six bosses are the only unfleeable fights (GDD 2 §9).
 */
export const DEFAULT_SKILL_LOCKED = 'No Skills unlocked yet — they arrive as you level.';
const DEFAULT_FLEE_LOCKED = 'There is no leaving this one.';

export function BattleScreen({
  state,
  context,
  moves,
  labels,
  events,
  items,
  reveals = [],
  traverserName,
  chevronsUnlocked,
  script = null,
  lore = NO_LORE,
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
  /** GDD 13 §6.1 — the player panel names its Traverser, as the enemy panel names the enemy. */
  traverserName: string;
  /** GDD 13 §6.3 — what this fight dropped, already joined to its content. Empty for a loss. */
  reveals?: readonly Reveal[];
  chevronsUnlocked: boolean;
  /**
   * GDD 10 §6.4's guided copy, and the actions it withholds. Null for every ordinary battle — the
   * tutorial is a *configured instance* of this screen, not a second one (M2 plan §3.4).
   */
  script?: BattleScript | null;
  /** GDD 12's beats for this fight. None for the tutorial. */
  lore?: BattleLore;
  resolving?: boolean;
  onBegin: () => void;
  onMove: (moveId: string) => void;
  onItem: (item: ItemOption) => void;
  onFlee: () => void;
  onDone: () => void;
}) {
  const entries = useMemo(() => logEntries(events, labels), [events, labels]);
  const lines = useMemo(() => entries.map((entry) => entry.text), [entries]);

  // GDD 13 §6 pacing — one line at a time, and a longer beat where the other side replies within
  // the same round. Not at a round's first line: that one answers the tap, and a pause there reads
  // as the gap between rounds (DECISIONS 2026-10-25).
  const paced = usePacedLines(lines, (index) => {
    const line = entries[index];
    const before = entries[index - 1];

    return line !== undefined && before !== undefined && line.round === before.round && line.actor !== before.actor
      ? ACTOR_CHANGE_DELAY_MS
      : LINE_DELAY_MS;
  });
  const enemyName = labelFor(labels, state.enemyId);
  // The bars follow the log, not the engine: a hit drains its bar when its line appears.
  const hidden = entries.slice(paced.length);
  const catchingUp = paced.length < lines.length;

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

  // Four slots, filled or not (GDD 3 §2.4). Enemy level equals the player’s at encounter time.
  const slots = useMemo(
    () => slotsFor(skills, context.content.skills, state.enemyLevel),
    [skills, context.content.skills, state.enemyLevel],
  );

  const callout = latestCallout(events);
  // The engine ends the fight with the final turn's events, but the player has not seen them yet: the
  // outcome waits for the log, and until then the menu stays, closed to input.
  const over = state.outcome !== null && !catchingUp;
  const beat = script?.beat ?? null;

  // Session state, not the snapshot: a fight resumed after the app died shows its beat again.
  const [opened, setOpened] = useState(lore.opening.length === 0);
  const [closed, setClosed] = useState(lore.defeat.length === 0);
  const [walked, setWalked] = useState(lore.narrative.length === 0);
  const won = over && state.outcome === 'win';

  // GDD 12 §2: the next zone's screens follow the defeat text, before the victory panel.
  if (won && closed && !walked) {
    return (
      <Screen>
        <TapThrough lines={lore.narrative} onDone={() => setWalked(true)} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.enemy}>
        <View style={styles.plate}>
          <Text style={styles.plateGlyph}>◈</Text>

          {/*
            ↯ A dark chip rather than ink straight onto the plate. On `marble` the only palette
            colour that clears 4.5:1 is `oxblood` — `verdigris` sits at 3.2:1 and `madder` at 3.0:1 — so
            a two-tone callout is unreadable there and a one-tone one cannot say which it is. On the
            chip's own ground both clear AA (4.7:1 and 5.0:1) and match the chevron the player just
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

        <VigorBar
          side="enemy"
          vigor={shownVigor(hidden, 'enemy', state.enemy.vigor)}
          vigorMax={state.enemy.vigorMax}
        />
      </View>

      <View style={styles.player}>
        {/*
          The player’s own name, mirroring the enemy’s above it — the slot held the round number and
          read as a label for the bar beneath (M2 drill note 1.5). The round moved to the log’s
          header, where a counter belongs.
        */}
        <Text style={styles.playerName}>{traverserName}</Text>
        <VigorBar
          side="player"
          vigor={shownVigor(hidden, 'player', state.player.vigor)}
          vigorMax={state.player.vigorMax}
        />
      </View>

      <View style={styles.logHeader}>
        <Text style={styles.roundLabel}>
          Round {state.round}
          {state.phase === 'await_player' ? ` · ${orderNote(state, enemyName)}` : null}
        </Text>
      </View>

      <CombatLog lines={entries.slice(0, paced.length)} enemyName={enemyName} />

      {/* The guided band. Note first, then what to do — the order the player earned them in. */}
      {beat === null ? null : (
        <View style={styles.guide}>
          {beat.note === null ? null : <Text style={styles.guideNote}>{beat.note}</Text>}
          <Text accessibilityRole="alert" style={styles.guidePrompt}>
            {beat.prompt}
          </Text>
        </View>
      )}

      {state.phase === 'enemy_intro' && !opened ? (
        <Dialogue lines={lore.opening} onDone={() => setOpened(true)} />
      ) : state.phase === 'enemy_intro' ? (
        <Button label="Begin" onPress={onBegin} />
      ) : won && !closed ? (
        <Dialogue lines={lore.defeat} onDone={() => setClosed(true)} />
      ) : over ? (
        <View style={styles.outcome}>
          <Text style={styles.outcomeLabel}>{OUTCOME_COPY[state.outcome ?? 'flee']}</Text>

          {/*
            One Continue for the whole reveal, per §6.3 — not one tap per card. The cards scroll and
            Continue stays put: a boss's three drops ran off the bottom of a plain View.
          */}
          <ScrollView style={styles.reveals} contentContainerStyle={styles.revealList}>
            {reveals.map((reveal) => (
              <RevealCard
                key={reveal.defId}
                name={reveal.name}
                grade={reveal.grade}
                flavor={reveal.flavor}
              />
            ))}
          </ScrollView>

          <Button label="Continue" onPress={onDone} />
        </View>
      ) : attack === undefined ? null : (
        <ActionMenu
          attack={attack}
          slots={slots}
          items={items}
          attackEnabled={beat === null ? true : beat.attackEnabled}
          skillsEnabled={state.rules.skillsEnabled}
          itemsEnabled={state.rules.itemsEnabled}
          fleeable={state.rules.fleeable}
          attackLockedNote={script?.attackLockedNote}
          skillLockedNote={script?.skillLockedNote ?? DEFAULT_SKILL_LOCKED}
          fleeLockedNote={script?.fleeLockedNote ?? DEFAULT_FLEE_LOCKED}
          // Closed to input until the log has caught up: the next turn must not start before the
          // player has been able to read the one that just happened (M2 drill note 1.11).
          disabled={resolving || catchingUp}
          onAttack={onMove}
          onSkill={onMove}
          onItem={onItem}
          onFlee={onFlee}
        />
      )}
    </Screen>
  );
}

const NO_LORE: BattleLore = { opening: [], defeat: [], narrative: [] };

/** GDD 13 §6.4's dialogue box: one beat's lines together, one tap to continue. */
function Dialogue({ lines, onDone }: { lines: readonly string[]; onDone: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onDone} style={styles.dialogue}>
      {lines.map((line) => (
        <Text key={line} style={styles.dialogueLine}>
          {line}
        </Text>
      ))}
      <Text style={styles.dialogueHint}>Tap to continue</Text>
    </Pressable>
  );
}

/** The chevron's tones, on the chip's dark ground. One vocabulary across both surfaces (§6.2). */
const calloutTone = StyleSheet.create({
  strong: { color: colors.verdigris },
  neutral: { color: colors.text },
  weak: { color: colors.madder },
});

const OUTCOME_COPY = {
  win: 'The road remembers this.',
  loss: 'You are turned back — but not for long.',
  flee: 'You withdraw. The road keeps.',
} as const;

/** Who strikes first this round, and why, said before the player chooses (GDD 2 §4). */
function orderNote(state: BattleState, enemyName: string): string {
  if (state.first === 'player') {
    return state.firstReason === 'swift'
      ? 'Swift: you strike first'
      : state.firstReason === 'tie_roll'
        ? 'You win the tie and strike first'
        : 'You are faster and strike first';
  }

  return state.firstReason === 'tie_roll'
    ? `${enemyName} wins the tie and strikes first`
    : `${enemyName} is faster and strikes first`;
}

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
  playerName: { ...type.body, color: colors.text },
  logHeader: { paddingHorizontal: space.xs },
  roundLabel: { ...type.small, ...tabular, color: colors.textDim },

  guide: { gap: space.xs, paddingHorizontal: space.xs },
  guideNote: { ...type.small, color: colors.textDim },
  guidePrompt: { ...type.body, color: colors.gold },

  outcome: { gap: space.sm, flexShrink: 1 },
  // ↯ RN's ScrollView defaults to `flexGrow: 1`, which takes the whole column and pushes Continue off.
  reveals: { flexGrow: 0, flexShrink: 1 },
  // No flexShrink here: a content container that shrinks to the viewport has nothing left to scroll.
  revealList: { gap: space.sm },
  outcomeLabel: { ...type.heading, color: colors.text, textAlign: 'center' },

  dialogue: {
    gap: space.sm,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dialogueLine: { ...type.body, color: colors.text, fontStyle: 'italic', lineHeight: 22 },
  dialogueHint: { ...type.small, color: colors.textDim, textAlign: 'right' },
});
