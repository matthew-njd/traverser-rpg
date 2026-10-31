/**
 * Spoken temp audio (M6/P7): every audio key says its own cue name, so each trigger can be checked
 * by ear before real sound exists. Music adds a quiet drone after its name, at a pitch of its own,
 * so a crossfade or a duck is audible.
 *
 *   npm run audio:temp     — rewrites every assets/audio/{key}.wav; Windows only (System.Speech)
 *
 * Real sound replaces these key by key, as the art replaced its placeholders.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const appRoot = path.resolve(import.meta.dirname, '..');
const audioDir = path.join(appRoot, 'assets', 'audio');
const RATE = 11025;
const DRONE_SECONDS = 8;

const FAMILY: Record<string, string> = { mus: 'music', stg: 'sting', sfx: '' };

/** `mus_boss_cerberus` → "boss cerberus music"; `sfx_button_tap` → "button tap". */
export function spokenName(key: string): string {
  const [family = '', ...rest] = key.split('_');

  return [...rest, FAMILY[family] ?? ''].filter(Boolean).join(' ');
}

/** The PCM samples of a 16-bit mono WAV, wherever its `data` chunk sits. */
function samples(wav: Buffer): Int16Array {
  let at = 12;

  while (at < wav.length - 8) {
    const id = wav.toString('ascii', at, at + 4);
    const size = wav.readUInt32LE(at + 4);

    if (id === 'data') {
      const data = wav.subarray(at + 8, at + 8 + size);

      return new Int16Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.length));
    }

    at += 8 + size + (size % 2);
  }

  throw new Error('no data chunk');
}

function wav(pcm: Int16Array): Buffer {
  const header = Buffer.alloc(44);

  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.byteLength, 4);
  header.write('WAVEfmt ', 8, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.byteLength, 40);

  return Buffer.concat([header, Buffer.from(pcm.buffer)]);
}

/** A soft fifth at a pitch fixed by the key, faded at both ends so the loop point does not click. */
function drone(key: string): Int16Array {
  const root = 110 + ([...key].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 24) * 5;
  const out = new Int16Array(RATE * DRONE_SECONDS);

  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    const edge = Math.min(1, t / 0.5, (DRONE_SECONDS - t) / 0.5);

    out[i] = Math.round(2500 * edge * (Math.sin(2 * Math.PI * root * t) + 0.6 * Math.sin(2 * Math.PI * root * 1.5 * t)));
  }

  return out;
}

if (process.argv[1] === import.meta.filename) {
  const keys = fs
    .readdirSync(audioDir)
    .filter((file) => file.endsWith('.wav'))
    .map((file) => path.basename(file, '.wav'));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'temp-audio-'));

  // One PowerShell session speaks every name: starting the speech engine per file is slow.
  const lines = keys.map((key) => `${path.join(work, `${key}.wav`)}|${spokenName(key)}`);

  fs.writeFileSync(path.join(work, 'names.txt'), lines.join('\n'));
  execFileSync('powershell', [
    '-NoProfile',
    '-Command',
    `Add-Type -AssemblyName System.Speech;
     $s = New-Object System.Speech.Synthesis.SpeechSynthesizer;
     $f = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(${RATE}, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono);
     foreach ($line in Get-Content '${path.join(work, 'names.txt')}') {
       $parts = $line.Split('|'); $s.SetOutputToWaveFile($parts[0], $f); $s.Speak($parts[1]);
     }
     $s.SetOutputToNull()`,
  ]);

  for (const key of keys) {
    const voice = samples(fs.readFileSync(path.join(work, `${key}.wav`)));
    const pcm = key.startsWith('mus_') ? Int16Array.from([...voice, ...drone(key)]) : voice;

    fs.writeFileSync(path.join(audioDir, `${key}.wav`), wav(pcm));
  }

  fs.rmSync(work, { recursive: true, force: true });
  console.log(`temp-audio: ${keys.length} cues spoken`);
}
