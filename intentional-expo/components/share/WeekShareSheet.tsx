/**
 * "Share your week" / "Send your week to <partner>": loads the week, shows the card, sends it,
 * and records the week as sent to the partner.
 */
import { useEffect, useState } from 'react';
import * as api from '@/db/api';
import { ShareCardSheet } from '@/components/share/ShareCardSheet';
import { WeekCard, WEEK_CARD_H, WEEK_CARD_W } from '@/components/share/WeekCard';
import { getPartner, markWeekSent, reportWeek, type Partner } from '@/services/partner';
import { weekText, type WeekSummary } from '@/services/weekSummary';

export function WeekShareSheet({
  visible,
  onClose,
  weekStart,
  toPartner = true,
  onSent,
}: {
  visible: boolean;
  onClose: () => void;
  /** Monday of the week to share (default: this week). */
  weekStart?: string;
  /** False: a public share (no partner greeting, nothing recorded). */
  toPartner?: boolean;
  onSent?: () => void;
}) {
  const [summary, setSummary] = useState<WeekSummary | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const userName = api.getSetting('user_name')?.trim() || undefined;

  useEffect(() => {
    if (!visible) return;
    let live = true;
    setPartner(toPartner ? getPartner() : null);
    void api.getWeekSummary(weekStart).then((s) => {
      if (live) setSummary(s);
    });
    return () => {
      live = false;
    };
  }, [visible, weekStart, toPartner]);

  if (!summary) return null;
  const message = weekText(summary, { userName, partnerName: partner?.name });
  return (
    <ShareCardSheet
      visible={visible}
      onClose={onClose}
      title={partner ? `Send your week to ${partner.name}` : 'Share your week'}
      sub={partner ? 'Your card and a short summary. Hours only: no task names, no notes.' : 'Hours only: no task names, no notes. Safe to post anywhere.'}
      cardWidth={WEEK_CARD_W}
      cardHeight={WEEK_CARD_H}
      renderCard={(theme) => <WeekCard summary={summary} theme={theme} userName={userName} />}
      message={message}
      partner={partner}
      onSent={() => {
        // Only the week that's due counts as "sent" (a mid-week "so far" share doesn't).
        if (partner && summary.weekStart === reportWeek().weekStart) markWeekSent(summary.weekStart);
        onSent?.();
      }}
    />
  );
}
