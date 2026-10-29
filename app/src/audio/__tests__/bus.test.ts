import type { FakePlayer } from '../../../__mocks__/expo-audio';
import type { AudioKey } from '../../assets/keys.generated';

/**
 * The bus holds module state, so each test takes a fresh copy of it and of the mock's player list.
 * Timers are fake because every fade is a `requestAnimationFrame` loop.
 *
 * Jest resolves every asset `require` to the same `1`, so the registry is replaced with one whose
 * source *is* the key — otherwise no assertion here could tell one player from another.
 */
let bus: typeof import('../bus');
let players: FakePlayer[];

beforeEach(() => {
  jest.useFakeTimers();
  jest.resetModules();
  jest.doMock('../../assets/registry.generated', () => ({
    AUDIO: new Proxy({}, { get: (_target, key) => key, has: () => true }),
  }));
  bus = require('../bus');
  players = require('expo-audio').players;
});

afterEach(() => {
  jest.useRealTimers();
});

const live = (key: AudioKey) => players.filter((player) => player.source === key && !player.removed);
const only = (key: AudioKey) => {
  const found = live(key);

  expect(found).toHaveLength(1);

  return found[0] as FakePlayer;
};

describe('music', () => {
  it('does nothing when asked for the track already playing — the hub survives a tab switch', () => {
    bus.playMusic('mus_hub');
    bus.playMusic('mus_hub');

    expect(players).toHaveLength(1);
  });

  it('crossfades over 0.8 seconds and releases the outgoing player', () => {
    bus.playMusic('mus_hub', 0);
    bus.playMusic('mus_map_olympion');

    jest.advanceTimersByTime(400);
    expect(only('mus_hub').volume).toBeGreaterThan(0);

    jest.advanceTimersByTime(500);
    expect(live('mus_hub')).toHaveLength(0);
    expect(only('mus_map_olympion').volume).toBe(1);
    expect(only('mus_map_olympion').loop).toBe(true);
  });
});

describe('volume buckets', () => {
  it('mutes only its own bucket at zero', () => {
    bus.playMusic('mus_hub', 0);
    bus.playSting('stg_rest_day');
    bus.configureAudio({ music: 0, sfx: 0.5, muted: false });

    expect(only('mus_hub').volume).toBe(0);
    expect(only('stg_rest_day').volume).toBe(0.5);
  });

  it('silences both under Mute All and restores the sliders without restarting the track', () => {
    bus.playMusic('mus_hub', 0);
    const hub = only('mus_hub');

    bus.configureAudio({ music: 0.7, sfx: 1, muted: true });
    expect(hub.volume).toBe(0);

    bus.configureAudio({ music: 0.7, sfx: 1, muted: false });
    expect(hub.volume).toBeCloseTo(0.7);
    expect(players).toHaveLength(1);
  });

  it('never writes a duck into the bucket (tech-04 §10.1)', () => {
    bus.playMusic('mus_hub', 0);
    bus.playSting('stg_reveal_1');
    expect(only('mus_hub').volume).toBeCloseTo(0.6);

    // A slider moved mid-duck: the duck still lifts, and lands on the new setting.
    bus.configureAudio({ music: 0.5, sfx: 1, muted: false });
    only('stg_reveal_1').finish();
    jest.advanceTimersByTime(250);

    expect(only('mus_hub').volume).toBeCloseTo(0.5);
  });
});

describe('stings', () => {
  it('holds a Reveal until the victory fanfare ends, then plays it', () => {
    bus.playSting('stg_victory');
    bus.playSting('stg_reveal_3');
    expect(live('stg_reveal_3')).toHaveLength(0);

    only('stg_victory').finish();
    expect(only('stg_reveal_3').playing).toBe(true);
  });

  it('drops a type callout that arrives under a higher sting', () => {
    bus.playSting('stg_victory');
    bus.playSting('stg_type_super');
    only('stg_victory').finish();

    expect(live('stg_type_super')).toHaveLength(0);
  });
});

describe('battle', () => {
  it('ducks to 20% under a boss intro and cuts to the boss theme only when it ends', () => {
    bus.playMusic('mus_map_olympion', 0);
    bus.enterBattle('mus_boss_cyclops', true);
    jest.advanceTimersByTime(300);

    expect(only('mus_map_olympion').volume).toBeCloseTo(0.2);
    expect(live('mus_boss_cyclops')).toHaveLength(0);

    only('stg_boss_intro').finish();

    expect(live('mus_map_olympion')).toHaveLength(0);
    expect(only('mus_boss_cyclops').volume).toBe(1);
  });

  it('hands a fled fight back to the track that was playing before it', () => {
    bus.playMusic('mus_map_valheon', 0);
    bus.enterBattle('mus_battle_valheon', false);
    jest.advanceTimersByTime(600);

    bus.exitBattle('flee', false);
    jest.advanceTimersByTime(600);

    expect(live('mus_battle_valheon')).toHaveLength(0);
    expect(only('mus_map_valheon').volume).toBe(1);
  });

  it('cuts to the fanfare alone on a win, and the grand one for a final boss', () => {
    bus.playMusic('mus_boss_cerberus', 0);
    bus.enterBattle('mus_boss_cerberus', false);
    bus.exitBattle('win', true);

    expect(live('mus_boss_cerberus')).toHaveLength(0);
    expect(only('stg_victory_boss').playing).toBe(true);
  });

  it('fades for a second and a half before the defeat phrase', () => {
    bus.enterBattle('mus_battle_olympion', false);
    jest.advanceTimersByTime(600);
    bus.exitBattle('loss', false);

    jest.advanceTimersByTime(1000);
    expect(live('stg_defeat')).toHaveLength(0);

    jest.advanceTimersByTime(600);
    expect(only('stg_defeat').playing).toBe(true);
  });

  it('scores a fight once, however often the screen asks', () => {
    bus.enterBattle('mus_battle_olympion', false);
    bus.enterBattle('mus_battle_olympion', false);
    bus.exitBattle('win', false);
    bus.exitBattle('win', false);

    expect(players.filter((player) => player.source === 'stg_victory')).toHaveLength(1);
  });
});

it('snaps a fade and hands a cut-short boss intro to its theme on background (tech-04 §7.2)', () => {
  bus.playMusic('mus_map_olympion', 0);
  bus.enterBattle('mus_boss_fenrir', true);
  bus.suspendAudio();

  expect(live('stg_boss_intro')).toHaveLength(0);
  expect(only('mus_boss_fenrir').playing).toBe(false);

  bus.resumeAudio();
  expect(only('mus_boss_fenrir').playing).toBe(true);
});

it('replays an effect on its one warm player, at the effects volume (tech-04 §10.3)', () => {
  bus.configureAudio({ music: 1, sfx: 0.3, muted: false });
  bus.playSfx('sfx_button_tap');
  bus.playSfx('sfx_button_tap');

  expect(only('sfx_button_tap').volume).toBeCloseTo(0.3);

  bus.configureAudio({ music: 1, sfx: 0.3, muted: true });
  expect(only('sfx_button_tap').volume).toBe(0);
});

describe('fade shape (GDD 14 §5.1, amended 2026-10-28)', () => {
  it('holds constant power through a crossfade', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const power = bus.fadeShape(1, 0, t) ** 2 + bus.fadeShape(0, 1, t) ** 2;

      expect(power).toBeCloseTo(1);
    }
  });

  it('ducks in a straight line of decibels', () => {
    // Halfway from 1.0 to 0.2 is half of −14 dB, not the linear 0.6.
    expect(20 * Math.log10(bus.fadeShape(1, 0.2, 0.5))).toBeCloseTo((20 * Math.log10(0.2)) / 2);
  });
});
