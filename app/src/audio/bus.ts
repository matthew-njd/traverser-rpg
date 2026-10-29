import { type AudioPlayer, createAudioPlayer } from 'expo-audio';

import type { MusicKey, SfxKey, StingKey } from '../assets/keys.generated';
import { AUDIO } from '../assets/registry.generated';
import type { AudioSettings } from '../sync/mirror';
import { DUCK, FADE_MS, LAYERED, arbitrate, stingRank } from './cues';

/**
 * tech-04 §10's audio bus — a module, not a component, so `mus_hub` survives every tab switch
 * (GDD 14 §3.1). Routes and battle events ask it for things; it does nothing when asked for the
 * track that is already playing.
 *
 * Every player's volume is `envelope × duck × bucket`, and a duck never writes a bucket (§10.1).
 */

interface Voice {
  readonly key: MusicKey;
  readonly player: AudioPlayer;
  level: number;
  ramp: Ramp | null;
}

interface Sting {
  readonly key: StingKey;
  readonly player: AudioPlayer;
  readonly subscription: { remove(): void };
  readonly onEnd: (() => void) | undefined;
}

interface Ramp {
  cancel(): void;
  finish(): void;
}

let settings: AudioSettings = { music: 1, sfx: 1, muted: false };
let music: Voice | null = null;
const outgoing = new Set<Voice>();
let duck = 1;
let duckRamp: Ramp | null = null;
let sting: Sting | null = null;
let queue: StingKey[] = [];
let tailTimer: ReturnType<typeof setTimeout> | null = null;
/** One warm player per effect, restarted on each play (tech-04 §10.3). */
const effects = new Map<SfxKey, AudioPlayer>();
/** The track a fled or cancelled battle hands back to (GDD 14 §5.3). */
let battle: { readonly resumeTo: MusicKey | null } | null = null;
const ramps = new Set<Ramp>();

const gain = (bucket: number) => (settings.muted ? 0 : bucket);

function applyVoice(voice: Voice): void {
  voice.player.volume = voice.level * duck * gain(settings.music);
}

function applyMusic(): void {
  if (music !== null) {
    applyVoice(music);
  }

  outgoing.forEach(applyVoice);
}

/**
 * Loudness is not linear in gain, so neither is a fade (GDD 14 §5.1, amended 2026-10-28). Between
 * two audible levels the ramp is straight in decibels; to or from silence it follows a quarter sine,
 * and a crossfade's two halves then sum to constant power instead of dipping in the middle.
 */
export function fadeShape(from: number, to: number, t: number): number {
  if (from > 0 && to > 0) {
    return from * Math.pow(to / from, t);
  }

  return to > from ? from + (to - from) * Math.sin((t * Math.PI) / 2) : to + (from - to) * Math.cos((t * Math.PI) / 2);
}

/**
 * ↯ tech-04 §10.2: no Web Audio, so no `linearRampToValueAtTime`. Every GDD 14 §5 timing is this
 * loop driving `volume`, and `finish` lands exactly on the target so no fade strands a player at 0.97.
 */
function ramp(from: number, to: number, ms: number, apply: (value: number) => void, done?: () => void): Ramp {
  const start = Date.now();
  let frame: number | null = null;

  const self: Ramp = {
    cancel() {
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }

      ramps.delete(self);
    },
    finish() {
      self.cancel();
      apply(to);
      done?.();
    },
  };

  const tick = () => {
    const t = ms <= 0 ? 1 : (Date.now() - start) / ms;

    if (t >= 1) {
      self.finish();
      return;
    }

    apply(fadeShape(from, to, t));
    frame = requestAnimationFrame(tick);
  };

  ramps.add(self);
  tick();

  return self;
}

function fadeVoice(voice: Voice, to: number, ms: number, done?: () => void): void {
  voice.ramp?.cancel();
  voice.ramp = ramp(voice.level, to, ms, (value) => {
    voice.level = value;
    applyVoice(voice);
  }, done);
}

function setDuck(to: number, ms: number): void {
  duckRamp?.cancel();
  duckRamp = ramp(duck, to, ms, (value) => {
    duck = value;
    applyMusic();
  });
}

function start(key: MusicKey, ms: number): void {
  const player = createAudioPlayer(AUDIO[key]);
  const voice: Voice = { key, player, level: ms <= 0 ? 1 : 0, ramp: null };

  // T4 §10.5: the whole file loops, intro included, until real assets say otherwise.
  player.loop = true;
  applyVoice(voice);
  player.play();
  music = voice;

  if (ms > 0) {
    fadeVoice(voice, 1, ms);
  }
}

/** Fades the current track out and releases it, then runs `then`. */
function retire(ms: number, then?: () => void): void {
  const voice = music;

  if (voice === null) {
    then?.();
    return;
  }

  music = null;
  outgoing.add(voice);
  fadeVoice(voice, 0, ms, () => {
    voice.player.remove();
    outgoing.delete(voice);
    then?.();
  });
}

/** Mirrors GDD 13 §7's Audio row onto every live player. */
export function configureAudio(next: AudioSettings): void {
  settings = next;
  applyMusic();

  if (sting !== null) {
    sting.player.volume = gain(settings.sfx);
  }

  effects.forEach((player) => {
    player.volume = gain(settings.sfx);
  });
}

/**
 * GDD 14 §6. A replay of an effect still sounding restarts it rather than stacking a second voice,
 * which is what keeps a burst of taps from turning into a smear.
 */
export function playSfx(key: SfxKey): void {
  let player = effects.get(key);

  if (player === undefined) {
    player = createAudioPlayer(AUDIO[key]);
    effects.set(key, player);
  }

  player.volume = gain(settings.sfx);
  void player.seekTo(0);
  player.play();
}

/** GDD 14 §5.1's crossfade by default. Null is silence; the playing track is a no-op. */
export function playMusic(key: MusicKey | null, ms: number = FADE_MS.crossfade): void {
  if ((music?.key ?? null) === key) {
    return;
  }

  retire(ms);

  if (key !== null) {
    start(key, ms);
  }
}

/**
 * GDD 14 §5.2. A boss ducks the world to 20% under `stg_boss_intro`, then hard-cuts to its theme
 * when the flourish ends; anything else fades across in half a second. A resumed fight that is
 * already scored is left alone.
 */
export function enterBattle(track: MusicKey | null, boss: boolean): void {
  if (battle !== null) {
    return;
  }

  const entered = { resumeTo: music?.key ?? null };

  battle = entered;

  if (!boss) {
    playMusic(track, FADE_MS.wildEntry);
    return;
  }

  setDuck(DUCK.battle, FADE_MS.battleDuck);
  playSting('stg_boss_intro', () => {
    // A boss cancelled during its intro is left, and must not be scored on the way out.
    if (battle !== entered) {
      return;
    }

    duckRamp?.cancel();
    duck = 1;
    music?.player.remove();
    music = null;

    if (track !== null) {
      start(track, 0);
    }
  });
}

/**
 * GDD 14 §5.3. Victory cuts to its fanfare alone; defeat fades slowly into a soft phrase; a flee,
 * or a fight cancelled before it began, fades straight back to what was playing before.
 */
export function exitBattle(outcome: 'win' | 'loss' | 'flee', finalBoss: boolean): void {
  if (battle === null) {
    return;
  }

  const { resumeTo } = battle;

  battle = null;
  setDuck(1, 0);

  switch (outcome) {
    case 'win':
      playMusic(null, 0);
      playSting(finalBoss ? 'stg_victory_boss' : 'stg_victory');
      break;
    case 'loss':
      retire(FADE_MS.defeat, () => playSting('stg_defeat'));
      break;
    case 'flee':
      playMusic(resumeTo, FADE_MS.flee);
      break;
  }
}

/** GDD 14 §5.5 decides whether this plays now, waits its turn, or is dropped. */
export function playSting(key: StingKey, onEnd?: () => void): void {
  // §6.4 — the card's flip is the presentation itself, so it sounds even when its sting waits.
  if (key.startsWith('stg_reveal_')) {
    playSfx('sfx_reveal_card_flip');
  }

  const verdict = arbitrate(sting?.key ?? null, key);

  if (verdict === 'drop') {
    return;
  }

  if (verdict === 'queue') {
    queue = [...queue, key].sort((a, b) => stingRank(a) - stingRank(b));
    return;
  }

  endSting(false);

  const player = createAudioPlayer(AUDIO[key]);
  const subscription = player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) {
      endSting(true);
    }
  });

  if (LAYERED.has(key)) {
    if (tailTimer !== null) {
      clearTimeout(tailTimer);
      tailTimer = null;
    }

    setDuck(DUCK.sting, 0);
  }

  player.volume = gain(settings.sfx);
  sting = { key, player, subscription, onEnd };
  player.play();
}

function endSting(dequeue: boolean): void {
  const ended = sting;

  if (ended === null) {
    return;
  }

  sting = null;
  ended.subscription.remove();
  ended.player.remove();

  // §5.4: the duck holds for the sting plus 0.2 seconds, then the music is back at full.
  if (LAYERED.has(ended.key)) {
    tailTimer = setTimeout(() => {
      tailTimer = null;
      setDuck(1, 0);
    }, FADE_MS.stingTail);
  }

  ended.onEnd?.();

  const next = queue[0];

  if (dequeue && next !== undefined) {
    queue = queue.slice(1);
    playSting(next);
  }
}

/**
 * Backgrounding (tech-04 §7.2) snaps every fade to its target and drops the stings, rather than
 * resuming any of it on an elapsed-time guess. A boss intro cut short still hands over to the theme.
 */
export function suspendAudio(): void {
  queue = [];
  endSting(false);

  if (tailTimer !== null) {
    clearTimeout(tailTimer);
    tailTimer = null;
    setDuck(1, 0);
  }

  [...ramps].forEach((pending) => pending.finish());
  music?.player.pause();
  effects.forEach((player) => player.pause());
}

export function resumeAudio(): void {
  music?.player.play();
}
