import { readBestiary } from '../battle/mirror';
import { TUTORIAL_ENEMY_ID } from '../battle/session';
import type { BattleState } from '../battle/state';
import type { SqliteDatabase } from '../db/types';

/**
 * GDD 10 §6.4's battle script, as data.
 *
 * ↯ **The script is a UI layer over the ordinary engine, not a second code path** (T5 §7.4, M2 plan
 * §3.4). Nothing here computes damage or decides an outcome — it chooses which line of copy to show
 * and which action is offered, and the fight underneath is `step` with crit, variance and the type
 * chart switched off. Scripting the five turns directly against fixtures §3 would produce a
 * passing tutorial that proves nothing about the engine it is meant to introduce.
 */

export interface TutorialBeat {
  /** The tooltip earned by what just happened, or null on the opening round. */
  readonly note: string | null;
  /** What to do now. GDD 10 §6.4's own wording where it gives any. */
  readonly prompt: string;
  /**
   * Round 3 demonstrates the Item action, and Attack is withheld to make sure it happens: the Wisp
   * sits at 3 Vigor against a 6-damage hit, so an attack here would end the fight a round early and
   * the player would never see an item used. §6.4's "without letting the player wander off-script".
   */
  readonly attackEnabled: boolean;
}

const BEATS: readonly TutorialBeat[] = [
  { note: null, prompt: 'Tap Attack to strike first.', attackEnabled: true },
  {
    note: "That's your Vigor — it's your health. Keep an eye on it.",
    prompt: 'Attack again.',
    attackEnabled: true,
  },
  {
    note: "Taken a couple of hits? Let's patch up — open your Items.",
    prompt: 'Use a Traveler’s Salve.',
    attackEnabled: false,
  },
  { note: null, prompt: 'Finish it!', attackEnabled: true },
];

/** GDD 10 §6.4 — visibly present, greyed out, and it says why when tapped. */
export const SKILL_LOCKED_NOTE = 'Skills unlock at Level 4.';

/** §6.4 again. The reassurance is the point: this fight is not one the player can lose. */
export const FLEE_LOCKED_NOTE = "You can't flee this fight — it's perfectly safe.";

export const ITEM_ONLY_NOTE = 'Not this round — the Salve is what you need.';

/** §6.5's acknowledgment, and the whole of Screen 7's copy. */
export const VICTORY_LINE = 'The road remembers this. Onward.';

/**
 * The beat for the round the player is about to act in.
 *
 * Returns null once the fight is over, and once past the scripted rounds — the script is four
 * beats and the battle is four rounds, but a beat is looked up rather than asserted, so a future
 * content change that lengthens the fight degrades to no prompt rather than to a crash.
 */
export function beatFor(state: BattleState): TutorialBeat | null {
  if (state.outcome !== null || state.phase !== 'await_player') {
    return null;
  }

  return BEATS[state.round - 1] ?? null;
}

export const TUTORIAL_BEATS = BEATS;

/**
 * Whether onboarding is finished — the flag the boot router needed once GDD 10 screens 5–7 landed
 * after naming, since registration alone stopped meaning "done".
 *
 * ↯ Read from the **bestiary**, not from `player.tutorial_completed_at`. That column is the server's
 * and is set when the battle syncs (T2 §4 step 2) — but the API is off between sessions by design
 * (tech-02 §1.2), so a player who fought the tutorial offline would be walked back through it on
 * every cold start until the server saw it. The bestiary row is written locally in the same
 * transaction that queues the battle, so it is true the instant the fight ends.
 *
 * The server's column is still honoured: a restored profile that has completed the tutorial on
 * other hardware carries it and no bestiary row, and must not be made to fight the Wisp again.
 */
export function hasFinishedTutorial(db: SqliteDatabase): boolean {
  const completed = db.getFirstSync<{ tutorial_completed_at: string | null }>(
    'SELECT tutorial_completed_at FROM player WHERE one_row = 1',
  );

  if (completed?.tutorial_completed_at != null) {
    return true;
  }

  return readBestiary(db, TUTORIAL_ENEMY_ID).encounterCount > 0;
}
