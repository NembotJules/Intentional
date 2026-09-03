---
name: verify-intentional
description: Drive the Intentional Expo app (web demo surface and documented iOS gaps) the way a user does. Use when proving Today/Focus/Goals/Insights/Onboarding behavior, after UI PRs, or before claiming a feature works.
---

# Verify Intentional

Drive the Intentional Expo web app end-to-end as a real user would. Capture evidence that features work, not test results that mocks passed.

## Why this skill exists

The next agent will read this skill cold and must be able to launch Intentional, doctor the instance, drive a user path, capture evidence, and clean up. A skill that was never executed is a draft, not a deliverable.

## When to use

- Proving Today/Focus/Goals/Insights/Onboarding behavior works
- After UI PRs that touch user flows
- Before claiming a feature is complete
- When debugging user-reported issues

## What NOT to use this for

- Unit test failures (use `npm test` for that)
- TypeScript errors (use `npx tsc --noEmit`)
- iOS Family Controls features (requires custom build + physical device)
- Native iOS features (native Swift app is out of scope)

## Tech stack

- **App**: Expo SDK 54, React Native, Expo Router, expo-sqlite, NativeWind
- **Test surface**: Web (`npx expo start --web`) on port 8081
- **Node**: >= 20.19.4 required
- **Entry**: `app/index.tsx` routes to `/onboarding` unless `hasCompletedOnboarding === '1'`, else `/(tabs)/today`
- **Tabs**: Today, Focus, Insights, Goals, Settings (in `app/(tabs)/_layout.tsx`)
- **Extra routes**: `/onboarding`, `/session-history`, `/goal/[id]`, `/weekly-review`, `/reviews-history`
- **Database**: SQLite init + migrations run in `app/_layout.tsx`. Web SQLite is a shim (`db/index.web.ts`)

## Launch

Use the helper script to start Expo web on a known port:

```bash
cd /workspace/.cursor/skills/verify-intentional
EXPO_WEB_PORT=8081 ./helpers/launch.sh
```

This will:
1. Install dependencies if missing
2. Start Expo web on port 8081
3. Wait for HTTP 200
4. Write PID and port to `evidence/.run`
5. Log output to `evidence/expo-output.log`

**Do NOT attach to an existing Metro instance.** Always start a fresh instance with the helper.

## Doctor

Check that the instance is healthy:

```bash
cd /workspace/.cursor/skills/verify-intentional
./helpers/doctor.sh
```

This verifies:
- Process is alive
- Port is owned by the recorded PID
- HTTP 200 on the root route

**Run doctor before driving, and after any failed drive attempt.**

## Drive

Use Playwright to drive the web surface. Install if needed:

```bash
npm install -D playwright @playwright/test
npx playwright install chromium
```

### Basic Playwright setup

```typescript
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 375, height: 667 }, // iPhone SE dimensions
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
});
const page = await context.newPage();

// Navigate to the app
await page.goto('http://localhost:8081');
```

### Selectors

Prefer in this order:
1. `getByRole('button', { name: 'Continue' })`
2. `getByText('exact text from source')`
3. `getByTestId('testid')` (if present)
4. CSS selectors as last resort

Read the feature maps in `features/` for specific copy and routes.

### Evidence capture

Capture before-action and after-state:

```typescript
// Before action
await page.screenshot({ path: 'evidence/before-click-continue.png' });

// Perform action
await page.getByRole('button', { name: 'Continue' }).click();

// After state
await page.screenshot({ path: 'evidence/after-click-continue.png' });

// Optional: HAR, console, trace
await context.tracing.stop({ path: 'evidence/trace.zip' });
```

### Web SQLite limitations

The web shim (`db/index.web.ts`) does NOT persist data between page reloads. Drive flows in a single session. If a feature requires persistence across reloads, document it as `verified-unreachable` with prerequisite "native SQLite".

### iOS-only features

Mark these as `verified-unreachable`:
- Family Controls app blocking (requires custom iOS build + physical device + Screen Time permission)
- Push notifications (requires physical device + APNs setup)
- Haptics (web shim exists but silent)
- Native share sheet (web fallback exists)

## Cleanup

Kill the instance but preserve evidence:

```bash
cd /workspace/.cursor/skills/verify-intentional
./helpers/cleanup.sh
```

This will:
- Kill the recorded PID
- Remove `evidence/.run`
- **Preserve** all evidence artifacts in `evidence/`

**Run cleanup after every test iteration, even if it failed.**

## Helpers

All helpers live in `helpers/`:

- `launch.sh` - Start Expo web on port 8081, wait for HTTP 200
- `doctor.sh` - Check process/port/HTTP health
- `cleanup.sh` - Kill PID, remove run file, keep evidence

Invoke from the skill directory:

```bash
cd /workspace/.cursor/skills/verify-intentional
./helpers/launch.sh
./helpers/doctor.sh
./helpers/cleanup.sh
```

## Feature maps

Detailed maps for each user flow live in `features/`:

1. `onboarding.md` - 3-step pillar setup flow
2. `today.md` - Daily ledger and action tracking
3. `focus.md` - Focus sessions and timer
4. `goals.md` - Goal and action management
5. `insights.md` - Historical data and streaks

Each map includes:
- Sub-features
- How to get to it (user POV)
- Driving it with Playwright (selectors, copy)
- Gotchas (web limitations, iOS-only features)

## Proof standards

A valid proof includes:
1. Real user path (not test-only endpoints)
2. Screenshot of **before-action**
3. Screenshot of **after-state**
4. Side effects if observable (e.g., DOM text change, new route)
5. No test doubles or mocks

If a feature cannot be driven on web, mark it `verified-unreachable` with the concrete prerequisite.

## Evidence directory

All artifacts go in `evidence/`:
- Screenshots (`.png`)
- HAR files (`.har`)
- Console logs (`.log`)
- Playwright traces (`.zip`)
- Run metadata (`.run`)

The directory is gitignored except for `README.md`. Evidence persists after cleanup for post-run inspection.

## Iteration protocol

1. Launch via helper
2. Doctor to confirm health
3. Drive ONE feature end-to-end
4. Capture evidence (before/after screenshots minimum)
5. Cleanup (even if drive failed)
6. Confirm evidence files exist
7. If launch fails, fix the skill (or report precise product bug)

Do NOT skip cleanup. Do NOT leave orphaned Metro processes.

## Example: Full onboarding flow

```typescript
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 375, height: 667 },
});
const page = await context.newPage();

// Navigate
await page.goto('http://localhost:8081');
await page.screenshot({ path: 'evidence/onboarding-step1-before.png' });

// Step 1: Pick pillars
await page.getByText('Body').click();
await page.getByText('Finances').click();
await page.getByText('Mind').click();
await page.screenshot({ path: 'evidence/onboarding-step1-after.png' });
await page.getByRole('button', { name: 'Continue' }).click();

// Step 2: First action
await page.screenshot({ path: 'evidence/onboarding-step2-before.png' });
await page.fill('input[placeholder*="Ship client proposal"]', 'Morning workout');
await page.getByText('Session', { exact: true }).click();
await page.getByText('25m').click();
await page.screenshot({ path: 'evidence/onboarding-step2-after.png' });
await page.getByRole('button', { name: 'Continue' }).click();

// Step 3: Why
await page.screenshot({ path: 'evidence/onboarding-step3-before.png' });
await page.fill('textarea[placeholder*="Build enough room"]', 'Stay healthy and strong');
await page.screenshot({ path: 'evidence/onboarding-step3-after.png' });
await page.getByRole('button', { name: 'Enter Today' }).click();

// Verify Today screen
await page.waitForURL(/\/\(tabs\)\/today/);
await page.screenshot({ path: 'evidence/today-after-onboarding.png' });

await browser.close();
```

## Troubleshooting

### Port already in use
Run cleanup, or use a different port: `EXPO_WEB_PORT=8082 ./helpers/launch.sh`

### HTTP timeout
Check `evidence/expo-output.log` for startup errors. Common causes:
- Missing dependencies: `cd intentional-expo && npm install`
- Node version < 20.19.4: `nvm use 20`
- Metro cache issues: `npx expo start --clear`

### Playwright selector failures
Read the actual source files for current copy. The onboarding flow has changed multiple times. Do NOT rely on old documentation.

### Web SQLite empty
Web SQLite is a shim that doesn't persist. Drive flows in one session without page reloads.
