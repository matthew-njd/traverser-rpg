import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { playSfx, playSting } from '../../audio/bus';

import type { RoadGate, RoadState, RoadZone } from '../../progression/road';
import { Road, waymarkerZone } from '../Road';

jest.mock('../../audio/bus');

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

    expect(screen.getByText(/ready to battle/)).toBeTruthy();
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
    expect(screen.getByLabelText('Cerberus, ready to battle')).toBeTruthy();
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
   * GDD 9 §4.3 — Explore acts on a segment the player has **already unlocked**, so only those can be
   * selected as its target (GDD 13 §4.2, amended at M5/P6). A locked one does not answer.
   */
  it("selects an unlocked segment as Explore's target, and never a locked one", async () => {
    const onSelect = jest.fn();

    await render(
      <Road
        state={state({
          zones: [
            zone({ gates: [] }),
            zone({ zoneId: 'valheon', displayName: 'Valheon', unlocked: false, gates: [] }),
          ],
        })}
        selected="olympion"
        onSelect={onSelect}
      />,
    );

    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.getByRole('radio').props.accessibilityState).toMatchObject({ checked: true });
    // One dot, on the unlocked card: a locked zone shows none.
    expect(screen.getAllByText(/^[●○]$/)).toHaveLength(1);
    expect(screen.getByText('●')).toBeTruthy();

    await fireEvent.press(screen.getByText('Olympion'));
    await fireEvent.press(screen.getByText('Valheon'));

    expect(onSelect.mock.calls).toEqual([['olympion']]);
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

    // The row is not the button: a tap on the name belongs to the zone card, not the fight.
    await fireEvent.press(screen.getByText('Cerberus'));
    await fireEvent.press(screen.getByText('Battle'));
    await fireEvent.press(screen.getByText('Battle again'));
    await fireEvent.press(screen.getByText('Fenrir'));

    expect(onFace.mock.calls.map(([faced]) => (faced as RoadGate).gateId)).toEqual([
      'gate_cyclops',
      'gate_cerberus',
    ]);
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

/** GDD 9 §5 and GDD 14 §3.8 — the walk is heard as well as seen, and reduced motion keeps the chime. */
describe('the Waymarker walk', () => {
  beforeEach(() => jest.clearAllMocks());

  it('stands the Waymarker in its own segment only', async () => {
    await render(<Road state={state()} />);

    expect(screen.getAllByTestId('waymarker')).toHaveLength(1);
  });

  it('walks to the footstep loop', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);

    await render(<Road state={state()} walk={{ from: 0.1, to: 0.4 }} />);

    await waitFor(() => expect(playSfx).toHaveBeenCalledWith('sfx_footstep_loop', true));
    screen.unmount();
  });

  it('skips the walk under reduced motion, but still chimes', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    await render(<Road state={state()} walk={{ from: 0.1, to: 0.4 }} />);

    await waitFor(() => expect(playSting).toHaveBeenCalledWith('stg_waymarker'));
    expect(playSfx).not.toHaveBeenCalled();
  });

  it('is silent when there is nothing to walk', async () => {
    await render(<Road state={state()} walk={null} />);

    expect(playSfx).not.toHaveBeenCalled();
    expect(playSting).not.toHaveBeenCalled();
  });
});
