# Goals

**Route**: `/(tabs)/goals`  
**File**: `intentional-expo/app/(tabs)/goals.tsx`  
**Tab**: Fourth tab (List icon)

## Sub-features

1. **Goal list** - Shows all goals with action counts
2. **Add goal** - Sheet with name, color, icon, why statement
3. **Edit goal** - Tap goal card to open edit sheet
4. **Delete goal** - Swipe-to-delete on native, "Delete" button on web
5. **Add action** - Per-goal action composer
6. **Edit action** - Tap action row to edit
7. **Deactivate action** - Swipe-to-deactivate or "Off" button
8. **Reorder actions** - Drag-to-reorder mode (native only)
9. **Action reminders** - Set daily notification time
10. **Empty state** - CTA when no goals exist

## How to get to it (user POV)

1. Tap "Goals" tab
2. Or tap "Add action" from Today empty state
3. Or tap floating + button from Today

## Driving it with Playwright

### Navigate to Goals

```typescript
await page.goto('http://localhost:8081/(tabs)/goals');
await sleep(2000);
await page.screenshot({ path: 'evidence/goals-initial.png' });
```

**verified-web:** Goals tab shows heading "What days answer to." with session history link and active pillars list.

### Empty state (no goals)

```typescript
const emptyHeading = page.getByText(/What will your days serve/);
expect(await emptyHeading.isVisible()).toBe(true);

const addGoalBtn = page.getByRole('button', { name: 'Add your first pillar' });
await addGoalBtn.click();
await page.screenshot({ path: 'evidence/goals-add-first.png' });
```

**Empty state copy:**
- Heading: "What will your days serve?"
- Body: "Add pillars — areas of life that deserve your daily effort — then assign actions to each one."
- Button: "Add your first pillar"

### Add goal sheet

```typescript
// Sheet slides up
const nameInput = page.locator('input[placeholder*="Pillar name"]');
await nameInput.fill('Fitness');

// Color swatches (multiple circles)
const colorSwatch = page.locator('[style*="background-color: rgb"]').first();
await colorSwatch.click();

// Icon input (emoji)
const iconInput = page.locator('input[placeholder*="emoji"]');
await iconInput.fill('💪');

// Optional why statement
const whyInput = page.locator('textarea[placeholder*="why this matters"]');
await whyInput.fill('Build strength for life');

await page.screenshot({ path: 'evidence/goals-add-filled.png' });

// Save
const saveBtn = page.getByRole('button', { name: 'Save pillar' });
await saveBtn.click();
await page.screenshot({ path: 'evidence/goals-saved.png' });
```

**Add goal copy:**
- Input labels: "Pillar name", "Color", "Icon (emoji)", "Why statement (optional)"
- Placeholder: "Pillar name", "Tap a swatch", "💡", "Optional: why this matters to you"
- Button: "Save pillar"

### Edit goal

```typescript
// Tap goal card
const goalCard = page.locator('text=/Fitness/').locator('..');
await goalCard.click();
await page.screenshot({ path: 'evidence/goals-edit-sheet.png' });

// Edit fields
const nameInput = page.locator('input[value="Fitness"]');
await nameInput.clear();
await nameInput.fill('Physical Health');

// Save changes
const saveBtn = page.getByRole('button', { name: 'Save changes' });
await saveBtn.click();
await page.screenshot({ path: 'evidence/goals-updated.png' });
```

### Delete goal

```typescript
// Web: "Delete" button at bottom of edit sheet
const deleteBtn = page.getByRole('button', { name: 'Delete pillar' });
await deleteBtn.click();

// Confirm dialog
await page.getByRole('button', { name: 'Delete' }).click();
await page.screenshot({ path: 'evidence/goals-deleted.png' });
```

**Delete alert copy:**
- Title: "Delete {goalName}?"
- Body: "This will also remove all actions under this pillar."
- Buttons: "Cancel", "Delete"

### Add action

```typescript
// From goal sheet, tap "+ Add action"
const addActionBtn = page.getByRole('button', { name: 'Add action' });
await addActionBtn.click();
await page.screenshot({ path: 'evidence/goals-add-action.png' });

// Fill action details
const actionNameInput = page.locator('input[placeholder*="action name"]');
await actionNameInput.fill('Morning run');

// Type: Session or Habit
const sessionBtn = page.getByText('Session', { exact: true });
await sessionBtn.click();

// Target minutes (for Session type)
const minutesInput = page.locator('input[type="number"]');
await minutesInput.fill('30');

await page.screenshot({ path: 'evidence/goals-action-filled.png' });

// Save
const saveActionBtn = page.getByRole('button', { name: 'Save action' });
await saveActionBtn.click();
await page.screenshot({ path: 'evidence/goals-action-saved.png' });
```

**Add action copy:**
- Input labels: "Action name", "Type", "Daily target (minutes)"
- Type options: "Session", "Habit"
- Button: "Save action"

### Edit action

```typescript
// Tap action row
const actionRow = page.locator('text=/Morning run/');
await actionRow.click();
await page.screenshot({ path: 'evidence/goals-edit-action.png' });

// Edit fields
const actionNameInput = page.locator('input[value="Morning run"]');
await actionNameInput.clear();
await actionNameInput.fill('Morning jog');

// Save
const saveBtn = page.getByRole('button', { name: 'Update action' });
await saveBtn.click();
await page.screenshot({ path: 'evidence/goals-action-updated.png' });
```

### Deactivate action

```typescript
// Web: "Deactivate" button in action edit sheet
const deactivateBtn = page.getByRole('button', { name: 'Deactivate' });
await deactivateBtn.click();

// Confirm dialog
await page.getByRole('button', { name: 'Deactivate' }).click();
await page.screenshot({ path: 'evidence/goals-action-deactivated.png' });
```

**Deactivate alert copy:**
- Title: "Deactivate action?"
- Body: "\"{actionName}\" will disappear from Today. You can restore it later."
- Buttons: "Cancel", "Deactivate"

### Restore paused action

```typescript
// Paused actions show in edit sheet with "Restore" button
const restoreBtn = page.getByRole('button', { name: 'Restore' });
await restoreBtn.click();
await page.screenshot({ path: 'evidence/goals-action-restored.png' });
```

### Action reminders

```typescript
// Toggle reminder in action edit sheet
const reminderToggle = page.locator('text=/Reminder/');
await reminderToggle.click();

// Time picker (native picker on iOS, text input on web)
const timeInput = page.locator('input[type="time"]');
await timeInput.fill('08:00');

await page.screenshot({ path: 'evidence/goals-reminder-set.png' });

// Save action
const saveBtn = page.getByRole('button', { name: 'Update action' });
await saveBtn.click();
```

## Gotchas

### Reorder mode
Drag-to-reorder uses `react-native-gesture-handler` with custom logic (no `react-native-draggable-flatlist` due to worklet conflicts). **Web does NOT support drag-to-reorder**. Mark as **verified-unreachable: native gestures**.

### Action reminders on web
Expo notifications require:
- Native build (not web)
- Push notification permissions
- APNs (iOS) or FCM (Android) setup

Web can set reminder times in DB, but notifications won't fire. Mark as **verified-unreachable: native build + push permissions**.

### Goal color swatches
Colors come from `constants/design.ts`:
- `Colors.goalPhysique`
- `Colors.goalFinances`
- `Colors.goalSkills`
- `Colors.goalMind`
- `Colors.pillarCraft`
- etc.

Swatches are deduplicated (some tokens share values).

### Icon input
Accepts any emoji. No validation. Displays last 2 chars (to handle multi-byte emojis).

### Why statement length
Max 140 chars (enforced by `.slice(0, 140)`).

### Action target minutes
Session actions require `target_minutes > 0`. Habit actions default to 60 (not shown to user).

### Swipe gestures on web
Native: swipe left on goal card to reveal delete button.  
Web: delete button inside edit sheet.

Same for action deactivation.

### Goal sheet keyboard handling
Uses `KeyboardAvoidingView` on native. On web, browser handles scroll-to-input automatically.

### Empty goal (zero actions)
Goals with no actions show "No actions yet" message and "+ Add action" button.

### Action sort order
Actions have `sort_order` field. Reorder mode updates this. Initial order is insertion order.

### Goal deletion cascade
Deleting a goal deletes all its actions (foreign key constraint in SQLite).

### Edit vs. create sheet
Same component (`GoalSheet`) with `editingGoal` prop. If `editingGoal` is set, shows "Save changes" and "Delete pillar" buttons. Otherwise, shows "Save pillar".

### Action type toggle
Session type shows target minutes input. Habit type hides it (target is always 60, not user-configurable).

### Reminder time format
Stored as "HH:MM" string in `reminder_time` column. Parsed by `parseReminderTime()` from `services/notifications`.

### Goal card layout
Each goal card shows:
- Color dot
- Goal name
- Action count (e.g., "3 actions")
- Chevron icon (→)

### Action row layout
Each action row shows:
- Action name
- Type badge (Session/Habit)
- Target minutes (Session only)
- Reminder icon (if set)
- Chevron icon (→)
