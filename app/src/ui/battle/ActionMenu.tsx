import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TOUCH_TARGET, colors, radius, space, tabular, type } from '../theme';
import type { Chevron } from './log';

/**
 * GDD 13 §6.1's action menu: **Attack, Skill, Item, Flee, always in this fixed order and position**.
 *
 * The order is not a layout preference — §6.1 ties it to menu-scanning time, so the four buttons
 * render unconditionally and a disabled one keeps its slot rather than collapsing the row. That is
 * also why a locked action shows a tooltip on tap instead of vanishing (§6.4's inventory of six
 * overlays, two of which are exactly this).
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

export type PendingMenu = 'skill' | 'item' | null;

export function ActionMenu({
  attack,
  skills,
  items,
  skillsEnabled,
  itemsEnabled,
  fleeable,
  skillLockedNote,
  fleeLockedNote,
  disabled = false,
  onAttack,
  onSkill,
  onItem,
  onFlee,
}: {
  attack: SkillOption;
  skills: readonly SkillOption[];
  items: readonly ItemOption[];
  skillsEnabled: boolean;
  itemsEnabled: boolean;
  fleeable: boolean;
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

  const choose = (menu: PendingMenu) => {
    setNote(null);
    setOpen((current) => (current === menu ? null : menu));
  };

  const locked = (message: string) => {
    setOpen(null);
    setNote(message);
  };

  const skillsUsable = skillsEnabled && skills.length > 0;

  return (
    <View style={styles.wrapper}>
      {note === null ? null : (
        <Text accessibilityRole="alert" style={styles.note}>
          {note}
        </Text>
      )}

      {open === 'skill' ? (
        <Submenu label="Skills">
          {skills.map((skill) => (
            <SkillRow
              key={skill.moveId}
              skill={skill}
              disabled={disabled || skill.usesLeft === 0}
              onPress={() => {
                setOpen(null);
                onSkill(skill.moveId);
              }}
            />
          ))}
        </Submenu>
      ) : null}

      {open === 'item' ? (
        <Submenu label="Items">
          {items.length === 0 ? (
            <Text style={styles.empty}>Your satchel is empty.</Text>
          ) : (
            items.map((item) => (
              <SkillRow
                key={item.playerItemId}
                skill={{ moveId: item.itemDefId, label: item.label, usesLeft: null, chevron: null }}
                disabled={disabled}
                onPress={() => {
                  setOpen(null);
                  onItem(item);
                }}
              />
            ))
          )}
        </Submenu>
      ) : null}

      <View style={styles.actions}>
        <Action
          label="Attack"
          disabled={disabled}
          onPress={() => {
            setOpen(null);
            setNote(null);
            onAttack(attack.moveId);
          }}
        />
        <Action
          label="Skill"
          dimmed={!skillsUsable}
          selected={open === 'skill'}
          disabled={disabled}
          onPress={() => (skillsUsable ? choose('skill') : locked(skillLockedNote))}
        />
        <Action
          label="Item"
          dimmed={!itemsEnabled}
          selected={open === 'item'}
          disabled={disabled}
          onPress={() => (itemsEnabled ? choose('item') : locked('Items are sealed in this fight.'))}
        />
        <Action
          label="Flee"
          dimmed={!fleeable}
          disabled={disabled}
          onPress={() => {
            setOpen(null);

            if (fleeable) {
              setNote(null);
              onFlee();
            } else {
              locked(fleeLockedNote);
            }
          }}
        />
      </View>
    </View>
  );
}

function Submenu({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View accessibilityLabel={label} style={styles.submenu}>
      {children}
    </View>
  );
}

function SkillRow({
  skill,
  disabled,
  onPress,
}: {
  skill: SkillOption;
  disabled: boolean;
  onPress: () => void;
}) {
  const { chevron } = skill;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={chevron?.description}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.off]}
    >
      <Text style={styles.rowLabel}>{skill.label}</Text>

      {chevron === null ? null : (
        <Text accessibilityLabel={chevron.description} style={[styles.chevron, toneStyles[chevron.tone]]}>
          {chevron.glyph}
        </Text>
      )}

      {skill.usesLeft === null ? null : <Text style={styles.uses}>{skill.usesLeft} left</Text>}
    </Pressable>
  );
}

function Action({
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
      // tooltip that explains why it is locked can never fire (GDD 10 §6.4). Only a resolving turn
      // truly disables it, and TalkBack is told which of the two is true.
      accessibilityState={{ disabled: disabled || dimmed }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        selected && styles.actionSelected,
        pressed && styles.pressed,
        (disabled || dimmed) && styles.off,
      ]}
    >
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space.sm },
  note: { ...type.small, color: colors.gold, paddingHorizontal: space.xs },

  actions: { flexDirection: 'row', gap: space.sm },
  action: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionSelected: { borderColor: colors.accent },
  actionLabel: { ...type.heading, color: colors.text },
  pressed: { opacity: 0.85 },
  off: { opacity: 0.45 },

  submenu: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: space.md,
  },
  rowLabel: { ...type.body, color: colors.text, flex: 1 },
  chevron: { ...type.body, fontWeight: '700' },
  uses: { ...type.small, ...tabular, color: colors.textDim, minWidth: 52, textAlign: 'right' },
  empty: { ...type.small, color: colors.textDim, paddingHorizontal: space.md, paddingVertical: space.sm },
});

/** GDD 13 §6.2's three tones. `madder` exists for the weak one and for nothing else (§11). */
const toneStyles = StyleSheet.create({
  strong: { color: colors.gold },
  neutral: { color: colors.textDim },
  weak: { color: colors.madder },
});
