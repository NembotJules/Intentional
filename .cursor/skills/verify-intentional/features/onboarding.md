# Onboarding

**Route**: `/onboarding`  
**File**: `intentional-expo/app/onboarding.tsx`  
**Entry condition**: `getSetting('hasCompletedOnboarding') !== '1'` in `app/index.tsx`

## Sub-features

1. **Step 1: Pick pillars** - Select 3-5 life areas (Body, Finances, Mind, Craft)
2. **Step 2: First action** - Name one action, choose type (Session/Habit), set daily target
3. **Step 3: Why statement** - Optional one-line reason for first pillar
4. **Draft persistence** - AsyncStorage saves progress (v4 schema)
5. **Skip option** - "Skip for now" on step 3
6. **Back navigation** - Return to previous step

## How to get to it (user POV)

1. Launch app (fresh install or `hasCompletedOnboarding !== '1'`)
2. Lands on `/onboarding` automatically
3. Complete 3 steps to reach Today screen

## Driving it with Playwright

### Navigate to onboarding

```typescript
await page.goto('http://localhost:8081');
// Should auto-redirect to /onboarding if not completed
await page.waitForURL(/\/onboarding/);
```

### Step 1: Pick pillars

```typescript
// Verify step 1 UI
await page.screenshot({ path: 'evidence/onboarding-step1-before.png' });
expect(await page.getByText('What should your').isVisible()).toBe(true);
expect(await page.getByText('days serve?').isVisible()).toBe(true);

// Select pillars (checkboxes in a card)
await page.getByText('Body', { exact: true }).click();
await page.getByText('Finances', { exact: true }).click();
await page.getByText('Mind', { exact: true }).click();
await page.screenshot({ path: 'evidence/onboarding-step1-after.png' });

// Continue (button disabled if no pillars selected)
await page.getByRole('button', { name: 'Continue' }).click();
```

**Copy to look for:**
- Heading: "What should your\ndays serve?"
- Body: "Pick 3 to 5 areas of life you want your daily effort to touch."
- Pillars: "Body", "Finances", "Mind", "Craft"
- Button: "Continue"

### Step 2: First action

```typescript
await page.screenshot({ path: 'evidence/onboarding-step2-before.png' });

// Back button
const backBtn = page.getByText('Back', { exact: true });
expect(await backBtn.isVisible()).toBe(true);

// Fill action name
const actionInput = page.locator('input[placeholder*="Ship client proposal"]');
await actionInput.fill('Morning workout');

// Select type (defaults to Session)
await page.getByText('Session', { exact: true }).click(); // already selected
// Or switch to Habit:
// await page.getByText('Habit', { exact: true }).click();

// Select duration (for Session type only)
await page.getByText('25m').click(); // or '90m', 'Custom'

await page.screenshot({ path: 'evidence/onboarding-step2-after.png' });
await page.getByRole('button', { name: 'Continue' }).click();
```

**Copy to look for:**
- Heading: "What is one thing\n{pillarName} should receive?"
- Placeholder: "Ship client proposal"
- Type labels: "Session", "Habit"
- Duration options: "25m", "90m", "Custom"
- Button: "Continue" (disabled if action name empty)

### Step 3: Why statement

```typescript
await page.screenshot({ path: 'evidence/onboarding-step3-before.png' });

// Fill optional why
const whyInput = page.locator('textarea[placeholder*="Build enough room"]');
await whyInput.fill('Stay healthy and strong');

await page.screenshot({ path: 'evidence/onboarding-step3-after.png' });

// Two buttons: "Enter Today" and "Skip for now"
await page.getByRole('button', { name: 'Enter Today' }).click();
// Or skip:
// await page.getByRole('button', { name: 'Skip for now' }).click();

// Should redirect to Today
await page.waitForURL(/\/\(tabs\)\/today/);
await page.screenshot({ path: 'evidence/today-after-onboarding.png' });
```

**Copy to look for:**
- Heading: "Why does\n{pillarName} matter?"
- Body: "One line is enough. You can edit it later."
- Placeholder: "Build enough room to choose better work."
- Buttons: "Enter Today", "Skip for now"

## Gotchas

### Draft persistence on web
AsyncStorage works on web but doesn't persist across browser sessions (localStorage under the hood). Draft state is session-local only.

### Segmented progress bar
The progress indicator shows 3 steps. Old versions had 7 steps; the code still has migration logic for v1-v3 drafts.

### Custom duration input
Selecting "Custom" on step 2 enables a text input for manual minutes. Verify it appears.

### Skipping step 3
Both buttons ("Enter Today" and "Skip for now") call the same `finish()` function. The why statement is optional.

### No email/account creation
Onboarding is local-only. No sign-up, no cloud sync. All data stays in SQLite.

### Web SQLite shim
On web, `db/index.web.ts` provides a no-op shim. Data does NOT persist between page reloads. Drive the full onboarding flow in one session.
