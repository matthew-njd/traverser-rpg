import { useEffect } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { playSting } from '../audio/bus';
import { revealSting, rewardRevealTier } from '../audio/cues';

import type { FreshReward } from '../battle/mirror';
import { type Labels, type RevealDetail, labelFor } from '../content/labels';
import type { LevelUp } from '../sync/dto';
import { Button, Heading } from './primitives';
import { RevealCard } from './RevealCard';
import { colors, radius, space, tabular, type } from './theme';

/** Why the reward arrived, in the player's words. Keyed by `player_*.source`. */
const SOURCES: Readonly<Record<string, string>> = {
  daily_goal: 'Found along the road',
  level_milestone: 'Level milestone',
  streak_milestone: 'Streak milestone',
  streak_overflow: 'Streak milestone',
  zone_entry: 'A new realm',
};

/**
 * GDD 13 §6.3 — the sync's level-ups and step 10's rewards, shown once over whatever tab is open.
 * A daily-goal item is not shown here: it is a road find, highlighted in Items instead (§5.2).
 */
export function RewardReveal({
  levelUps = [],
  rewards,
  labels,
  details,
  onDone,
}: {
  levelUps?: readonly LevelUp[];
  rewards: readonly FreshReward[];
  labels: Labels;
  details: ReadonlyMap<string, RevealDetail>;
  onDone: () => void;
}) {
  const visible = levelUps.length + rewards.length > 0;

  // GDD 14 §3.5 — one sting for the sheet, at the tier of its most significant card.
  useEffect(() => {
    if (visible) {
      const tier = rewardRevealTier(
        levelUps.map((up) => up.level),
        rewards.map((reward) => ({ source: reward.source, grade: details.get(reward.defId)?.grade ?? '' })),
      );

      playSting(revealSting(tier));
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDone}
    >
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <Heading>
            {levelUps.length > 0
              ? 'Level up'
              : rewards.length === 1
                ? 'A reward'
                : `${rewards.length} rewards`}
          </Heading>

          <ScrollView contentContainerStyle={styles.list}>
            {levelUps.map((up) => (
              <View key={`level-${up.level}`} style={styles.level}>
                <Text style={styles.levelName}>Level {up.level}</Text>
                <Text style={styles.levelNote}>
                  {up.statPointsAwarded} stat {up.statPointsAwarded === 1 ? 'point' : 'points'} to spend
                </Text>
              </View>
            ))}

            {rewards.map((reward) => (
              <View key={reward.id} style={styles.entry}>
                <Text style={styles.source}>{SOURCES[reward.source] ?? reward.source}</Text>
                <RevealCard
                  subject={reward.defId}
                  name={labelFor(labels, reward.defId)}
                  grade={details.get(reward.defId)?.grade ?? ''}
                  flavor={details.get(reward.defId)?.flavor}
                />
              </View>
            ))}
          </ScrollView>

          <Button label="Continue" onPress={onDone} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'center', padding: space.md, backgroundColor: `${colors.background}D9` },
  sheet: {
    maxHeight: '85%',
    gap: space.md,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  list: { gap: space.md },
  entry: { gap: space.xs },
  source: { ...type.small, color: colors.textDim },
  level: {
    gap: space.xs,
    padding: space.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  levelName: { ...type.heading, ...tabular, color: colors.gold },
  levelNote: { ...type.small, ...tabular, color: colors.textDim },
});
