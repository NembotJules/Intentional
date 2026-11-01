/**
 * US-089 · The Backup card on the Account screen (signed in).
 *
 * - This phone has synced with the account: "Backed up 2 min ago", Back up now, Restore from your account.
 * - A new phone and the account has a backup: "Restore my data" first, or keep this phone's data and back it up too.
 * - The account has nothing yet: the first backup runs right away.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CTA } from '@/components/onboarding/parts';
import { Accent, FontFamily, Surface, Type } from '@/constants/design';
import { backupNow, getBackupInfo, lastBackupAt, phoneIsEmpty, restoreFromAccount, syncedWith } from '@/services/backup';
import { confirmAsync } from '@/utils/confirm';
import { hapticSuccess } from '@/utils/haptics';

/** "just now", "2 min ago", "3 h ago", "Mon 4 Nov". */
export function agoLabel(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'not yet';
  const ms = now.getTime() - Date.parse(iso);
  if (!Number.isFinite(ms)) return 'not yet';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function BackupCard({ userId, onRestored }: { userId: string; onRestored: () => void }) {
  const [info, setInfo] = useState<{ pillars: number; sessions: number; lastBackup: string | null } | null>(null);
  const [last, setLast] = useState<string | null>(lastBackupAt());
  const [busy, setBusy] = useState<null | 'backup' | 'restore'>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const synced = syncedWith(userId);

  const refresh = useCallback(async () => {
    try {
      const i = await getBackupInfo();
      setInfo(i);
      return i;
    } catch {
      setError('Couldn’t reach your account. Your data is safe on this phone.');
      return null;
    }
  }, []);

  const doBackup = useCallback(async () => {
    setBusy('backup');
    setError(null);
    try {
      const r = await backupNow();
      if (r) {
        setLast(r.at);
        setMessage(r.upserted || r.deleted ? 'Backed up.' : 'Already up to date.');
        hapticSuccess();
      }
      await refresh();
    } catch {
      setError('The backup didn’t finish. It will try again next time.');
    } finally {
      setBusy(null);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh().then((i) => {
      // A brand-new account: nothing to lose, back up straight away.
      if (i && i.pillars === 0 && i.sessions === 0 && !syncedWith(userId) && !phoneIsEmpty()) void doBackup();
    });
  }, [refresh, doBackup, userId]);

  const doRestore = async () => {
    const yes = await confirmAsync({
      title: 'Restore from your account?',
      message: phoneIsEmpty()
        ? 'Your pillars, goals, habits and hours come back to this phone.'
        : 'What’s on this phone now is replaced by your account’s backup.',
      confirmLabel: 'Restore',
    });
    if (!yes) return;
    setBusy('restore');
    setError(null);
    try {
      const n = await restoreFromAccount();
      setLast(lastBackupAt());
      setMessage(`Restored ${plural(n, 'item')}.`);
      hapticSuccess();
      onRestored();
    } catch {
      setError('The restore didn’t finish. Nothing on this phone was changed.');
    } finally {
      setBusy(null);
    }
  };

  const hasBackup = !!info && (info.pillars > 0 || info.sessions > 0);
  const offerRestoreFirst = hasBackup && !synced;

  return (
    <View style={{ marginTop: 22, backgroundColor: Surface.surfaceRaised, borderRadius: 18, padding: 16 }} accessibilityLabel="Backup">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="cloud-done-outline" size={18} color={Surface.ink} />
        <Text style={{ ...Type.heading }}>Backup</Text>
      </View>

      {!info && !error ? (
        <ActivityIndicator color={Surface.ink} style={{ marginTop: 12 }} />
      ) : offerRestoreFirst ? (
        <>
          <Text style={{ ...Type.body, marginTop: 6 }}>
            Your account has a backup: {plural(info!.pillars, 'pillar')}, {plural(info!.sessions, 'session')}.
          </Text>
          <View style={{ marginTop: 14 }}>
            <CTA label={busy === 'restore' ? 'Restoring…' : 'Restore my data'} disabled={!!busy} onPress={() => void doRestore()} />
          </View>
          <Pressable onPress={() => void doBackup()} accessibilityRole="button" accessibilityLabel="Keep this phone’s data and back it up" style={{ paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodyBold, fontSize: 15, textAlign: 'center' }}>Keep this phone’s data and back it up</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text accessibilityLabel={`Last backup ${agoLabel(last)}`} style={{ ...Type.body, marginTop: 6 }}>
            Last backup: {agoLabel(last)}. It backs up after each session.
          </Text>
          {info ? (
            <Text style={{ ...Type.meta, marginTop: 4 }}>
              On your account: {plural(info.pillars, 'pillar')}, {plural(info.sessions, 'session')}.
            </Text>
          ) : null}
          <View style={{ marginTop: 14 }}>
            <CTA label={busy === 'backup' ? 'Backing up…' : 'Back up now'} disabled={!!busy} onPress={() => void doBackup()} />
          </View>
          {hasBackup ? (
            <Pressable onPress={() => void doRestore()} accessibilityRole="button" accessibilityLabel="Restore from your account" style={{ paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodyBold, fontSize: 15 }}>Restore from your account</Text>
            </Pressable>
          ) : null}
        </>
      )}
      {message ? <Text style={{ ...Type.meta, color: Accent.green, marginTop: 8, textAlign: 'center' }}>{message}</Text> : null}
      {error ? <Text style={{ ...Type.meta, color: Accent.amber, marginTop: 8, textAlign: 'center' }}>{error}</Text> : null}
    </View>
  );
}
