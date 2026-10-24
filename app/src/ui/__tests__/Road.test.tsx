import { fireEvent, render, screen } from '@testing-library/react-native';

import type { RoadGate, RoadState, RoadZone } from '../../progression/road';
import { Road, waymarkerZone } from '../Road';

/**
 * GDD 9 §4's node states, rendered from a `RoadState` and nothing else.
 *
 * tech-04 §12 reserves RNTL for components with real logic, never for layout — and the layout here
 * is P9's, since RNTL cannot see it. What it *can* see is which state each node claims to be in,
 * which is the half a player acts on.
 *
 * ↯ `render` is `await`ed. RNTL v14 made it async; called synchronously the tree never mounts and
 * every query throws "`render` function has not been called", which reads like a setup problem.
 */
const gate = (overrides: Partial<RoadGate> = {}): RoadGate => ({
  gateId: 'gate_cyclops',
  zoneId: 'olympion',
  enemyId: 'enemy_cyclops',
  displayName: 'Cyclops',
  leagueThreshold: 90,
  isHardGate: false,
  unlocksZoneId: null,
  state: 'locked',
  ...overrides,
});

const zone = (overrides: Partial<RoadZone> = {}): RoadZone => ({
  zoneId: 'olympion',
  displayName: 'Olympion',
  ordinal: 1,
  entryThresholdLeagues: 0,
  unlocked: true,
  isReleased: true,
  gates: [gate()],
  ...overrides,
});

const state = (overrides: Partial<RoadState> = {}): RoadState => ({
  leagues: 40,
  zones: [zone()],
  nextGate: gate(),
  ...overrides,
});

describe('the Road', () => {
  it('names every segment and its gates', async () => {
    await render(<Road state={state()} />);

    expect(screen.getByText('Olympion')).toBeTruthy();
    expect(screen.getByText('Cyclops')).toBeTruthy();
  });

  /** GDD 9 §4.4 — a locked node says how far, not merely that it is shut. */
  it('tells a locked gate how far away it still is', async () => {
    await render(<Road state={state({ leagues: 40 })} />);

    expect(screen.getByText(/50 Leagues away/)).toBeTruthy();
  });

  it('says a gate is ready once the Waymarker reaches it', async () => {
    await render(<Road state={state({ leagues: 90, zones: [zone({ gates: [gate({ state: 'available' })] })] })} />);

    expect(screen.getByText(/ready to face/)).toBeTruthy();
  });

  it('says a gate is defeated once its boss has fallen', async () => {
    await render(<Road state={state({ zones: [zone({ gates: [gate({ state: 'defeated' })] })] })} />);

    expect(screen.getByText(/defeated/)).toBeTruthy();
  });

  /**
   * ↯ **Colour is never the only channel** (WCAG 1.4.1). The three states are told apart by a glyph
   * and by words, so the tone is free to be repainted and collapsing two states into one is not.
   */
  it('states each node condition in words, not only in colour', async () => {
    await render(
      <Road
        state={state({
          zones: [
            zone({
              gates: [
                gate({ gateId: 'a', displayName: 'Cyclops', state: 'defeated' }),
                gate({ gateId: 'b', displayName: 'Cerberus', state: 'available' }),
              ],
            }),
          ],
        })}
      />,
    );

    expect(screen.getByLabelText('Cyclops, defeated')).toBeTruthy();
    expect(screen.getByLabelText('Cerberus, ready to face')).toBeTruthy();
  });

  /**
   * GDD 9 §4.2 — a mid-boss is a checkpoint the player walks past and a final boss is a wall. The
   * difference has to be legible *before* the fight rather than discovered at it.
   */
  it('distinguishes a soft checkpoint from a hard wall', async () => {
    await render(
      <Road
        state={state({
          zones: [
            zone({
              gates: [
                gate({ gateId: 'a', displayName: 'Cyclops', isHardGate: false }),
                gate({ gateId: 'b', displayName: 'Cerberus', isHardGate: true }),
              ],
            }),
          ],
        })}
      />,
    );

    expect(screen.getByText(/you may walk on/)).toBeTruthy();
    expect(screen.getByText(/the road stops here/)).toBeTruthy();
  });

  /**
   * GDD 9 §4.3 — Explore belongs to a segment the player has **already unlocked**. That is what
   * makes returning to Olympion for a Storm charm while levelling in Imperion a supported thing to
   * do rather than a workaround, and it is why a locked segment offers nothing.
   */
  it('offers Explore on an unlocked segment and nowhere else', async () => {
    const onExplore = jest.fn();

    await render(
      <Road
        state={state({
          zones: [
            zone({ gates: [] }),
            zone({ zoneId: 'valheon', displayName: 'Valheon', unlocked: false, gates: [] }),
          ],
        })}
        onExplore={onExplore}
      />,
    );

    expect(screen.getByText('Explore Olympion')).toBeTruthy();
    expect(screen.queryByText('Explore Valheon')).toBeNull();

    await fireEvent.press(screen.getByText('Explore Olympion'));

    expect(onExplore).toHaveBeenCalledWith('olympion');
  });

  /**
   * GDD 9 §4.2 — tapping a reached gate starts the fight, and a beaten one is a rematch (GDD 5 §5).
   * A locked gate must not answer: its fight is unreachable until the Waymarker gets there.
   */
  it('faces a reached gate and a beaten one, never a locked one', async () => {
    const onFace = jest.fn();

    await render(
      <Road
        state={state({
          zones: [
            zone({
              gates: [
                gate({ state: 'available' }),
                gate({ gateId: 'gate_cerberus', displayName: 'Cerberus', state: 'defeated' }),
                gate({ gateId: 'gate_fenrir', displayName: 'Fenrir', state: 'locked' }),
              ],
            }),
          ],
        })}
        onFace={onFace}
      />,
    );

    await fireEvent.press(screen.getByText('Face ›'));
    await fireEvent.press(screen.getByText('Face again ›'));
    await fireEvent.press(screen.getByText('Fenrir'));

    expect(onFace.mock.calls.map(([faced]) => (faced as RoadGate).gateId)).toEqual([
      'gate_cyclops',
      'gate_cerberus',
    ]);
  });

  /**
   * ↯ The roll is the server's (T2 §4 step 8), so the button cannot report an outcome — only that
   * the tap is away. A second press while the first is in flight would spend a second roll.
   */
  it('shuts the button while its tap is in flight', async () => {
    const onExplore = jest.fn();

    await render(
      <Road state={state({ zones: [zone({ gates: [] })] })} exploring="olympion" onExplore={onExplore} />,
    );

    await fireEvent.press(screen.getByText('Searching the road…'));

    expect(onExplore).not.toHaveBeenCalled();
  });

  /**
   * Locked and unreleased are different sentences. One is a road the player will open; the other is
   * a road that does not exist yet (§4.2's "coming soon" terminus).
   */
  it('keeps a locked zone and an unreleased one apart', async () => {
    await render(
      <Road
        state={state({
          zones: [
            zone({ zoneId: 'valheon', displayName: 'Valheon', unlocked: false, gates: [] }),
            zone({ zoneId: 'egypt_tbd', displayName: 'Egypt', unlocked: false, isReleased: false, gates: [] }),
          ],
        })}
      />,
    );

    expect(screen.getByText('Locked')).toBeTruthy();
    expect(screen.getByText('Coming soon')).toBeTruthy();
  });
});

/**
 * ↯ Unlocked, not merely reached. A player can walk past Cerberus's threshold without beating him
 * and keep earning Leagues (GDD 9 §3's dual gate) — putting their Waymarker in Valheon would have
 * the map contradict the wall standing in front of them.
 */
describe('waymarkerZone', () => {
  const olympion = zone();
  const valheon = zone({ zoneId: 'valheon', entryThresholdLeagues: 220, unlocked: false });

  it('stands in the furthest zone the player has actually entered', () => {
    expect(waymarkerZone(state({ leagues: 300, zones: [olympion, valheon] }))).toBe('olympion');
    expect(
      waymarkerZone(state({ leagues: 300, zones: [olympion, { ...valheon, unlocked: true }] })),
    ).toBe('valheon');
  });

  it('stays behind a zone whose threshold is still ahead', () => {
    expect(
      waymarkerZone(state({ leagues: 100, zones: [olympion, { ...valheon, unlocked: true }] })),
    ).toBe('olympion');
  });
});
