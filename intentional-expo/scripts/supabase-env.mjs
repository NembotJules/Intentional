/**
 * Admin env for Supabase scripts (never imported by the app). Reads process.env, then falls back to
 * ~/.config/intentional/supabase-admin.env (or $INTENTIONAL_SUPABASE_ENV). Returns null when nothing is configured.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

export function loadAdminEnv(required) {
  const file = process.env.INTENTIONAL_SUPABASE_ENV ?? path.join(os.homedir(), '.config/intentional/supabase-admin.env');
  const fromFile = {};
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) fromFile[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  const env = { ...fromFile, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('SUPABASE_'))) };
  const missing = required.filter((k) => !env[k]);
  return missing.length ? { missing } : { env };
}
