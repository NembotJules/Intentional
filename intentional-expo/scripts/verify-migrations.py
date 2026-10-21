"""
Replays initDb() + MIGRATIONS (db/index.native.ts, db/migrations.ts) on REAL SQLite, the way a phone runs them:
  1. fresh install (newest initDb, version 0, every migration replays)
  2. upgrade from the develop branch's schema at version 1, with existing sessions
Mirrors runMigrationsOnDb: per-migration transaction, ADD COLUMN skipped when the column exists.
Unit tests use fakes and the web build never runs migrations, so this is the only real-SQLite check.

Usage (from intentional-expo/):  python3 scripts/verify-migrations.py [base-ref-for-upgrade, default develop]
Exit code 1 if any scenario fails.
"""
import re, sqlite3, subprocess, sys
import os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def init_sql(text): return re.search(r"db\.execSync\(`([\s\S]*?)`\);", text).group(1)
def migrations(text):
    block=text[text.index('export const MIGRATIONS'):text.index('export const CURRENT_VERSION')]
    out=[]
    for m in re.finditer(r"version:\s*(\d+),\s*up:\s*\[([\s\S]*?)\],\s*\}", block):
        stmts=re.findall(r"`([\s\S]*?)`", m.group(2))
        out.append((int(m.group(1)), stmts))
    return out
FAILED=False
ADD=re.compile(r"^\s*ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)", re.I)
def run(label, db, start, migs):
    global FAILED
    db.isolation_level=None
    try:
        for v, stmts in migs:
            if v<=start: continue
            db.execute('BEGIN')
            for q in stmts:
                a=ADD.match(q)
                if a and a.group(2).lower() in [r[1].lower() for r in db.execute(f'PRAGMA table_info({a.group(1)})')]: continue
                db.execute(q)
            db.execute('COMMIT')
        cols=','.join(r[1] for r in db.execute('PRAGMA table_info(focus_sessions)'))
        n=db.execute('SELECT COUNT(*) FROM focus_sessions').fetchone()[0]
        print(f'{label}: OK · rows={n} · cols={cols}')
    except Exception as e:
        FAILED=True; print(f'{label}: CRASH → {e}')
base=sys.argv[1] if len(sys.argv)>1 else 'develop'
read=lambda f: open(f'{ROOT}/{f}').read()
migs=migrations(read('db/migrations.ts'))
print('migrations found:', [v for v,_ in migs])
db=sqlite3.connect(':memory:'); db.executescript(init_sql(read('db/index.native.ts'))); run('fresh install (version 0)', db, 0, migs)
old=subprocess.check_output(['git','-C',ROOT,'show',f'{base}:intentional-expo/db/index.native.ts']).decode()
db=sqlite3.connect(':memory:'); db.executescript(init_sql(old))
for i in range(3): db.execute(f"INSERT INTO focus_sessions VALUES ('s{i}','a1','g1','2026-10-1{i}T08:00:00Z',NULL,1800,NULL,1)")
run(f'upgrade from {base} schema at v1 (3 sessions)', db, 1, migs)
sys.exit(1 if FAILED else 0)
