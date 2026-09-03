# Focus

**Route**: `/(tabs)/focus`  
**File**: `intentional-expo/app/(tabs)/focus.tsx`  
**Tab**: Second tab (Timer icon)

## Sub-features

1. **Manual session** - Start without pre-selecting goal/action
2. **Goal/action picker** - Browse goals and actions in sheets
3. **Session timer** - Countdown with pause/resume/stop
4. **App blocking controls** - Enable/disable shields (iOS Family Controls only)
5. **Session completion** - Save with optional note
6. **Duration presets** - 25/45/60/90/120 minutes
7. **Session history** - Link to past sessions
8. **Streak display** - Current action streak during session

## How to get to it (user POV)

1. Tap "Focus" tab
2. Or tap "Start" on a session action from Today
3. Or tap "Start manual focus" from Today empty state

## Driving it with Playwright

### Navigate to Focus

```typescript
await page.goto('http://localhost:8081/(tabs)/focus');
await page.waitForURL(/\/\(tabs\)\/focus/);
await page.screenshot({ path: 'evidence/focus-initial.png' });
```

### Manual session (no goal selected)

```typescript
// Default state: no goal/action selected
const selectGoalBtn = page.getByRole('button', { name: /Select/ });
await selectGoalBtn.click();
await page.screenshot({ path: 'evidence/focus-goal-sheet.png' });

// Pick a goal from sheet
await page.getByText('Body').click();
await page.screenshot({ path: 'evidence/focus-goal-selected.png' });

// Pick an action
const actionSheet = page.locator('text=/Morning workout/');
await actionSheet.click();
await page.screenshot({ path: 'evidence/focus-action-selected.png' });
```

### Duration selection

```typescript
// Duration chips (25/45/60/90/120)
const duration45 = page.getByText('45', { exact: true });
await duration45.click();
await page.screenshot({ path: 'evidence/focus-duration-45.png' });
```

### Start session

```typescript
const startBtn = page.getByRole('button', { name: 'Start' });
await startBtn.click();
await page.screenshot({ path: 'evidence/focus-session-running.png' });

// Timer should be visible and counting down
const timer = page.locator('text=/\\d{1,2}:\\d{2}/'); // e.g., "44:59"
expect(await timer.isVisible()).toBe(true);
```

### Pause and resume

```typescript
const pauseBtn = page.getByRole('button', { name: 'Pause' });
await pauseBtn.click();
await page.screenshot({ path: 'evidence/focus-session-paused.png' });

const resumeBtn = page.getByRole('button', { name: 'Resume' });
await resumeBtn.click();
await page.screenshot({ path: 'evidence/focus-session-resumed.png' });
```

### Stop session early

```typescript
const stopBtn = page.getByRole('button', { name: 'Stop' });
await stopBtn.click();

// Confirm dialog
await page.getByRole('button', { name: 'Stop session' }).click();
await page.screenshot({ path: 'evidence/focus-session-stopped.png' });
```

### Complete session

```typescript
// Wait for timer to reach 0:00 (or stop early)
// Completion screen appears

// Optional note
const noteInput = page.locator('textarea[placeholder*="session note"]');
await noteInput.fill('Completed workout routine');

// Save
const saveBtn = page.getByRole('button', { name: 'Save session' });
await saveBtn.click();
await page.screenshot({ path: 'evidence/focus-session-saved.png' });

// Returns to idle state
```

### App blocking (iOS only)

```typescript
// Shield toggle (iOS Family Controls)
const shieldToggle = page.locator('text=/Enable shields/');
if (await shieldToggle.isVisible()) {
  await shieldToggle.click();
  // On web, this is a no-op shim
  await page.screenshot({ path: 'evidence/focus-shields-enabled.png' });
}
```

## Gotchas

### iOS Family Controls
App blocking requires:
- Custom iOS build (not Expo Go)
- Physical device
- Screen Time permission granted
- `FamilyActivityPicker` to select blocked categories

On web, the toggle exists but does nothing. Mark as **verified-unreachable: custom iOS build + physical device**.

### Session persistence
Sessions are saved to `focus_sessions` table. On web, this doesn't persist across page reloads (shim DB).

### Timer accuracy
Timer uses `setInterval(1000)` and adjusts for drift. Not frame-perfect, but good enough for user sessions.

### Shields state machine
The `services/focusSessionDomain.ts` module manages session state transitions:
- `idle` → `running` → `paused` → `running` → `completed`
- Shields applied/removed based on `shouldApplyShieldsOnTransition()` / `shouldRemoveShieldsOnTransition()`

### Manual vs. linked sessions
- Manual: user selects goal/action after starting timer
- Linked: goal/action pre-selected via `goalId` and `actionId` URL params

### Session note
Optional `note` field saved with session. Exposed in session history and weekly review.

### Streak display
During session, shows current action streak if ≥ 2 days. Calculated by `api.getActionStreakMetrics()`.

### Background timer
On native, timer continues in background. On web, tab must stay open (or use Service Worker for notifications).

### Session history link
"View history" link navigates to `/session-history`. Out of scope for this map (see separate map if created).

### Tab bar hiding
During active session, tab bar visibility changes to give more screen real estate. On web, this is less important.

### Countdown format
- `formatCountdown()` returns `"MM:SS"` for sessions < 60 min
- Returns `"H:MM:SS"` for sessions ≥ 60 min

### Shield copy variants
Shield button shows different copy based on state:
- Idle: "Enable shields"
- Running with shields: "Shields active"
- Running without shields: "Enable shields"
- Paused: "Shields paused"

Web shim always shows "Enable shields" but does nothing.

### Session completion edge case
If timer reaches 0:00 while app is backgrounded (native) or tab is inactive (web), completion screen may not appear until foregrounded. Workaround: manual stop.
