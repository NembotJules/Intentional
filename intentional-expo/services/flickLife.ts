/**
 * US-097 · Flick comes alive. What Flick feels and says on Today, from what the day holds.
 * Pure: Today gives it the facts, `LiveFlick` shows the mood and the lines (one per tap).
 *
 * Tone: a friend who's on your side. Never guilt for opening the app, never fake urgency;
 * the nudges are about the hours you said you'd give.
 */
import type { MascotMood } from '@/components/onboarding/Mascot';

export interface FlickDay {
  /** 0–23, the phone's clock. */
  hour: number;
  userName?: string | null;
  minutesToday: number;
  /** Every habit due today is done (and there was at least one). */
  allDone: boolean;
  /** Pillars that got no minute today (names, in pillar order). */
  pillarsAtZero: string[];
  /** The next habit still to do today, if any ("Gym", "18:00"). */
  nextHabit: { name: string; time: string | null } | null;
  stageName: string;
  /** "9h to Flame", or null at the last stage. */
  toNextStage: string | null;
}

/** Night → sleepy; all done → proud; nothing given by the evening → worried; nothing yet → calm; else happy. */
export function flickMoodOfDay(d: Pick<FlickDay, 'hour' | 'minutesToday' | 'allDone'>): MascotMood {
  if (d.hour >= 23 || d.hour < 5) return 'sleepy';
  if (d.allDone) return 'proud';
  if (d.minutesToday <= 0) return d.hour >= 17 ? 'worried' : 'calm';
  return 'happy';
}

/** A greeting by the time of day. */
export function greetingFor(hour: number, name?: string | null): string {
  const who = name?.trim() ? `, ${name.trim()}` : '';
  if (hour >= 23 || hour < 5) return `Still up${who}? I’m half asleep.`;
  if (hour < 12) return `Good morning${who}!`;
  if (hour < 18) return `Hey${who}!`;
  return `Good evening${who}.`;
}

function minutesShort(m: number): string {
  const v = Math.max(0, Math.round(m));
  if (v < 60) return `${v} min`;
  return v % 60 ? `${Math.floor(v / 60)}h ${v % 60}m` : `${v / 60}h`;
}

/** What Flick says, in order; each tap shows the next one (and wraps around). Never empty. */
export function flickLines(d: FlickDay): string[] {
  const lines: string[] = [greetingFor(d.hour, d.userName)];
  const night = d.hour >= 23 || d.hour < 5;
  if (d.allDone) {
    lines.push('Everything done today. I’m glowing!');
    if (d.minutesToday > 0) lines.push(`${minutesShort(d.minutesToday)} given today. That’s what makes me grow.`);
  } else {
    if (d.minutesToday > 0) lines.push(`${minutesShort(d.minutesToday)} given today. I can feel it.`);
    if (d.nextHabit) lines.push(d.nextHabit.time ? `${d.nextHabit.name} at ${d.nextHabit.time}. I’ll be ready.` : `${d.nextHabit.name} is still waiting for us.`);
    const zero = d.pillarsAtZero[0];
    if (zero && !night) lines.push(d.minutesToday > 0 ? `${zero} hasn’t had a minute yet today.` : `Nothing given yet. ${zero} would love ten minutes.`);
    if (night) lines.push('Tomorrow’s a fresh day. Sleep is good for flames too.');
  }
  lines.push(d.toNextStage ? `I’m a ${d.stageName}. ${d.toNextStage}.` : `I’m a ${d.stageName}. As bright as I get!`);
  return lines;
}

/** Tap n (0-based) → the line to show. */
export function lineAt(lines: string[], n: number): string {
  if (!lines.length) return '';
  return lines[((n % lines.length) + lines.length) % lines.length]!;
}
