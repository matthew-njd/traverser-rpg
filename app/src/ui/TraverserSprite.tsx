import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { PLACEHOLDER_SPRITES } from '../assets/registry.generated';
import type { OwnedGear } from '../battle/mirror';
import { type Labels, labelFor } from '../content/labels';
import { playSfx } from '../audio/bus';
import { AVATAR_FIGURES, type AvatarFigure } from '../sync/dto';
import { GRADE_BORDER } from './RevealCard';
import { Sprite } from './Sprite';
import { colors, radius, space, type } from './theme';

const SLOTS = ['weapon', 'armor', 'accessory', 'trinket'] as const;

/** Not derived from the IDs: the IDs are American (`armor`) and the copy is Canadian. */
const SLOT_NAMES: Record<(typeof SLOTS)[number], string> = {
  weapon: 'Weapon',
  armor: 'Armour',
  accessory: 'Accessory',
  trinket: 'Trinket',
};

const CORNERS: Record<(typeof SLOTS)[number], ViewStyle> = {
  weapon: { top: space.sm, left: space.sm },
  armor: { top: space.sm, right: space.sm },
  accessory: { bottom: space.sm, left: space.sm },
  trinket: { bottom: space.sm, right: space.sm },
};

const SLOT_SIZE = 64;

/** The figures a player can choose: those whose art has landed. */
export const availableFigures = () =>
  AVATAR_FIGURES.filter((figure) => !PLACEHOLDER_SPRITES.has(`avatar_traverser_${figure}`));

const FIGURE_NAMES: Record<AvatarFigure, string> = { male: 'Male', female: 'Female' };

/** Onboarding Screen 4 and Settings. Callers show it only when {@link availableFigures} offers a choice. */
export function FigurePicker({ value, onChange }: { value: AvatarFigure; onChange: (figure: AvatarFigure) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={styles.choices}>
      {availableFigures().map((figure) => (
        <Pressable
          key={figure}
          accessibilityRole="radio"
          accessibilityState={{ checked: figure === value }}
          accessibilityLabel={`${FIGURE_NAMES[figure]} figure`}
          onPress={() => {
            if (figure !== value) {
              playSfx('sfx_toggle');
              onChange(figure);
            }
          }}
          style={[styles.choice, figure === value && styles.chosen]}
        >
          <View style={styles.choicePlate}>
            <Sprite subject={figureKey(figure)} size={96} glyph="ᛝ" />
          </View>
          <Text style={styles.choiceName}>{FIGURE_NAMES[figure]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** A figure whose art has not landed falls back to the male one rather than to a glyph. */
export function figureKey(figure: AvatarFigure) {
  const key = `avatar_traverser_${figure}` as const;

  return PLACEHOLDER_SPRITES.has(key) ? 'avatar_traverser_male' : key;
}

/**
 * GDD 13 §3.1 (amended 2026-10-29) — the Traverser on a marble plate, with each slot's piece in a
 * corner, bordered in its tier's rank colour. An empty slot is dashed and names itself.
 */
export function TraverserSprite({
  figure,
  worn,
  labels,
}: {
  figure: AvatarFigure;
  /** Equipped pieces only. */
  worn: readonly OwnedGear[];
  labels: Labels;
}) {
  const pieces = SLOTS.map((slot) => ({ slot, piece: worn.find((each) => each.slot === slot) }));
  const wearing = pieces.flatMap(({ piece }) => (piece === undefined ? [] : [labelFor(labels, piece.gearDefId)]));

  return (
    <View
      accessible
      accessibilityLabel={wearing.length === 0 ? 'Your Traverser, wearing nothing yet' : `Your Traverser, wearing ${wearing.join(', ')}`}
      style={styles.plate}
    >
      <Sprite subject={figureKey(figure)} size={240} glyph="ᛝ" />

      {pieces.map(({ slot, piece }) => (
        <View
          key={slot}
          style={[
            styles.slot,
            CORNERS[slot],
            piece === undefined ? styles.empty : { borderColor: GRADE_BORDER[piece.tier] ?? colors.border },
          ]}
        >
          {piece === undefined ? (
            <Text style={styles.emptyName}>{SLOT_NAMES[slot]}</Text>
          ) : (
            <Sprite subject={piece.gearDefId} size={SLOT_SIZE - space.md} glyph="◆" />
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    flex: 1,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.marble,
    borderRadius: radius.md,
  },
  slot: {
    position: 'absolute',
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.marble,
    borderRadius: radius.md,
    borderWidth: 3,
  },
  empty: { borderStyle: 'dashed', borderColor: colors.textDim },
  emptyName: { ...type.small, fontSize: 11, color: colors.surfaceRaised },

  choices: { flexDirection: 'row', gap: space.md },
  choice: {
    flex: 1,
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  chosen: { borderColor: colors.accent },
  choicePlate: { alignSelf: 'stretch', alignItems: 'center', backgroundColor: colors.marble, borderRadius: radius.sm },
  choiceName: { ...type.body, color: colors.text },
});
