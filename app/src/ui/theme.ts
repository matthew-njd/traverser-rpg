import type { TextStyle } from 'react-native';

/**
 * The M1 token set — one fixed dark palette, deliberately.
 *
 * `app.config.ts` sets `userInterfaceStyle: 'automatic'`, which governs system chrome; the app's
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

  /**
   * GDD 13 §11 — the **super-effective signal** (§6.2), and Mythic tier when gear lands at M3.
   *
   * §6.2 asks for green and the palette has exactly one. Scoped to the chevron and its callout
   * rather than borrowing `gold`, which already means XP and a goal met — two meanings on one
   * screen is how a colour stops carrying either.
   */
  verdigris: '#5B8577',

  /**
   * GDD 13 §11 — **enemy health only**, and the scope is the point. It is the one alarming colour
   * in the palette, so a second consumer costs it the meaning it is carrying.
   */
  oxblood: '#9A4436',

  /**
   * GDD 13 §11 — **the resisted type chevron only** (§6.2). Lighter and less saturated than
   * `oxblood` so it reads as a hint on a dark surface rather than as a bar; same family, different
   * signal. Not for errors, not for damage, not for the post-hit callout.
   */
  madder: '#BF6A55',

  /**
   * GDD 13 §11's art plate. **Every illustration is an inked silhouette on a cream plate** — the
   * load-bearing art rule, because a generated sprite only has to be a good *shape* to look
   * intentional, and it is what makes tech-04 §9.3's placeholder swap cosmetic.
   */
  marble: '#E9E0CE',

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
 * Corners stay in the 2–8 range. The design pass is blunt about why: a 10px radius reads as a
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
 * Not a cosmetic preference. Proportional digits have different widths, so a step count ticking
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
 * Deliberately **not** a theme token. 44dp is an accessibility floor, not a look — a restyle may
 * change every colour and radius in this file, and must not be able to shrink a tap target below
 * this. Kept here so it is next to the values it constrains, and named so a future palette pass
 * reads it as a limit rather than a preference.
 */
export const MIN_TOUCH_TARGET = 44;

/**
 * GDD 13 §11's scale, on Spectral. Only the three weights the config plugin embeds are used —
 * ↯ Android has no synthetic bolding for a custom family, so `fontWeight: '500'` here would fall
 * back to the nearest embedded weight rather than render at 500.
 *
 * `mono` stays on the system face: it is debug/diagnostic text, and Spectral has no mono cut.
 */
export const type = {
  display: { fontFamily: 'Spectral', fontSize: 30, fontWeight: '700' },
  title: { fontFamily: 'Spectral', fontSize: 22, fontWeight: '700' },
  heading: { fontFamily: 'Spectral', fontSize: 17, fontWeight: '600' },
  body: { fontFamily: 'Spectral', fontSize: 15, fontWeight: '400' },
  small: { fontFamily: 'Spectral', fontSize: 13, fontWeight: '400' },
  mono: { fontSize: 12, fontFamily: 'monospace' },
} as const;
