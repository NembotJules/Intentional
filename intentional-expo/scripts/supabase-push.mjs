/**
 * Apply ../supabase/migrations/*.sql that aren't applied yet, through the Management API (SQL endpoint), each in a
 * transaction, recorded in supabase_migrations.schema_migrations (the table the Supabase CLI uses).
 *   node scripts/supabase-push.mjs [--dry-run]
 * Needs SUPABASE_PROJECT_REF + SUPABASE_ACCESS_TOKEN (see scripts/supabase-env.mjs).
 */
import fs from 'fs';
import path from 'path';
import { loadAdminEnv } from './supabase-env.mjs';

const dry = process.argv.includes('--dry-run');
const loaded = loadAdminEnv(['SUPABASE_PROJECT_REF', 'SUPABASE_ACCESS_TOKEN']);
if (loaded.missing) {
  console.error(`Missing ${loaded.missing.join(', ')}; nothing applied.`);
  process.exit(1);
}
const { SUPABASE_PROJECT_REF: ref, SUPABASE_ACCESS_TOKEN: token } = loaded.env;

export async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`SQL failed (${r.status}): ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'supabase', 'migrations');
const files = fs.readdirSync(dir).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();

await sql(`create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);`);
const applied = new Set((await sql('select version from supabase_migrations.schema_migrations')).map((r) => r.version));

const q = (s) => `'${s.replace(/'/g, "''")}'`;
let n = 0;
for (const f of files) {
  const version = f.slice(0, 14);
  if (applied.has(version)) continue;
  const name = f.slice(15, -4);
  const body = fs.readFileSync(path.join(dir, f), 'utf8');
  console.log(`${dry ? 'would apply' : 'applying'} ${f}`);
  if (dry) continue;
  await sql(`begin;\n${body}\ninsert into supabase_migrations.schema_migrations (version, statements, name) values (${q(version)}, array[${q(body)}], ${q(name)});\ncommit;`);
  n += 1;
}
console.log(dry ? 'dry run done' : `${n} migration(s) applied; ${applied.size + n} in total`);
