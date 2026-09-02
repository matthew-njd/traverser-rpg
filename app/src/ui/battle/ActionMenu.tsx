import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET, colors, radius, space, tabular, type } from '../theme';
import type { Chevron } from './log';
import type { Slot } from './options';

/**
 * GDD 13 §6.1's action menu (amended 2026-08-22): **Attack at the centre, four skill slots around
 * it, Items and Flee beneath** — seven targets, every one at a permanently fixed location.
 * `docs/mockups/battle-action-layout.png`.
 *
 * The layout it replaces had four buttons and a Skill submenu. §6.1 tied that order to
 * menu-scanning time, and this serves the same reason better: a skill costs **one tap instead of
 * two**, and the four slots are visible whether or not they hold anything, so the player learns the
 * shape of their loadout before they own it.
 *
 * ↯ **48dp and the overlapping circle are what decide the geometry.** The circle is absolutely
 * positioned over the centre of the grid, so the grid keeps its own row heights and the circle
 * cannot shrink a slot below the floor by sitting in it.
 */

export interface SkillOption {
  readonly moveId: string;
  readonly label: string;
  /** Null for Basic Attack, which has no per-battle limit. */
  readonly usesLeft: number | null;
  /**
   * §6.2's pre-selection hint. Null when there is nothing honest to show: a Physical move, a
   * typeless enemy, or an enemy this player has not fought before.
   */
  readonly chevron: Chevron | null;
}

export interface ItemOption {
  readonly playerItemId: string;
  readonly itemDefId: string;
  readonly label: string;
}

/** The Items list is the one menu left — it is a variable-length inventory, not a fixed loadout. */
export type PendingMenu = 'item' | null;

export function ActionMenu({
  attack,
  slots,
  items,
  attackEnabled = true,
  skillsEnabled,
  itemsEnabled,
  fleeable,
  attackLockedNote,
  skillLockedNote,
  fleeLockedNote,
  disabled = false,
  onAttack,
  onSkill,
  onItem,
  onFlee,
}: {
  attack: SkillOption;
  /** Always four (GDD 3 §2.4), filled or not. */
  slots: readonly Slot[];
  items: readonly ItemOption[];
  /** False only while a script withholds it (GDD 10 §6.4). Ordinary battles never set this. */
  attackEnabled?: boolean;
  skillsEnabled: boolean;
  itemsEnabled: boolean;
  fleeable: boolean;
  attackLockedNote?: string;
  skillLockedNote: string;
  fleeLockedNote: string;
  /** True while a turn is resolving — the whole menu, not each button (GDD 4 §3). */
  disabled?: boolean;
  onAttack: (moveId: string) => void;
  onSkill: (moveId: string) => void;
  onItem: (item: ItemOption) => void;
  onFlee: () => void;
}) {
  const [open, setOpen] = useState<PendingMenu>(null);
  const [note, setNote] = useState<string | null>(null);

  const locked = (message: string) => {
    setOpen(null);
    setNote(message);
  };

  const act = (run: () => void) => {
    setOpen(null);
    setNote(null);
    run();
  };

  const slotProps = { disabled, skillsEnabled, skillLockedNote, onSkill, act, locked, setNote };

  return (
    <View style={styles.wrapper}>
      {/*
        §6.4's inline hint, and the only one this layout has: a note about the control just tapped.
        The four overlay tooltips are a different component and land with boss dialogue (M4+).
      */}
      {note === null ? null : (
        <Text accessibilityRole="alert" style={styles.note}>
          {note}
        </Text>
      )}

      {open === 'item' ? (
        <View accessibilityLabel="Items" style={styles.submenu}>
          {items.length === 0 ? (
            <Text style={styles.empty}>Your satchel is empty.</Text>
          ) : (
            <ScrollView style={styles.submenuScroll}>
              {items.map((item) => (
                <ItemRow
                  key={item.playerItemId}
                  label={item.label}
                  disabled={disabled}
                  onPress={() => act(() => onItem(item))}
                />
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}

      <View style={styles.grid}>
        <View style={styles.gridRow}>
          <SkillSlot slot={slots[0]} side="left" {...slotProps} />
          <SkillSlot slot={slots[1]} side="right" {...slotProps} />
        </View>

        <View style={styles.gridRow}>
          <SkillSlot slot={slots[2]} side="left" {...slotProps} />
          <SkillSlot slot={slots[3]} side="right" {...slotProps} />
        </View>

        {/*
          ↯ Absolutely positioned, with `pointerEvents="box-none"` on the wrapper so the circle takes
          its own taps and the gap it sits in belongs to nobody. Laying it out in flow instead would
          divide the row's width three ways and pull both slots under the 48dp floor on a narrow
          phone — the constraint decides the geometry, not the sketch's proportions.
        */}
        <View pointerEvents="box-none" style={styles.centre}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: disabled || !attackEnabled }}
            disabled={disabled}
            onPress={() =>
              attackEnabled
                ? act(() => onAttack(attack.moveId))
                : locked(attackLockedNote ?? 'Not this round.')
            }
            style={({ pressed }) => [
              styles.attack,
              pressed && styles.pressed,
              (disabled || !attackEnabled) && styles.off,
            ]}
          >
            <Text style={styles.attackLabel}>Attack</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.bars}>
        <Bar
          label="Items"
          selected={open === 'item'}
          dimmed={!itemsEnabled}
          disabled={disabled}
          onPress={() => {
            if (!itemsEnabled) {
              locked('Items are sealed in this fight.');

              return;
            }

            setNote(null);
            setOpen((current) => (current === 'item' ? null : 'item'));
          }}
        />
        <Bar
          label="Flee"
          dimmed={!fleeable}
          disabled={disabled}
          onPress={() => (fleeable ? act(onFlee) : locked(fleeLockedNote))}
        />
      </View>
    </View>
  );
}

/**
 * One quadrant. A filled slot carries what the submenu rows used to: the name, §6.2's chevron, and
 * the uses left.
 *
 * ↯ **Three disabled states that must not look alike.** Spent shows `0 left`; locked shows the
 * level that fills it; a resolving turn dims everything and explains nothing. Only the first two
 * take a tap — the note is how a slot says why it cannot be used (§6.1, §6.4).
 */
function SkillSlot({
  slot,
  side,
  disabled,
  skillsEnabled,
  skillLockedNote,
  onSkill,
  act,
  locked,
  setNote,
}: {
  slot: Slot | undefined;
  side: 'left' | 'right';
  disabled: boolean;
  skillsEnabled: boolean;
  skillLockedNote: string;
  onSkill: (moveId: string) => void;
  act: (run: () => void) => void;
  locked: (message: string) => void;
  setNote: (message: string) => void;
}) {
  const shape = [styles.slot, side === 'left' ? styles.slotLeft : styles.slotRight];

  // Fewer than four skills exist in the whole game only below the content's fourth unlock, so this
  // is the shape of a slot nothing will ever fill rather than one waiting for a level.
  if (slot === undefined) {
    return <View style={[...shape, styles.slotBlank]} />;
  }

  if (slot.kind === 'locked') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Skill slot, locked until level ${slot.unlockLevel}`}
        accessibilityState={{ disabled: true }}
        disabled={disabled}
        onPress={() => locked(skillLockedNote)}
        style={({ pressed }) => [...shape, styles.off, pressed && styles.pressed]}
      >
        <Text style={styles.slotLocked}>Lv {slot.unlockLevel}</Text>
      </Pressable>
    );
  }

  const { skill } = slot;
  const chevron = skill.chevron;
  const spent = skill.usesLeft === 0;
  const usable = skillsEnabled && !spent;

  return (
    <Pressable
      accessibilityRole="button"
      // Named with its budget, because the two are one fact to a player who cannot see the slot.
      accessibilityLabel={
        skill.usesLeft === null ? skill.label : `${skill.label}, ${skill.usesLeft} left`
      }
      accessibilityState={{ disabled: disabled || !usable }}
      accessibilityHint={chevron?.description}
      disabled={disabled}
      onPress={() =>
        usable
          ? act(() => onSkill(skill.moveId))
          : locked(spent ? `${skill.label} is spent for this fight.` : skillLockedNote)
      }
      // §6.2's direction disambiguation. The chevron says how the match goes and not which way round
      // it runs, and GDD 6 and 7 flag three times that Sea and Wisdom reverse depending on who
      // attacks — so the long press is where the pair is spelled out rather than a nicety.
      onLongPress={chevron === null ? undefined : () => setNote(chevron.description)}
      style={({ pressed }) => [...shape, pressed && styles.pressed, !usable && styles.off]}
    >
      <Text numberOfLines={1} style={styles.slotLabel}>
        {skill.label}
      </Text>

      <View style={styles.slotMeta}>
        {chevron === null ? null : (
          <Text
            accessibilityLabel={chevron.description}
            style={[styles.chevron, toneStyles[chevron.tone]]}
          >
            {chevron.glyph}
          </Text>
        )}

        {skill.usesLeft === null ? null : <Text style={styles.uses}>{skill.usesLeft} left</Text>}
      </View>
    </Pressable>
  );
}

function ItemRow({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.off]}
    >
      <Text style={styles.rowLabel}>{label}</Text>
    </Pressable>
  );
}

function Bar({
  label,
  onPress,
  disabled,
  dimmed = false,
  selected = false,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  dimmed?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      // ↯ `dimmed` is deliberately not `disabled`: a locked action must still take the tap, or the
      // note that explains why it is locked can never fire (GDD 10 §6.4). Only a resolving turn
      // truly disables it, and TalkBack is told which of the two is true.
      accessibilityState={{ disabled: disabled || dimmed }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.bar,
        selected && styles.barSelected,
        pressed && styles.pressed,
        (disabled || dimmed) && styles.off,
      ]}
    >
      <Text style={styles.barLabel}>{label}</Text>
    </Pressable>
  );
}

/** The circle's diameter, and therefore the gap the grid leaves down its middle. */
const ATTACK_SIZE = 96;

const styles = StyleSheet.create({
  wrapper: { gap: space.sm },
  note: { ...type.small, color: colors.gold, paddingHorizontal: space.xs },

  grid: { gap: space.sm },
  gridRow: { flexDirection: 'row', gap: ATTACK_SIZE - space.md },

  slot: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET + space.md,
    justifyContent: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Content hugs the outside edge, so the two halves read as a band with a disc set into it.
  slotLeft: { alignItems: 'flex-start' },
  slotRight: { alignItems: 'flex-end' },
  slotBlank: { backgroundColor: colors.surface, borderStyle: 'dashed' },
  slotLabel: { ...type.body, color: colors.text },
  slotLocked: { ...type.small, ...tabular, color: colors.textDim },
  slotMeta: { flexDirection: 'row', alignItems: 'center', gap: space.xs },

  centre: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attack: {
    width: ATTACK_SIZE,
    height: ATTACK_SIZE,
    borderRadius: ATTACK_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    // Against the page rather than a hairline, so the disc reads as cut out of the band.
    borderWidth: 2,
    borderColor: colors.background,
  },
  attackLabel: { ...type.heading, color: colors.accentText },

  bars: { flexDirection: 'row', gap: space.sm },
  bar: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  barSelected: { borderColor: colors.accent },
  barLabel: { ...type.body, color: colors.text },

  pressed: { opacity: 0.85 },
  off: { opacity: 0.45 },

  submenu: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.xs,
  },

  // The satchel holds up to 20 (fixtures §9) and this list sits *above* the grid in the same
  // column, so an uncapped height pushes the grid and both bars off screen — including the Items
  // bar that closes it, leaving no way out but spending an item (drills note 15). Four rows.
  submenuScroll: { maxHeight: MIN_TOUCH_TARGET * 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: space.md,
  },
  rowLabel: { ...type.body, color: colors.text, flex: 1 },
  chevron: { ...type.body, fontWeight: '700' },
  uses: { ...type.small, ...tabular, color: colors.textDim },
  empty: { ...type.small, color: colors.textDim, padding: space.md },
});

const toneStyles = StyleSheet.create({
  strong: { color: colors.verdigris },
  neutral: { color: colors.textDim },
  weak: { color: colors.madder },
});
