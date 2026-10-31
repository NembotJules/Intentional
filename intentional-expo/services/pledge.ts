/**
 * The pledge as words (US-085): the share caption and the "A, B and C" lists used by the card and onboarding.
 * Pure, so it's unit-tested; components/share/PledgeCard.tsx draws the card.
 */
import { APP_LINK } from '@/constants/links';

export interface PledgeData {
  firstName?: string;
  signedOn: Date;
  pillars: { name: string; color: string }[];
  goals: { title: string; deadline: Date | null; color: string }[];
  /** Onboarding's "years back" (half the waking years the drift would cost): the card's hook. */
  yearsBack?: number;
}

/** "12 years" */
export const yearsLabel = (n: number) => `${n} ${n === 1 ? 'year' : 'years'}`;

export const shortDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** "Body", "Body and Mind", "Body, Mind and Craft" */
export function listOf(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Short enough for a chat bubble: the promise, the goals, the link. */
export function pledgeShareText(d: PledgeData): string {
  const to = d.pillars.length ? listOf(d.pillars.map((p) => p.name)) : null;
  const lines = [
    d.yearsBack
      ? `I just signed my pledge: I'm taking back ${yearsLabel(d.yearsBack)} of my life${to ? `, for ${to}` : ''}.`
      : to
        ? `I just signed my pledge: from today, my hours go to ${to}.`
        : 'I just signed my pledge: from today, my hours go to the life I chose.',
  ];
  if (d.goals.length) lines.push(`🎯 ${d.goals.map((g) => (g.deadline ? `${g.title} by ${shortDate(g.deadline)}` : g.title)).join(' · ')}`);
  lines.push(`Make yours → ${APP_LINK}`);
  return lines.join('\n');
}
