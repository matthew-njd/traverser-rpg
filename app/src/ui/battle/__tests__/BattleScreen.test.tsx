import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { colors } from '../../theme';

import { skill } from '../../../battle/__tests__/fixtures';
import { contextFor } from '../../../battle/__tests__/harness';
import type { BattleEvent, BattleState } from '../../../battle/state';
import { NO_EFFECTS, rulesFor, TUTORIAL_RULES } from '../../../battle/types';
import {
  FLEE_LOCKED_NOTE,
  ITEM_ONLY_NOTE,
  SKILL_LOCKED_NOTE,
} from '../../../onboarding/tutorial';
import { DEFAULT_SKILL_LOCKED, type BattleScript, BattleScreen } from '../BattleScreen';
import { RESISTED, SUPER_EFFECTIVE } from '../log';
import { ACTOR_CHANGE_DELAY_MS, LINE_DELAY_MS } from '../paced';
import type { Reveal } from '../reveal';
import type { BattleLore } from '../../../content/lore';

/**
 * M2 plan P6: **RNTL over the event queue with a stubbed engine.** The engine is already proven as
 * pure functions, so nothing here re-asserts damage — these cases pin what the screen does with a
 * state and an event list, which no engine test can see.
 *
 * ↯ `render` and `fireEvent` are `await`ed — RNTL v14 made both async, and the failure mode is
 * silent: the tree never mounts and every query throws "`render` function has not been called".
 */
const CONTEXT = contextFor('enemy_harpy');

/**
 * A Level 10 loadout. Against the Harpy (Storm) the two Divine moves land on opposite tones —
 * Storm → Storm is 1×, War → Storm is 0.5× — which is what the chevron-colour case needs.
 */
const MOVES = [
  'skill_basic_attack',
  'skill_iron_advance',
  'skill_thunderers_wrath',
  'skill_warlords_advance',
].map(skill);

const LABELS = new Map([
  ['enemy_harpy', 'Harpy'],
  ['storm', 'Storm'],
  ['war', 'War'],
  ['skill_basic_attack', 'Basic Attack'],
  ['skill_iron_advance', 'Iron Advance'],
  ['skill_thunderers_wrath', "Thunderer's Wrath"],
  ['skill_warlords_advance', "Warlord's Advance"],
  ['item_travelers_salve', "Traveller's Salve"],
]);

function stateOf(overrides: Partial<BattleState> = {}): BattleState {
  return {
    phase: 'await_player',
    round: 1,
    rules: rulesFor('wild'),
    encounterKind: 'wild',
    enemyId: 'enemy_harpy',
    enemyLevel: 15,
    player: {
      vigor: 32,
      vigorMax: 40,
      stats: { vigor: 40, might: 20, resolve: 15, favor: 30, aegis: 15, stride: 20 },
      effects: NO_EFFECTS,
    },
    enemy: {
      vigor: 24,
      vigorMax: 48,
      stats: { vigor: 48, might: 20, resolve: 15, favor: 20, aegis: 15, stride: 30 },
      effects: NO_EFFECTS,
    },
    first: 'player',
    firstReason: 'stride',
    uses: { skill_thunderers_wrath: 4, skill_warlords_advance: 4 },
    outcome: null,
    drops: null,
    itemsConsumed: [],
    firstKill: true,
    ...overrides,
  };
}

const SALVE = {
  playerItemId: 'pi-1',
  itemDefId: 'item_travelers_salve',
  label: "Traveller's Salve",
};

const hit = (typeMultiplier: number): BattleEvent => ({
  type: 'damage_dealt',
  actor: 'player',
  target: 'enemy',
  amount: 26,
  typeMultiplier,
  wasCrit: false,
});

const incoming = (typeMultiplier: number): BattleEvent => ({
  type: 'damage_dealt',
  actor: 'enemy',
  target: 'player',
  amount: 26,
  typeMultiplier,
  wasCrit: false,
});

async function show(
  overrides: {
    state?: Partial<BattleState>;
    events?: readonly BattleEvent[];
    items?: readonly typeof SALVE[];
    moves?: readonly ReturnType<typeof skill>[];
    script?: BattleScript;
    chevronsUnlocked?: boolean;
    reveals?: readonly Reveal[];
    lore?: BattleLore;
    handlers?: Partial<Record<'onBegin' | 'onMove' | 'onItem' | 'onFlee' | 'onDone', jest.Mock>>;
  } = {},
) {
  const handlers = {
    onBegin: jest.fn(),
    onMove: jest.fn(),
    onItem: jest.fn(),
    onFlee: jest.fn(),
    onDone: jest.fn(),
    ...overrides.handlers,
  };

  await render(
    <BattleScreen
      state={stateOf(overrides.state)}
      context={CONTEXT}
      moves={overrides.moves ?? MOVES}
      labels={LABELS}
      traverserName="Matthew"
      events={overrides.events ?? []}
      items={overrides.items ?? [SALVE]}
      chevronsUnlocked={overrides.chevronsUnlocked ?? true}
      reveals={overrides.reveals ?? []}
      script={overrides.script ?? null}
      lore={overrides.lore}
      {...handlers}
    />,
  );

  return handlers;
}

/** The text a button renders, for order assertions — RNTL exposes children, not a flat label. */
function textOf(node: { children: unknown[] }): string | null {
  const [first] = node.children;

  return typeof first === 'object' && first !== null && 'children' in first
    ? String((first as { children: unknown[] }).children[0])
    : null;
}

describe('the enemy panel', () => {
  it('names the enemy and its type from the content bundle', async () => {
    await show();

    expect(screen.getByText('Harpy')).toBeTruthy();
    expect(screen.getByText('Storm')).toBeTruthy();
  });

  /**
   * GDD 13 §6.1, amended at M5/P7c — both bars read current/max, the units the log's damage is in.
   * A percentage on the enemy left "14 damage" with nothing to be read against.
   */
  it("shows both sides' Vigor as current over max", async () => {
    await show();

    expect(screen.getByText('24 / 48')).toBeTruthy();
    expect(screen.getByText('32 / 40')).toBeTruthy();
    expect(screen.queryByText('50%')).toBeNull();
  });

  /** §6.1 closes Section 5's flag: no level indicator, because it always equals the player's. */
  it('shows no enemy level anywhere', async () => {
    await show();

    expect(screen.queryByText(/Level 15/)).toBeNull();
    expect(screen.queryByText('15')).toBeNull();
  });
});

describe('the type-effectiveness surfaces', () => {
  it('calls out a super-effective hit', async () => {
    await show({ events: [hit(2)] });

    expect(screen.getByText(SUPER_EFFECTIVE)).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByText(SUPER_EFFECTIVE).props.style).color).toBe(
      colors.verdigris,
    );
  });

  it('calls out a resisted hit', async () => {
    await show({ events: [hit(0.5)] });

    expect(screen.getByText(RESISTED)).toBeTruthy();
  });

  /**
   * The two type surfaces speak one colour language: the down chevron the player reads in the Skill menu and
   * the "Resisted…" that answers the tap are the same `madder`. Two schemes for one fact is the
   * regression this guards.
   */
  it('colours the callout to match the chevron that predicted it', async () => {
    await show({ events: [hit(0.5)] });

    expect(StyleSheet.flatten(screen.getByText(RESISTED).props.style).color).toBe(colors.madder);

    // The chevron is on the slot now, with no sub-menu to open in front of it.
    expect(StyleSheet.flatten(screen.getByTestId('chevron-weak').props.style).color).toBe(colors.madder);
  });

  it('says nothing on a neutral hit', async () => {
    await show({ events: [hit(1)] });

    expect(screen.queryByText(SUPER_EFFECTIVE)).toBeNull();
    expect(screen.queryByText(RESISTED)).toBeNull();
  });

  /**
   * ↯ The callout belongs to the *latest* hit. A stale one left on screen would contradict the
   * damage the player just watched land, which is the exact disagreement T5 §9 puts `typeMultiplier`
   * on the event to prevent.
   */
  it('replaces the callout when a neutral hit follows an effective one', async () => {
    await show({ events: [hit(2), hit(1)] });

    expect(screen.queryByText(SUPER_EFFECTIVE)).toBeNull();
  });

  /** The player's own hits are what the callout describes; an incoming hit is not effectiveness. */
  it('shows no callout for a hit the enemy landed', async () => {
    await show({ events: [incoming(2)] });

    expect(screen.queryByText(SUPER_EFFECTIVE)).toBeNull();
  });
});

describe('the action menu', () => {

  /**
   * GDD 13 §6.1 (amended 2026-08-22) — **seven targets, every one at a fixed position**. The four
   * slots come first in the tree, then the Attack circle, then the two bars.
   *
   * ↯ Attack is centred *visually* and last in the tree, and those cannot both be first: RN paints
   * siblings in tree order with no z-index, so the circle has to come after the slots it overlaps.
   * A screen reader therefore reaches it after the four slots.
   */
  it('offers four slots, Attack and the two bars, each in a fixed position', async () => {
    await show();

    const order = screen
      .getAllByRole('button')
      .map((node) => node.props.accessibilityLabel ?? textOf(node))
      .filter((label): label is string => typeof label === 'string');

    expect(order).toEqual([
      'Iron Advance',
      "Thunderer's Wrath, 4 left",
      "Warlord's Advance, 4 left",
      'Skill slot, locked until level 16',
      'Attack',
      'Items',
      'Flee',
    ]);
  });

  it('sends the unlimited-use move when Attack is tapped', async () => {
    const handlers = await show();

    await fireEvent.press(screen.getByText('Attack'));

    expect(handlers.onMove).toHaveBeenCalledWith('skill_basic_attack');
  });

  /** The point of the re-layout: a skill is **one tap**, with no sub-menu in front of it. */
  it('sends a skill from its slot in a single tap', async () => {
    const handlers = await show();

    await fireEvent.press(screen.getByText("Thunderer's Wrath"));

    expect(handlers.onMove).toHaveBeenCalledWith('skill_thunderers_wrath');
  });

  /**
   * GDD 3 §2.4 — Levels 1–3 hold no skills at all, and that is exactly when GDD 10's tutorial runs.
   * So four locked slots is the **first** battle screen a player ever sees, not an edge case.
   */
  it('shows four locked slots naming their levels at Level 1', async () => {
    await show({ moves: [skill('skill_basic_attack')], state: { enemyLevel: 1 } });

    expect(screen.getByText('Lv 4')).toBeTruthy();
    expect(screen.getByText('Lv 6')).toBeTruthy();
    expect(screen.getByText('Lv 10')).toBeTruthy();
    expect(screen.getByText('Lv 16')).toBeTruthy();
  });

  /** §6.1's reason for keeping a disabled action in place applies to a slot: it explains itself. */
  it('explains a locked slot rather than letting it vanish', async () => {
    const handlers = await show({ moves: [skill('skill_basic_attack')], state: { enemyLevel: 1 } });

    await fireEvent.press(screen.getByText('Lv 4'));

    expect(screen.getByText(DEFAULT_SKILL_LOCKED)).toBeTruthy();
    expect(handlers.onMove).not.toHaveBeenCalled();
  });

  /**
   * ↯ **A locked slot and a spent one must not read alike.** One has never existed; the other has
   * just been used. Collapsing them into "greyed out" is how a player concludes their skills are
   * gone — so the two say different things and this pins that they do.
   */
  it('distinguishes a spent slot from a locked one', async () => {
    await show({ state: { uses: { skill_thunderers_wrath: 0, skill_warlords_advance: 4 } } });

    expect(screen.getByText('0 left')).toBeTruthy();
    expect(screen.getByText('Lv 16')).toBeTruthy();
  });

  it('shows the chevron beside a typed move once the enemy has been fought', async () => {
    await show();

    expect(screen.getByLabelText(/Storm vs\. Storm/)).toBeTruthy();
  });

  /**
   * GDD 13 §6.2 wants three distinguishable tones, and §11 gives the resisted one `madder` — its
   * only sanctioned use. Asserted as "all three differ" rather than against the hex, so a repaint
   * is free and collapsing `weak` back into `neutral` is not.
   */
  it('gives the three chevron tones three different colours', async () => {
    await show();

    const colourOf = (tone: string) =>
      StyleSheet.flatten(screen.getByTestId(`chevron-${tone}`).props.style).color;

    // Strong needs a super-effective pair, which the Harpy does not offer — the two it does offer are
    // enough to catch the collapse this guards against.
    expect(colourOf('neutral')).not.toBe(colourOf('weak'));
    expect(colourOf('weak')).toBe(colors.madder);
  });

  /**
   * GDD 13 §6.2 — the long press is where the match is spelled out as *move type* vs. *enemy type*.
   * ↯ Not a nicety: the chevron says how the match goes and not which way round it runs, and GDD 6
   * and 7 flag three times that Sea and Wisdom reverse depending on who attacks. P8 found this
   * unimplemented — the description existed but was wired only to `accessibilityHint`, so TalkBack
   * read it and a sighted player never saw it. It has no sub-menu to live in now, so the slot
   * carries it.
   */
  it('spells out the matchup on a long press', async () => {
    await show();

    await fireEvent(screen.getByText("Warlord's Advance"), 'longPress');

    expect(screen.getByText(/War vs. Storm/)).toBeTruthy();
  });

  it('offers no explanation for a move that has no chevron', async () => {
    await show({ chevronsUnlocked: false });

    await fireEvent(screen.getByText("Warlord's Advance"), 'longPress');

    expect(screen.queryByText(/vs./)).toBeNull();
  });

  /** Drills note 14 — and note 3's hidden chevron reads as by design only if Physical is said. */
  it('names a Physical slot rather than leaving its type blank', async () => {
    await show();

    expect(screen.getByText('Physical')).toBeTruthy();
  });

  it('names a Divine slot with its type', async () => {
    await show();

    expect(screen.getByText('Divine · Storm')).toBeTruthy();
    expect(screen.getByText('Divine · War')).toBeTruthy();
  });

  it('withholds the chevron on a first encounter', async () => {
    await show({ chevronsUnlocked: false });

    expect(screen.queryByLabelText(/vs\./)).toBeNull();
  });

  it('will not send a move whose uses are spent, and says why', async () => {
    const handlers = await show({ state: { uses: { skill_thunderers_wrath: 0 } } });

    await fireEvent.press(screen.getByText("Thunderer's Wrath"));

    expect(handlers.onMove).not.toHaveBeenCalled();
    expect(screen.getByText(/spent for this fight/)).toBeTruthy();
  });

  it('hands the whole item back so the spend can name its player_item_id', async () => {
    const handlers = await show();

    await fireEvent.press(screen.getByText('Items'));
    await fireEvent.press(screen.getByText("Traveller's Salve"));

    expect(handlers.onItem).toHaveBeenCalledWith(SALVE);
  });

  /** Items stays a list: it is a variable-length inventory, not a fixed loadout. */
  it('says so rather than showing an empty list when the satchel is bare', async () => {
    await show({ items: [] });

    await fireEvent.press(screen.getByText('Items'));

    expect(screen.getByText('Your satchel is empty.')).toBeTruthy();
  });

  /**
   * GDD 10 §6.4 — a locked action stays **visible and in its slot**, and explains itself when
   * tapped. Removing it would move the other three, which §6.1 ties to menu-scanning time.
   */
  it('keeps the slots and Flee in place in the tutorial and explains why they are locked', async () => {
    const handlers = await show({
      moves: [skill('skill_basic_attack')],
      state: { rules: TUTORIAL_RULES, enemyLevel: 1 },
      script: {
        beat: null,
        skillLockedNote: SKILL_LOCKED_NOTE,
        fleeLockedNote: FLEE_LOCKED_NOTE,
      },
    });

    expect(screen.getByText('Lv 4')).toBeTruthy();
    expect(screen.getByText('Flee')).toBeTruthy();

    await fireEvent.press(screen.getByText('Lv 4'));

    expect(screen.getByText(SKILL_LOCKED_NOTE)).toBeTruthy();
    expect(handlers.onMove).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Flee'));

    expect(screen.getByText(FLEE_LOCKED_NOTE)).toBeTruthy();
    expect(handlers.onFlee).not.toHaveBeenCalled();
  });

  /**
   * GDD 10 §6.4's round 3, where the script withholds Attack so the Item action is actually seen —
   * the Wisp sits at 3 Vigor against a 6-damage hit, so attacking would end the fight a round early.
   */
  it('withholds Attack when the script says so, and says why', async () => {
    const handlers = await show({
      script: {
        beat: { note: null, prompt: 'Use a Salve.', attackEnabled: false },
        attackLockedNote: ITEM_ONLY_NOTE,
      },
    });

    await fireEvent.press(screen.getByText('Attack'));

    expect(handlers.onMove).not.toHaveBeenCalled();
    expect(screen.getByText(ITEM_ONLY_NOTE)).toBeTruthy();
  });

  it('shows the scripted note and prompt while a beat is active', async () => {
    await show({
      script: { beat: { note: 'That is your Vigor.', prompt: 'Attack again.', attackEnabled: true } },
    });

    expect(screen.getByText('That is your Vigor.')).toBeTruthy();
    expect(screen.getByText('Attack again.')).toBeTruthy();
  });

  /** Every ordinary battle passes no script at all, and must show no guided copy. */
  it('shows no guided copy without a script', async () => {
    await show();

    expect(screen.queryByText(/Attack again/)).toBeNull();
  });

  it('flees a wild encounter', async () => {
    const handlers = await show();

    await fireEvent.press(screen.getByText('Flee'));

    expect(handlers.onFlee).toHaveBeenCalled();
  });
});

/** GDD 12 §2's beats, in the order the fight reaches them. */
describe('the lore beats', () => {
  const LORE: BattleLore = {
    opening: ['Three heads turn toward you at once.', '"The road ends here."'],
    defeat: ['All three heads go still.'],
    narrative: ['Now the gate is open.', 'The road continues. Keep walking.'],
  };

  it('shows the intro before Begin, then Begin', async () => {
    const handlers = await show({ state: { phase: 'enemy_intro' }, lore: LORE });

    expect(screen.queryByText('Begin')).toBeNull();
    expect(screen.getByText('"The road ends here."')).toBeTruthy();

    await fireEvent.press(screen.getByText('Three heads turn toward you at once.'));

    await fireEvent.press(screen.getByText('Begin'));
    expect(handlers.onBegin).toHaveBeenCalled();
  });

  it('shows the defeat text, then the narrative, then the victory panel', async () => {
    await show({ state: { phase: 'victory', outcome: 'win' }, lore: LORE });

    expect(screen.queryByText('Continue')).toBeNull();
    await fireEvent.press(screen.getByText('All three heads go still.'));

    await fireEvent.press(screen.getByText('Now the gate is open.'));
    await fireEvent.press(screen.getByText('The road continues. Keep walking.'));

    expect(screen.getByText('The road remembers this.')).toBeTruthy();
  });

  /** A defeat is not a defeat of the boss: its text belongs to a win only. */
  it('shows no defeat text when the player loses', async () => {
    await show({ state: { phase: 'defeat', outcome: 'loss' }, lore: LORE });

    expect(screen.queryByText('All three heads go still.')).toBeNull();
    expect(screen.getByText('Continue')).toBeTruthy();
  });
});

describe('the fight as a whole', () => {
  it('waits for Begin before offering any action', async () => {
    const handlers = await show({ state: { phase: 'enemy_intro' } });

    expect(screen.queryByText('Attack')).toBeNull();

    await fireEvent.press(screen.getByText('Begin'));

    expect(handlers.onBegin).toHaveBeenCalled();
  });

  it('replaces the menu with the outcome once the battle has settled', async () => {
    const handlers = await show({ state: { phase: 'victory', outcome: 'win' } });

    expect(screen.queryByText('Attack')).toBeNull();
    expect(screen.getByText('The road remembers this.')).toBeTruthy();

    await fireEvent.press(screen.getByText('Continue'));

    expect(handlers.onDone).toHaveBeenCalled();
  });

  /**
   * GDD 13 §6.3 — the reveal lands on the outcome panel, under **one** Continue rather than one tap
   * per card. Silence here is what M2 shipped, and it announced nothing for a real drop.
   */
  it('announces each drop on the outcome panel', async () => {
    await show({
      state: { phase: 'victory', outcome: 'win' },
      reveals: [
        { defId: 'item_stormveil', name: 'Stormveil', grade: 'uncommon', flavor: 'Bottled weather.' },
        { defId: 'gear_weapon_mortal', name: "Traveller's Blade", grade: 'mortal', flavor: null },
      ],
    });

    expect(screen.getByText('Stormveil')).toBeTruthy();
    expect(screen.getByText('Bottled weather.')).toBeTruthy();
    expect(screen.getByText("Traveller's Blade")).toBeTruthy();
    expect(screen.getAllByText('Continue')).toHaveLength(1);
  });

  it('shows no card at all when the fight dropped nothing', async () => {
    await show({ state: { phase: 'victory', outcome: 'win' } });

    expect(screen.queryByText('mortal')).toBeNull();
    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('renders the combat log, most recent last', async () => {
    await show({
      events: [
        { type: 'move_used', actor: 'player', moveId: 'skill_basic_attack', usesLeft: null },
        hit(1),
      ],
    });

    expect(screen.getByText('You: Basic Attack — 26 damage.')).toBeTruthy();
  });
});

/** GDD 13 §6.1, amended at M5/P7c: who acted, which side, and who goes first. */
describe('the combat log', () => {
  const exchange: BattleEvent[] = [
    { type: 'turn_order_decided', first: 'enemy', reason: 'stride' },
    { type: 'move_used', actor: 'enemy', moveId: 'skill_basic_attack', usesLeft: null },
    incoming(1),
    { type: 'move_used', actor: 'player', moveId: 'skill_basic_attack', usesLeft: null },
    hit(1),
  ];

  it('names the actor on every line and puts each side on its own edge', async () => {
    await show({ events: exchange });

    const theirs = screen.getByText('Harpy: Basic Attack — 26 damage.');
    const mine = screen.getByText('You: Basic Attack — 26 damage.');

    expect(StyleSheet.flatten(theirs.props.style)).toMatchObject({ alignSelf: 'flex-start' });
    expect(StyleSheet.flatten(mine.props.style)).toMatchObject({ alignSelf: 'flex-end' });
  });

  /** The window shows the last four; the rest stay in the log, a scroll away, at full brightness. */
  it('keeps every line of the fight, none of them dimmed', async () => {
    await show({ events: [...exchange, ...exchange, ...exchange] });

    const lines = screen.getAllByText(/^(You|Harpy): Basic Attack/);

    expect(lines).toHaveLength(6);
    lines.forEach((line) => expect(StyleSheet.flatten(line.props.style).color).toBe(colors.text));
  });

  /** Found on the device: the drops and Continue arrived before the killing blow was shown. */
  it('holds the outcome until the final line has landed', async () => {
    jest.useFakeTimers();

    try {
      const props = {
        context: CONTEXT,
        moves: MOVES,
        labels: LABELS,
        traverserName: 'Matthew',
        items: [],
        chevronsUnlocked: true,
        onBegin: jest.fn(),
        onMove: jest.fn(),
        onItem: jest.fn(),
        onFlee: jest.fn(),
        onDone: jest.fn(),
      };

      await render(<BattleScreen {...props} state={stateOf()} events={[]} />);
      await screen.rerender(
        <BattleScreen {...props} state={stateOf({ phase: 'victory', outcome: 'win' })} events={exchange} />,
      );

      expect(screen.queryByText('Continue')).toBeNull();

      // Each line's timer starts once the one before it has rendered.
      await act(async () => jest.advanceTimersByTime(LINE_DELAY_MS));
      expect(screen.queryByText('Continue')).toBeNull();

      await act(async () => jest.advanceTimersByTime(ACTOR_CHANGE_DELAY_MS));
      expect(screen.getByText('Continue')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('says who strikes first before the player chooses', async () => {
    await show({ state: { first: 'enemy', firstReason: 'stride' } });
    expect(screen.getByText('Round 1 · Harpy is faster and strikes first')).toBeTruthy();
  });

  it('says so when the player is first, too', async () => {
    await show({ state: { first: 'player', firstReason: 'stride' } });
    expect(screen.getByText('Round 1 · You are faster and strike first')).toBeTruthy();
  });

  /** Matthew's ask: a pause between the enemy's attack and the reply, and none before the first line. */
  it("pauses longer before the reply, not before the round's first line", async () => {
    jest.useFakeTimers();

    try {
      await render(
        <BattleScreen
          state={stateOf()}
          context={CONTEXT}
          moves={MOVES}
          labels={LABELS}
          traverserName="Matthew"
          events={[]}
          items={[]}
          chevronsUnlocked
          onBegin={jest.fn()}
          onMove={jest.fn()}
          onItem={jest.fn()}
          onFlee={jest.fn()}
          onDone={jest.fn()}
        />,
      );

      await screen.rerender(
        <BattleScreen
          state={stateOf()}
          context={CONTEXT}
          moves={MOVES}
          labels={LABELS}
          traverserName="Matthew"
          events={exchange}
          items={[]}
          chevronsUnlocked
          onBegin={jest.fn()}
          onMove={jest.fn()}
          onItem={jest.fn()}
          onFlee={jest.fn()}
          onDone={jest.fn()}
        />,
      );

      await act(async () => jest.advanceTimersByTime(LINE_DELAY_MS));
      expect(screen.getByText('Harpy: Basic Attack — 26 damage.')).toBeTruthy();

      await act(async () => jest.advanceTimersByTime(LINE_DELAY_MS));
      expect(screen.queryByText('You: Basic Attack — 26 damage.')).toBeNull();

      await act(async () => jest.advanceTimersByTime(ACTOR_CHANGE_DELAY_MS - LINE_DELAY_MS));
      expect(screen.getByText('You: Basic Attack — 26 damage.')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });
});
