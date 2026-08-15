import type { TextStyle } from 'react-native';

/**
 * The M1 token set — one fixed dark palette, deliberately.
 *
 * ↯ `app.config.ts` sets `userInterfaceStyle: 'automatic'`, which governs system chrome; the app's
 * own surfaces do not follow it. GDD 13 describes one visual world (the old roads at dusk) rather
 * than a light and a dark variant of it, and a second palette would have to be designed rather than
 * derived. When the art phase lands (tech-04 §9.3 replaces the placeholders) this is the file it
 * lands in.
 */
export const colors = {
  background: '#100E0C',
  surface: '#191510',
  surfaceRaised: '#241E17',
  border: '#372F27',

  text: '#EDE4D3',
  textMuted: '#9C907A60',
  textDim: '#9C907A',

  /** Bronze — the road, progress, the primary action. */
  accent: '#C08A3E',
  accentText: '#12100E',

  /** Used for the XP bar's fill and level-up moments. */
  gold: '#E0B457',

  /** Banners are informational, never alarming (GDD 10 §3.2 is explicit about tone). */
  notice: '#2A2620',
  noticeBorder: '#4A3F2E',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/**
 * ↯ Corners stay in the 2–8 range. The design pass is blunt about why: a 10px radius reads as a
 * consumer app, a carved edge reads as stone. `pill` is exempt — it is a shape (the XP track), not
 * a corner treatment.
 */
export const radius = {
  sm: 4,
  md: 8,
  pill: 999,
} as const;

/**
 * Spread into any style that renders a figure that changes while the player is looking at it.
 *
 * ↯ Not a cosmetic preference. Proportional digits have different widths, so a step count ticking
 * 7,999 → 8,000 visibly reflows the text around it and the row jitters. Tabular figures are
 * fixed-width, so the number changes and nothing else moves.
 *
 * ↯ Deliberately **not** `as const`, unlike everything else in this file. React Native types
 * `fontVariant` as a mutable `FontVariant[]`, so a readonly tuple is rejected — and because
 * `StyleSheet.create` infers over the whole object, one bad entry widens *every* style in that
 * sheet to `ViewStyle | TextStyle | ImageStyle` and the errors surface on unrelated lines.
 */
export const tabular: Pick<TextStyle, 'fontVariant'> = { fontVariant: ['tabular-nums'] };

/**
 * ↯ Deliberately **not** a theme token. 44dp is an accessibility floor, not a look — a restyle may
 * change every colour and radius in this file, and must not be able to shrink a tap target below
 * this. Kept here so it is next to the values it constrains, and named so a future palette pass
 * reads it as a limit rather than a preference.
 */
export const MIN_TOUCH_TARGET = 44;

export const type = {
  display: { fontSize: 30, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '700' },
  heading: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  small: { fontSize: 13, fontWeight: '400' },
  mono: { fontSize: 12, fontFamily: 'monospace' },
} as const;
