import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MIN_TOUCH_TARGET, colors, radius, space, type } from './theme';

/**
 * GDD 13 §8's shared primitives, at the fidelity M1 needs.
 *
 * ↯ No CSS and no cascade — only `Text` inherits from an ancestor `Text`, nothing else inherits at
 * all. Expecting a parent's `color` or `fontFamily` to reach a child is the habit that breaks here.
 */

export function Screen({
  children,
  scroll = false,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
}) {
  const body = <View style={[styles.screenBody, style]}>{children}</View>;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Body({ children, dim = false }: { children: ReactNode; dim?: boolean }) {
  return <Text style={[styles.body, dim && styles.dim]}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  busy?: boolean;
}) {
  const inactive = disabled || busy;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        pressed && styles.buttonPressed,
        inactive && styles.buttonDisabled,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'primary' ? colors.accentText : colors.text} />
      ) : (
        <Text style={[styles.buttonLabel, variant === 'secondary' && styles.buttonLabelSecondary]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textDim}
        style={styles.input}
        {...props}
      />
      {hint === undefined ? null : <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/**
 * Sub-views are state, not routes (tech-04 §4.3): both panes stay mounted, so switching loses
 * nothing. Deliberately not persisted — GDD 13 §5.1 names what a fresh launch shows.
 *
 * Underlined tabs rather than a filled pill group (GDD 13 §11): the row width no longer has to be
 * divided between the options, so a third sub-view can be added without redrawing the control.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.segments}>
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenBody: { flex: 1, padding: space.md, gap: space.md },
  scrollContent: { flexGrow: 1 },

  title: { ...type.title, color: colors.text },
  heading: { ...type.heading, color: colors.text },
  body: { ...type.body, color: colors.text, lineHeight: 22 },
  dim: { color: colors.textDim },

  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.45 },
  buttonLabel: { ...type.heading, color: colors.accentText },
  buttonLabelSecondary: { color: colors.text },

  field: { gap: space.xs },
  fieldLabel: { ...type.small, color: colors.textDim },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
  },
  hint: { ...type.small, color: colors.textDim },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: space.sm,
  },

  segments: {
    flexDirection: 'row',
    gap: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  segment: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xs,
    minHeight: MIN_TOUCH_TARGET,
    // ↯ Sits on top of the row's hairline rather than below it. Android draws sibling borders on
    // their own pixel rows, so without the negative offset the underline is a second line under the
    // divider instead of replacing it.
    marginBottom: -StyleSheet.hairlineWidth,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  segmentSelected: { borderBottomColor: colors.accent },
  segmentLabel: { ...type.body, color: colors.textDim },
  segmentLabelSelected: { color: colors.text, fontWeight: '600' },
});
