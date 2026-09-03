# Insights

**Route**: `/(tabs)/insights`  
**File**: `intentional-expo/app/(tabs)/insights.tsx`  
**Tab**: Third tab (Bar chart icon)

## Sub-features

1. **Time range filter** - Week / Month / All time
2. **Goal breakdown** - Horizontal bars showing hours per goal
3. **Total hours** - Sum across all goals
4. **Daily average** - Hours per day in selected range
5. **Top goal** - Goal with most hours
6. **Insight sentence** - Contextual analysis of balance
7. **Streak cards** - Per-action current/longest streaks
8. **Empty state** - CTA when no sessions logged
9. **Weekly review link** - Navigate to `/weekly-review`

## How to get to it (user POV)

1. Tap "Insights" tab
2. Complete at least one focus session (otherwise empty state)

## Driving it with Playwright

### Navigate to Insights

```typescript
await page.goto('http://localhost:8081/(tabs)/insights');
await page.waitForURL(/\/\(tabs\)\/insights/);
await page.screenshot({ path: 'evidence/insights-initial.png' });
```

### Empty state (no sessions)

```typescript
const emptyHeading = page.getByText(/Your ledger is empty/);
expect(await emptyHeading.isVisible()).toBe(true);

const emptyBody = page.getByText(/Complete one focus session/);
expect(await emptyBody.isVisible()).toBe(true);

const startSessionBtn = page.getByRole('button', { name: 'Start a session' });
await startSessionBtn.click();

// Redirects to Focus tab
await page.waitForURL(/\/\(tabs\)\/focus/);
```

**Empty state copy:**
- Heading: "Your ledger is empty"
- Body: "Complete one focus session and Insights will show where the time went."
- Button: "Start a session"

### Range filter

```typescript
// Three chips: WK, MO, ALL
const weekChip = page.getByText('WK', { exact: true });
const monthChip = page.getByText('MO', { exact: true });
const allChip = page.getByText('ALL', { exact: true });

await weekChip.click();
await page.screenshot({ path: 'evidence/insights-week.png' });

await monthChip.click();
await page.screenshot({ path: 'evidence/insights-month.png' });

await allChip.click();
await page.screenshot({ path: 'evidence/insights-all.png' });
```

**Range labels:**
- `WK` = Last 7 days
- `MO` = This month (calendar month)
- `ALL` = All time (entire DB)

### Total hours card

```typescript
// Top card with large number
const totalHours = page.locator('text=/\\d+\\.\\dh|\\d+m/').first();
expect(await totalHours.isVisible()).toBe(true);

// Eyebrow text (e.g., "Last 7 days")
const eyebrow = page.getByText('Last 7 days', { exact: true });
expect(await eyebrow.isVisible()).toBe(true);

// Daily average
const avgText = page.getByText(/\\d+\\.\\d+h per day|\\d+m per day/);
expect(await avgText.isVisible()).toBe(true);
```

**Total hours copy:**
- Eyebrow: "Last 7 days" | "This month" | "All time"
- Total: e.g., "12.5h", "45m"
- Average: e.g., "1.8h per day", "15m per day"

### Goal breakdown bars

```typescript
// Each goal has a colored bar
const goalBar = page.locator('text=/Body/').locator('..');
const barHours = goalBar.locator('text=/\\d+\\.\\d+h|\\d+m/');
expect(await barHours.isVisible()).toBe(true);

await page.screenshot({ path: 'evidence/insights-breakdown.png' });
```

**Goal bar layout:**
- Color dot (left)
- Goal name
- Hours (right, e.g., "4.2h")
- Horizontal bar (width proportional to max goal hours)

### Insight sentence

```typescript
// Below goal breakdown, contextual analysis
const insightText = page.locator('text=/carried the period|across multiple pillars|doing most of the work/');
expect(await insightText.isVisible()).toBe(true);

await page.screenshot({ path: 'evidence/insights-sentence.png' });
```

**Insight sentence variants:**
- Single dominant pillar (> 50%): "{goalName} carried the period. {secondGoal} is visible too, but needs more attention."
- Balanced (3+ pillars, < 40%): "Work is happening across multiple pillars. {topGoal} leads, but the week is not one-dimensional."
- Two pillars: "{goal1} and {goal2} are both active. {otherCount} other pillars are underfed."
- Unbalanced: "{goalName} is doing most of the work. If that is intentional, keep going. If not, schedule one block elsewhere."
- Empty: "Your ledger is empty. Start one session and the accounting begins."

### Streak cards

```typescript
// Each action with a streak shows a card
const streakCard = page.locator('text=/Morning run/').locator('..');
const currentStreak = streakCard.locator('text=/Current: \\d+ days/');
const longestStreak = streakCard.locator('text=/Longest: \\d+ days/');

expect(await currentStreak.isVisible()).toBe(true);
expect(await longestStreak.isVisible()).toBe(true);

await page.screenshot({ path: 'evidence/insights-streaks.png' });
```

**Streak card layout:**
- Action name
- Goal color accent
- Current: X days
- Longest: Y days

Streaks calculated by `api.getActionStreakMetrics(actionId, actionType)`:
- Habit: consecutive days with `is_done = 1`
- Session: consecutive days with at least one session logged

### Weekly review link

```typescript
const weeklyReviewBtn = page.getByRole('button', { name: 'Weekly review' });
await weeklyReviewBtn.click();

await page.waitForURL(/\/weekly-review/);
await page.screenshot({ path: 'evidence/weekly-review.png' });
```

## Gotchas

### Range calculation
- `week`: Last 7 days (rolling, not calendar week)
- `month`: Current calendar month (resets on 1st)
- `all`: Entire database (no date filter)

### Hours formatting
- `formatHours()` in `insights.tsx`:
  - < 1 hour: "{mins}m"
  - ≥ 1 hour: "{hours}h" (1 decimal place)

### Daily average
Total hours divided by days in range:
- `week`: 7 days
- `month`: `new Date().getDate()` (current day of month)
- `all`: Days since first session (rounded up)

### Goal order preservation
Breakdown bars preserve goal list order (by `sort_order` from `meta_goals` table). Not sorted by hours.

### Max bar width
Longest bar = 100% width. Other bars proportional. Calculated by `maxHours = Math.max(...goalHours)`.

### Streak edge cases
- Streaks broken by missing a day
- Habits: missing `is_done = 1` for a date
- Sessions: missing any session for a date
- Streaks start at 1 (not 0) after first completion

### Empty state vs. zero hours
- Empty state: No sessions in DB at all
- Zero hours in range: Sessions exist, but not in selected range (shows "0m" instead of empty state)

### Top goal badge
If a goal has significantly more hours than others (> 50%), it's highlighted in the insight sentence.

### Insight sentence logic
Complex heuristics in `insightSentence` useMemo:
1. Sort goals by hours (descending)
2. Calculate percentages
3. Apply rules:
   - Single dominant (> 50%)
   - Balanced (3+ goals, < 40% each)
   - Two active (< 60% each)
   - Default (unbalanced)

### Weekly review route
Separate screen at `/weekly-review`. Out of scope for this map (see separate map if created).

### Tab bar overlap
Content has bottom padding to avoid being hidden by floating tab bar. Same as Today.

### Streak calculation performance
`getActionStreakMetrics()` scans DB for each action. Can be slow with many actions and long history. On web, this is less noticeable.

### No cache invalidation
Insights data refreshed on every focus effect (tab switch). Uses `useFocusEffect` + `refreshSignal` state.

### Goal color consistency
Goal colors match those set in Goals tab. Colors come from `getGoalColor(goalId)` utility.
