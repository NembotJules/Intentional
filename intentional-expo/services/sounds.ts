/**
 * US-129 · Celebration jingles: every "congratulations" moment plays a short piece of music (composed for the app,
 * scripts/build-sounds.py → assets/sounds/).
 *
 *   promise    onboarding: "Congratulations, <name>! You just made a promise to yourself."
 *   stage      Flick reaches a new stage           world      a new world unlocked
 *   milestone  an hours milestone                  session    a focus session completed
 *   streak     the streak count screen (US-131)
 *
 * Polite by default: it follows the phone's silent switch (iOS), lowers other audio for a moment instead of stopping
 * it, and Settings → "Celebration sounds" turns it off (setting `celebration_sounds` = '0').
 * expo-audio is loaded lazily, so a missing native module (an old dev build) or a blocked web autoplay is just silence.
 */
export type Jingle = 'promise' | 'stage' | 'world' | 'milestone' | 'session' | 'streak';

export const SOUNDS_SETTING = 'celebration_sounds';

/** On unless turned off in Settings. */
export function soundsEnabled(read: (key: string) => string | null | undefined): boolean {
  try {
    return read(SOUNDS_SETTING) !== '0';
  } catch {
    return true;
  }
}

// (required lazily: the unit tests run in plain Node, which can't load audio files or the database)
const source = (name: Jingle): number =>
  ({
    promise: require('@/assets/sounds/promise.m4a'),
    stage: require('@/assets/sounds/stage.m4a'),
    world: require('@/assets/sounds/world.m4a'),
    milestone: require('@/assets/sounds/milestone.m4a'),
    session: require('@/assets/sounds/session.m4a'),
    streak: require('@/assets/sounds/streak.m4a'),
  })[name];
const readSetting = (key: string): string | null | undefined => require('@/db').getSetting(key);

type Player = { play: () => void; pause: () => void; seekTo: (seconds: number) => Promise<void> | void; remove: () => void };
type AudioModule = { createAudioPlayer: (src: number) => Player; setAudioModeAsync: (m: object) => Promise<void> };
let audio: AudioModule | null | undefined;
let ready: Promise<void> | null = null;
const players: Partial<Record<Jingle, Player>> = {};
const ALL: Jingle[] = ['promise', 'stage', 'world', 'milestone', 'session', 'streak'];

function loadAudio(): AudioModule | null {
  if (audio !== undefined) return audio;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    audio = require('expo-audio') as AudioModule;
  } catch {
    audio = null;
  }
  return audio;
}

/**
 * US-130 · Sets the audio session up once and loads every jingle ahead of time (call at app start), so a jingle starts
 * the instant its moment comes. Plays in silent mode (founder 2026-11-12: the music wasn't heard with the phone on
 * silent): turning it off is Settings → "Celebration sounds". Other audio is ducked for a moment, not stopped.
 */
export function warmUpSounds(): Promise<void> {
  if (ready) return ready;
  const a = loadAudio();
  if (!a) return (ready = Promise.resolve());
  ready = a
    .setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers', shouldPlayInBackground: false, allowsRecording: false })
    .catch(() => {})
    .then(() => {
      for (const name of ALL) {
        try {
          players[name] ??= a.createAudioPlayer(source(name));
        } catch {
          // that one stays silent
        }
      }
    });
  return ready;
}

/** Plays a jingle from the start (stopping one that's still playing). Never throws. */
export function playJingle(name: Jingle): void {
  if (!soundsEnabled(readSetting)) return;
  // the web e2e checks which jingle played (it can't hear it)
  const g = globalThis as { __jingles?: string[] };
  (g.__jingles ??= []).push(name);
  void warmUpSounds().then(async () => {
    const p = players[name];
    if (!p) return;
    try {
      for (const other of ALL) if (other !== name) players[other]?.pause();
      await p.seekTo(0);
      p.play();
    } catch {
      // no sound is fine
    }
  });
}
