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
  background: '#12100E',
  surface: '#1C1916',
  surfaceRaised: '#262119',
  border: '#3A322A',

  text: '#EDE4D3',
  textMuted: '#A2968060',
  textDim: '#A29680',

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

export const radius = {
  sm: 6,
  md: 10,
  pill: 999,
} as const;

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
