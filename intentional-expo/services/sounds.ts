/**
 * US-129 · Celebration jingles: every "congratulations" moment plays a short piece of music (composed for the app,
 * scripts/build-sounds.py → assets/sounds/).
 *
 *   promise    onboarding: "Congratulations, <name>! You just made a promise to yourself."
 *   stage      Flick reaches a new stage           world      a new world unlocked
 *   milestone  an hours milestone                  session    a focus session completed
 *
 * Polite by default: it follows the phone's silent switch (iOS), lowers other audio for a moment instead of stopping
 * it, and Settings → "Celebration sounds" turns it off (setting `celebration_sounds` = '0').
 * expo-audio is loaded lazily, so a missing native module (an old dev build) or a blocked web autoplay is just silence.
 */
export type Jingle = 'promise' | 'stage' | 'world' | 'milestone' | 'session';

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
  })[name];
const readSetting = (key: string): string | null | undefined => require('@/db').getSetting(key);

type Player = { play: () => void; remove: () => void; addListener?: (e: string, fn: (s: { didJustFinish?: boolean }) => void) => { remove: () => void } };
let audio: { createAudioPlayer: (src: number) => Player; setAudioModeAsync: (m: object) => Promise<void> } | null | undefined;
let current: Player | null = null;

function loadAudio() {
  if (audio !== undefined) return audio;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    audio = require('expo-audio');
    void audio!.setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'duckOthers', shouldPlayInBackground: false }).catch(() => {});
  } catch {
    audio = null;
  }
  return audio;
}

/** Plays a jingle (stopping one that's still playing). Never throws. */
export function playJingle(name: Jingle): void {
  if (!soundsEnabled(readSetting)) return;
  // the web e2e checks which jingle played (it can't hear it)
  const g = globalThis as { __jingles?: string[] };
  (g.__jingles ??= []).push(name);
  const a = loadAudio();
  if (!a) return;
  try {
    current?.remove();
    const p = a.createAudioPlayer(source(name));
    current = p;
    const sub = p.addListener?.('playbackStatusUpdate', (s) => {
      if (!s.didJustFinish) return;
      sub?.remove();
      p.remove();
      if (current === p) current = null;
    });
    p.play();
  } catch {
    // no sound is fine
  }
}
