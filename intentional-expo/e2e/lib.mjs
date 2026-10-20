/**
 * Tiny e2e harness for the Expo web build (Playwright, 390×844 like an iPhone).
 *
 *   E2E_BASE_URL   web dev server (default http://localhost:8081)
 *   E2E_CHROME     optional path to a Chrome binary (else Playwright's bundled Chromium:
 *                  run `npx playwright install chromium` once)
 *
 * Every check goes through `ok()`. A run fails (exit code 1) if any check fails or the page throws.
 * Screenshots land in e2e/artifacts/<suite>/ — look at them; a passing text check is not a visual check.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

export const BASE_URL = (process.env.E2E_BASE_URL ?? 'http://localhost:8081').replace(/\/$/, '');

export async function start(suite) {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.E2E_CHROME || undefined });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('dialog', (d) => void d.accept());

  const dir = path.join(path.dirname(new URL(import.meta.url).pathname), 'artifacts', suite);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  let n = 0;
  let passed = 0;
  let failed = 0;

  const body = () => page.innerText('body');
  const t = {
    page,
    body,
    async goto(route = '/') {
      await page.goto(BASE_URL + route, { waitUntil: 'domcontentloaded', timeout: 300000 });
    },
    shot: (label) => page.screenshot({ path: path.join(dir, `${String(++n).padStart(2, '0')}-${label}.png`) }),
    ok(cond, msg) {
      if (cond) {
        passed += 1;
        console.log('PASS', msg);
      } else {
        failed += 1;
        console.log('FAIL', msg);
      }
    },
    has: async (s) => (await body()).includes(s),
    async tap(label, wait = 500) {
      await page.getByLabel(label, { exact: true }).last().click();
      await page.waitForTimeout(wait);
    },
    async pick(text, wait = 300) {
      await page.getByText(text, { exact: true }).last().click();
      await page.waitForTimeout(wait);
    },
    waitText: (text, ms = 15000) => page.getByText(text).first().waitFor({ timeout: ms }),
    wait: (ms) => page.waitForTimeout(ms),
    /** Replace the web DB (db/index.web.ts) and settings, then reload. Load the app once first (same origin). */
    async seed(db, settings = {}) {
      await page.evaluate(
        ([d, s]) => {
          localStorage.clear();
          localStorage.setItem('intentional_db_v2', JSON.stringify(d));
          localStorage.setItem('intentional_settings_v1', JSON.stringify(s));
        },
        [db, settings]
      );
    },
    async finish() {
      if (pageErrors.length) {
        failed += 1;
        console.log('FAIL page threw:\n  ' + pageErrors.join('\n  '));
      }
      if (consoleErrors.length) console.log('WARN console errors:\n  ' + consoleErrors.slice(0, 10).join('\n  '));
      console.log(`RESULT ${suite}: ${passed} passed, ${failed} failed · screenshots: ${dir}`);
      await browser.close();
      process.exitCode = failed ? 1 : 0;
    },
  };
  return t;
}

/** Local calendar day "YYYY-MM-DD" (matches utils/dates). */
export function today(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** A minimal seeded DB: pillars [[name, color, icon]], habits per pillar index. */
export function makeDb({ pillars, habits = [], sessions = [], completions = [], name = 'Alex' }) {
  return {
    db: {
      meta_goals: pillars.map(([n, c, i], k) => ({ id: 'g' + k, name: n, color: c, icon: i, sort_order: k, why_statement: '', is_archived: 0 })),
      daily_actions: habits.map((h, k) => ({ id: h.id ?? 'a' + k, goal_id: 'g' + h.pillar, name: h.name, type: h.type ?? 'habit', target_minutes: h.minutes ?? 60, reminder_time: null, is_active: 1, sort_order: k })),
      focus_sessions: sessions,
      habit_completions: completions,
      weekly_reviews: [],
      settings: [{ key: 'user_name', value: name }, { key: 'hasCompletedOnboarding', value: '1' }],
    },
    settings: { user_name: name, hasCompletedOnboarding: '1' },
  };
}
