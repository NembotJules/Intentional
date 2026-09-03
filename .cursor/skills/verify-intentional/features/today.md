# Today

**Route**: `/(tabs)/today`  
**File**: `intentional-expo/app/(tabs)/today.tsx`  
**Tab**: First tab (Home icon)

## Sub-features

1. **Daily ledger** - Shows credited minutes and completion %
2. **Action rows** - Habits (checkbox) and sessions (progress bar + Start button)
3. **Goal filter chips** - "All" or per-pillar filter
4. **Empty state** - CTA when no actions exist
5. **Suggestion card** - Smart recommendations (streak at risk, momentum, idle pillars)
6. **Action deactivation** - Swipe-to-hide on native, "Hide" button on web
7. **Floating + button** - Quick-add goal
8. **Greeting** - "Good morning/afternoon/evening, {userName}"

## How to get to it (user POV)

1. Launch app (after onboarding complete)
2. Lands on `/(tabs)/today` automatically
3. Or tap "Today" tab from any other tab

## Driving it with Playwright

### Navigate to Today

```typescript
await page.goto('http://localhost:8081');
// After onboarding, auto-redirects to /(tabs)/today
await page.waitForURL(/\/\(tabs\)\/today/);
await page.screenshot({ path: 'evidence/today-initial.png' });
```

### Empty state (no actions)

```typescript
// If no goals/actions exist:
const emptyHeading = page.getByText('0m', { exact: true });
expect(await emptyHeading.isVisible()).toBe(true);

const emptyBody = page.getByText(/Your ledger is blank/);
expect(await emptyBody.isVisible()).toBe(true);

// Two CTAs
await page.getByRole('button', { name: 'Add action' }).click();
// or
await page.getByRole('button', { name: 'Start manual focus' }).click();
```

**Empty state copy:**
- Heading: "0m"
- Body: "Your ledger is blank. Add one action to a pillar, or start a manual focus session and credit the time honestly."
- Buttons: "Add action", "Start manual focus"

### Ledger card (has actions)

```typescript
// Top card shows credited minutes and score
const creditedMins = page.locator('text=/\\d+m/').first();
expect(await creditedMins.isVisible()).toBe(true);

const scoreRing = page.locator('text=/%/');
expect(await scoreRing.isVisible()).toBe(true);

// Truth line (changes based on completion)
const truthLine = page.getByText(/credited to pillars today/);
expect(await truthLine.isVisible()).toBe(true);
```

**Ledger copy:**
- Minutes: e.g., "45m", "2h 15m"
- Truth line variants:
  - "No time credited yet. Start one session and Intentional will show where the day went."
  - "{mins} credited to pillars today. The ledger is clean." (all done)
  - "{mins} credited to pillars today. One session away from a balanced day." (not done)

### Goal filter chips

```typescript
// Horizontal scroll of goal chips
const allChip = page.getByText('All', { exact: true });
await allChip.click();
await page.screenshot({ path: 'evidence/today-filter-all.png' });

// Select specific goal
const bodyChip = page.getByText('Body', { exact: true });
await bodyChip.click();
await page.screenshot({ path: 'evidence/today-filter-body.png' });
```

### Action rows: Habit

```typescript
// Habit has a checkbox
const habitRow = page.locator('text=/Morning stretches/').locator('..');
const checkbox = habitRow.locator('[role="checkbox"]');
await checkbox.click();
await page.screenshot({ path: 'evidence/today-habit-checked.png' });

// Uncheck
await checkbox.click();
await page.screenshot({ path: 'evidence/today-habit-unchecked.png' });
```

### Action rows: Session

```typescript
// Session has Start button and progress bar
const sessionRow = page.locator('text=/Deep work/').locator('..');
const startBtn = sessionRow.getByRole('button', { name: 'Start' });
await startBtn.click();

// Redirects to Focus tab
await page.waitForURL(/\/\(tabs\)\/focus/);
await page.screenshot({ path: 'evidence/focus-from-today.png' });
```

### Action deactivation (web)

```typescript
// Web has "Hide" button on each row
const actionRow = page.locator('text=/Morning workout/').locator('..');
const hideBtn = actionRow.getByText('Hide', { exact: true });
await hideBtn.click();

// Confirm alert
await page.getByRole('button', { name: 'Deactivate' }).click();
await page.screenshot({ path: 'evidence/today-action-deactivated.png' });
```

**Alert copy:**
- Title: "Deactivate action?"
- Body: "\"{actionName}\" will disappear from Today. Open Goals, tap the goal, then tap Restore on the paused action."
- Buttons: "Cancel", "Deactivate"

### Suggestion card

```typescript
// Appears if suggestions exist and not dismissed today
const suggestionCard = page.locator('text=/Keep the momentum/');
if (await suggestionCard.isVisible()) {
  await page.screenshot({ path: 'evidence/today-suggestion-card.png' });
  
  // Dismiss
  const dismissBtn = page.locator('text=/Dismiss/');
  await dismissBtn.click();
  await page.screenshot({ path: 'evidence/today-suggestion-dismissed.png' });
}
```

**Suggestion types (US-040):**
- Streak at risk: "Keep the {actionName} streak alive"
- Momentum: "You're on a roll with {actionName}"
- Idle pillar: "{goalName} needs attention"

### Floating + button

```typescript
// Bottom-right FAB
const fab = page.locator('[aria-label="Add goal"]');
await fab.click();

// Opens Goals tab with create=1 param
await page.waitForURL(/\/\(tabs\)\/goals\?create=1/);
await page.screenshot({ path: 'evidence/goals-create.png' });
```

## Gotchas

### Web swipe gestures
Swipe-to-hide uses `react-native-gesture-handler` which doesn't work on web. Web version shows a "Hide" button instead.

### Habit completion state
Habits use `api.setHabitCompletion(actionId, date, done)` to persist. On web, this doesn't persist across page reloads.

### Session minutes
Sessions show `{mins}m / {target}m` progress. Minutes come from `api.getSessionsForActionToday()`, which queries the `focus_sessions` table.

### Score calculation
The ring percentage is calculated by `useTodayScore(sections)` hook. It's the weighted average of action completion across all active actions.

### Greeting personalization
Greeting uses `getSetting('user_name')` from Settings. Defaults to "Good morning/afternoon/evening" if empty.

### Plain truth card
Bottom card shows contextual insight about the day's balance. Copy changes based on:
- Zero time credited
- All actions done
- Filtered view vs. all goals

### Pull-to-refresh
Native gesture handler. Does NOT work on web. Use page reload instead.

### Tab bar overlap
Content has bottom padding to avoid being hidden by the floating tab bar. Calculated by `tabBarOverlapPadding(insets.bottom)`.
