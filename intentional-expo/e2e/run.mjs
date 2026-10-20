/** Runs every e2e/*.e2e.mjs in order; exits 1 if any suite fails. Usage: node e2e/run.mjs [filter] */
import { readdirSync } from 'fs';
import { spawnSync } from 'child_process';
import path from 'path';

const dir = path.dirname(new URL(import.meta.url).pathname);
const filter = process.argv[2] ?? '';
const suites = readdirSync(dir).filter((f) => f.endsWith('.e2e.mjs') && f.includes(filter)).sort();
let failed = 0;
for (const s of suites) {
  console.log(`\n=== ${s} ===`);
  const r = spawnSync(process.execPath, [path.join(dir, s)], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) failed += 1;
}
console.log(`\nE2E: ${suites.length - failed}/${suites.length} suites passed`);
process.exit(failed ? 1 : 0);
