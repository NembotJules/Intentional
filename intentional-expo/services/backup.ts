/**
 * US-089 · Backup & restore for the signed-in person (see services/sync.ts for how).
 * Backs up a few seconds after a session is saved, when the app comes to the front, and on "Back up now".
 * Everything here is a no-op when the cloud isn't configured or nobody is signed in.
 */
import { Platform } from 'react-native';
import { db, getSetting, setSetting } from '@/db';
import { getSupabase } from '@/services/supabase';
import { applyRestore, backupInfo, pullAll, push, type Ledger, type LocalDb } from '@/services/sync';

export const LEDGER_KEY = 'sync_ledger';
export const LAST_PUSH_KEY = 'sync_last_push';
const local = db as unknown as LocalDb;

function readLedger(): Ledger | null {
  try {
    const raw = getSetting(LEDGER_KEY);
    return raw ? (JSON.parse(raw) as Ledger) : null;
  } catch {
    return null;
  }
}

async function signedInUserId(): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.user.id ?? null;
}

let running: Promise<BackupResult | null> | null = null;
export interface BackupResult {
  upserted: number;
  deleted: number;
  at: string;
}

/** This phone has backed up to (or restored from) this account before. */
export function syncedWith(userId: string): boolean {
  return readLedger()?.userId === userId;
}

/**
 * Upload what changed since the last backup. Null when signed out (or, for `auto`, when skipped). One at a time.
 * `auto` (after a session, app to the front) only runs on a phone already synced with this account: a new phone
 * signing in to an account that has a backup is asked first (restore, or keep this phone's data and back it up).
 */
export function backupNow(opts: { auto?: boolean } = {}): Promise<BackupResult | null> {
  if (running) return running;
  running = (async () => {
    const client = getSupabase();
    const userId = await signedInUserId();
    if (!client || !userId) return null;
    if (opts.auto && !syncedWith(userId)) return null;
    const res = await push(client, local, readLedger(), userId);
    setSetting(LEDGER_KEY, JSON.stringify(res.ledger));
    const at = new Date().toISOString();
    setSetting(LAST_PUSH_KEY, at);
    return { upserted: res.upserted, deleted: res.deleted, at };
  })().finally(() => {
    running = null;
  });
  return running;
}

let timer: ReturnType<typeof setTimeout> | null = null;
/** Back up a few seconds from now (several changes in a row make one backup). Failures wait for the next one. */
export function scheduleBackup(delayMs = 4000): void {
  if (!getSupabase()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void backupNow({ auto: true }).catch(() => {});
  }, delayMs);
}

export function lastBackupAt(): string | null {
  return getSetting(LAST_PUSH_KEY);
}

export async function getBackupInfo(): Promise<{ pillars: number; sessions: number; lastBackup: string | null } | null> {
  const client = getSupabase();
  const userId = await signedInUserId();
  if (!client || !userId) return null;
  return backupInfo(client, userId);
}

/** The phone has nothing of its own yet (a new install): offer the restore first. */
export function phoneIsEmpty(): boolean {
  const n = local.getAllSync<{ id: string }>('SELECT id FROM meta_goals');
  return n.length === 0;
}

/** Replace what's on this phone with the account's copy. Returns how many rows came back. */
export async function restoreFromAccount(): Promise<number> {
  const client = getSupabase();
  const userId = await signedInUserId();
  if (!client || !userId) throw new Error('Sign in first.');
  const data = await pullAll(client, userId);
  const { ledger, restored } = applyRestore(local, data, userId, setSetting, { transaction: Platform.OS !== 'web' });
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // The web shim also keeps settings in a fast-path map: rebuild it from the table so nothing stale survives.
    try {
      const rows = local.getAllSync<{ key: string; value: string }>('SELECT * FROM settings');
      localStorage.setItem('intentional_settings_v1', JSON.stringify(Object.fromEntries(rows.map((r) => [r.key, r.value]))));
    } catch {
      /* ignore */
    }
  }
  setSetting(LEDGER_KEY, JSON.stringify(ledger));
  setSetting(LAST_PUSH_KEY, new Date().toISOString());
  return restored;
}
