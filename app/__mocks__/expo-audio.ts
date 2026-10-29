/**
 * Picked up for every test without a `jest.mock` call — a root `__mocks__` beside `node_modules`
 * replaces the package. The native module does not exist under Jest, and every screen that reaches
 * the audio bus would otherwise fail to import.
 */
export interface FakePlayer {
  readonly source: unknown;
  volume: number;
  loop: boolean;
  playing: boolean;
  removed: boolean;
  play(): void;
  pause(): void;
  remove(): void;
  addListener(event: string, listener: (status: { didJustFinish: boolean }) => void): { remove(): void };
  /** Test-only: what the native side reports when a non-looping file reaches its end. */
  finish(): void;
}

export const players: FakePlayer[] = [];

export function createAudioPlayer(source: unknown): FakePlayer {
  const listeners = new Set<(status: { didJustFinish: boolean }) => void>();
  const player: FakePlayer = {
    source,
    volume: 1,
    loop: false,
    playing: false,
    removed: false,
    play() {
      player.playing = true;
    },
    pause() {
      player.playing = false;
    },
    remove() {
      player.playing = false;
      player.removed = true;
      listeners.clear();
    },
    addListener(_event, listener) {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
    finish() {
      player.playing = false;
      [...listeners].forEach((listener) => listener({ didJustFinish: true }));
    },
  };

  players.push(player);

  return player;
}

export async function setAudioModeAsync(): Promise<void> {}
