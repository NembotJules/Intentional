/**
 * Keyboard sound for the onboarding typewriter: one looping clip of key clicks that plays while text types.
 * A single start/stop per line — firing a sound per letter floods the native audio player and stalls the UI.
 * Mixes with the person's music and respects the silent switch. Fails silently anywhere audio is unavailable.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

let player: AudioPlayer | null | undefined;
/** How many typewriters are running right now (lines can overlap during screen transitions). */
let active = 0;

function getPlayer(): AudioPlayer | null {
  if (player !== undefined) return player;
  try {
    void setAudioModeAsync({ interruptionMode: 'mixWithOthers', playsInSilentMode: false }).catch(() => {});
    player = createAudioPlayer(require('@/assets/sounds/typing.wav'));
    player.loop = true;
    player.volume = 0.45;
  } catch {
    player = null;
  }
  return player;
}

/** Load the clip ahead of time so the first line isn't silent. */
export function preloadTypeSound(): void {
  getPlayer();
}

export function startTypingSound(): void {
  active += 1;
  if (active > 1) return;
  const p = getPlayer();
  if (!p) return;
  try {
    p.play();
  } catch {
    /* ignore */
  }
}

export function stopTypingSound(): void {
  if (active === 0) return;
  active -= 1;
  if (active > 0) return;
  const p = getPlayer();
  if (!p) return;
  try {
    p.pause();
    void p.seekTo(0);
  } catch {
    /* ignore */
  }
}
