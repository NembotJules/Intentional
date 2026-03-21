# INTENTIONAL — Complete UI Redesign Specification
**For: Coding Agent | Stack: Expo + NativeWind + Reanimated**

---

## 0. Diagnosis: What's Wrong With the Current UI

Before prescribing fixes, understand the root problems in the existing screens:

1. **No visual hierarchy.** Everything competes for attention equally — the "Today Score" (100), the action row, the emoji labels, the tab bar. Nothing is a clear hero element.
2. **Inconsistent, generic color usage.** The goal color is applied randomly (toggle is blue, header text is black, a random dark navy appears on the CTA button) with no systematic logic.
3. **Spatial chaos.** Cramped padding inside cards, no breathing room between sections, inconsistent margins throughout.
4. **Tab bar is disconnected from content.** It looks like a separate afterthought, not part of the design system.
5. **Typography has no personality.** Everything is the same weight, same size, same color. No contrast, no rhythm.
6. **The "100" score is enormous but unlabeled and context-free.** It's the most important metric and yet it has no ring, no label system, no relationship to the rest of the screen.
7. **The Insights screen is an empty void.** The empty state is technically correct but emotionally dead — no illustration quality, no motivational framing.
8. **The Edit Goal screen is a form, not an experience.** It has no connection to the visual language of the app.

---

## 1. Aesthetic Direction: "Deliberate Calm"

The redesign commits to a single, unwavering aesthetic: **premium minimalism with purposeful color accents**.

Think: the visual DNA of Things 3 × Notion Calendar × a high-end health app. Clean white surfaces. Precise typography. Goal colors used surgically — only as accent, never as background noise. Dark focus mode that feels like a cockpit.

**The North Star:** Every pixel should feel like it was placed on purpose.

---

## 2. Design Token System (NativeWind implementation)

### 2.1 Color Tokens

Extend your `tailwind.config.js` with these exact values:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        // Backgrounds
        'bg-primary': '#FFFFFF',
        'bg-secondary': '#F9FAFB',
        'bg-tertiary': '#F3F4F6',
        'bg-focus': '#0F0F14',

        // Text
        'text-primary': '#111827',
        'text-secondary': '#6B7280',
        'text-tertiary': '#9CA3AF',
        'text-inverse': '#FFFFFF',

        // Accent
        'accent-blue': '#1E3A8A',
        'accent-blue-light': '#3B82F6',
        'accent-success': '#16A34A',
        'accent-warning': '#D97706',
        'accent-danger': '#DC2626',

        // Separator
        'separator': '#E5E7EB',

        // Goal Primary Colors
        'goal-physique': '#4A9EED',
        'goal-finances': '#22C55E',
        'goal-skills': '#8B5CF6',
        'goal-mind': '#F59E0B',

        // Goal Tint Colors (10% opacity backgrounds)
        'goal-physique-tint': '#EFF6FF',
        'goal-finances-tint': '#F0FDF4',
        'goal-skills-tint': '#FAF5FF',
        'goal-mind-tint': '#FFFBEB',
      },
      borderRadius: {
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        'full': '9999px',
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        'xxl': '32px',
      },
      fontSize: {
        'caption': ['12px', { lineHeight: '16px' }],
        'footnote': ['13px', { lineHeight: '18px' }],
        'subheadline': ['15px', { lineHeight: '20px' }],
        'callout': ['16px', { lineHeight: '21px' }],
        'body': ['17px', { lineHeight: '22px' }],
        'headline': ['17px', { lineHeight: '22px' }],
        'title3': ['20px', { lineHeight: '25px' }],
        'title2': ['22px', { lineHeight: '28px' }],
        'title1': ['28px', { lineHeight: '34px' }],
        'largeTitle': ['34px', { lineHeight: '41px' }],
        'score': ['48px', { lineHeight: '48px' }],
        'timer': ['72px', { lineHeight: '72px' }],
      },
    }
  }
}
```

### 2.2 Goal Color Helper

Create a utility file `utils/goalColors.ts`:

```typescript
export type GoalType = 'physique' | 'finances' | 'skills' | 'mind';

export const GOAL_COLORS: Record<GoalType, {
  primary: string;
  tint: string;
  darkPrimary: string;
}> = {
  physique: { primary: '#4A9EED', tint: '#EFF6FF', darkPrimary: '#60AEFF' },
  finances: { primary: '#22C55E', tint: '#F0FDF4', darkPrimary: '#34D366' },
  skills:   { primary: '#8B5CF6', tint: '#FAF5FF', darkPrimary: '#A78BFA' },
  mind:     { primary: '#F59E0B', tint: '#FFFBEB', darkPrimary: '#FBBF24' },
};
```

---

## 3. Global Layout Rules

These rules apply to every screen without exception:

- **Screen horizontal margin:** 16px on both sides — always. No element touches the screen edge except full-bleed backgrounds and the tab bar.
- **Section gaps:** 24px between major sections. 8px between list items.
- **Card internal padding:** 16px horizontal, 12px vertical minimum.
- **No borders on cards unless elevation is zero.** Cards use shadow for elevation, not borders. Exception: input fields use a 1px `separator` border.
- **Section labels:** All caps, `footnote` size, `text-tertiary` color, `tracking-wider` (letter-spacing: 1px). Never bold.
- **Status bar:** Always use `light` content on focus screen. Auto elsewhere.

---

## 4. Typography Rules

```
Screen Titles:        largeTitle (34px), font-bold, text-primary
Section Headers:      title2 (22px), font-semibold, text-primary
Card Titles:          headline (17px), font-semibold, text-primary
Supporting text:      footnote (13px), font-normal, text-secondary
Metadata/labels:      caption (12px), font-normal, text-tertiary
Section dividers:     footnote, uppercase, text-tertiary, tracking-wider
Timer (Focus only):   timer (72px), font-thin, text-inverse
Score ring number:    score (48px), font-black, text-primary
```

**Font weight mapping for Expo:**
- `font-thin` → fontWeight: '100'
- `font-normal` → fontWeight: '400'
- `font-semibold` → fontWeight: '600'
- `font-bold` → fontWeight: '700'
- `font-black` → fontWeight: '900'

---

## 5. Shadow System

Define these as style objects in a `styles/shadows.ts` file:

```typescript
export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2, // Android
  },
  float: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 5,
  },
  modal: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.18,
    shadowRadius: 60,
    elevation: 10,
  },
};
```

---

## 6. Component Specifications

### 6.1 GoalChip

A pill tag used to label which goal an item belongs to.

```
Height:           24px
Horizontal padding: 10px
Corner radius:    full (9999px)
Background:       goal tint color (EFF6FF, F0FDF4, FAF5FF, FFFBEB)
Border:           1px solid, goal primary color
Icon:             8px emoji or SF Symbol, left side, 4px gap to label
Label:            footnote (13px), font-semibold, goal primary color
```

**NativeWind classes:**
```
h-6 px-2.5 rounded-full border flex-row items-center gap-1
```

### 6.2 ActionRow

The core list item. This is the most important component — get it right.

```
Min height:       72px (grows with content)
Corner radius:    lg (16px)
Background:       bg-secondary (#F9FAFB)
Shadow:           card shadow
Margin:           0px horizontal (parent provides 16px screen margin)
Gap from next:    8px

Layout (horizontal):
  [4px accent bar] [16px gap] [40px icon circle] [12px gap] [text block, flex:1] [12px gap] [action button or toggle]

Left accent bar:
  Width: 4px, full height, corner-radius: full
  Color: goal primary color
  When completed: color.accent.success (#16A34A)

Icon circle:
  Size: 40px × 40px
  Background: goal tint color
  Border-radius: full
  Icon: SF Symbol at 20px in goal primary color (use @expo/vector-icons or react-native-vector-icons)

Text block:
  Title: headline (17px), font-semibold, text-primary
  Subtitle: footnote (13px), text-secondary — e.g. "60 min target"
  Gap between: 2px

Progress bar (below text, full width inside text block):
  Height: 4px
  Corner-radius: full
  Track color: goal tint at 60% opacity
  Fill color: goal primary color
  Margin-top: 6px

Action area (right side):
  Session type: "Start" button — small PrimaryButton in goal color
  Habit type: Toggle (React Native Switch) with trackColor goal primary

Completed state:
  Left accent → green (#16A34A)
  Title → strikethrough, text-secondary
  Icon circle → green tint background, checkmark icon in green
  Progress bar → 100% green fill
  Action area → checkmark or "Done" text
```

**Reanimated animation:**
- On completion toggle: `withSpring` scale from 1 → 0.96 → 1 on the entire row
- Progress bar fill: `withTiming(targetWidth, { duration: 600, easing: Easing.out(Easing.cubic) })`

### 6.3 PrimaryButton

```
Default:
  Height: 50px
  Horizontal padding: 24px
  Corner-radius: full
  Background: goal color or accent-blue
  Label: headline (17px), font-semibold, text-inverse (white)

Small variant:
  Height: 36px
  Horizontal padding: 16px
  Label: subheadline (15px), font-semibold

Ghost variant:
  Background: transparent
  Border: 1.5px solid, goal color or accent-blue
  Label: goal color or accent-blue

Disabled:
  Background: bg-tertiary
  Label: text-tertiary

Press animation (Reanimated):
  useAnimatedStyle → withSpring scale to 0.95 on pressIn, 1.0 on pressOut
  opacity: withTiming(0.85) on pressIn, 1.0 on pressOut
```

### 6.4 TodayScoreRing

The hero element of the Today screen. Must be visually perfect.

```
Container size:   80px × 80px (total)
Ring track:       8px stroke width, bg-tertiary (#F3F4F6)
Ring fill:        8px stroke, animated
  - 0–33%:  amber (#F59E0B)
  - 34–66%: blue (#4A9EED)
  - 67–100%: green (#22C55E)
  Use SVG with strokeDashoffset for the ring fill animation

Center number:    score size (48px), font-black, text-primary
Center label:     caption (12px), text-secondary, 'TODAY' uppercase, 2px below number

Animation:
  On mount: strokeDashoffset animates from full (empty ring) to target value
  Duration: 800ms, easing: easeOut
  Use Reanimated SVG integration or react-native-svg with Animated
```

**Implementation note:** Use `react-native-svg` with a `Circle` element:
```tsx
// Ring circumference = 2 * π * radius
// strokeDasharray = circumference
// strokeDashoffset = circumference * (1 - percentage/100)
// Animate strokeDashoffset with Reanimated shared value
```

### 6.5 FocusTimerRing

Exclusive to the Focus screen. The emotional centerpiece.

```
Container:        260px × 260px, centered on screen
Background:       bg-focus (#0F0F14) — full screen bleed

Ring track:       6px stroke, rgba(255,255,255,0.08)
Ring fill:        6px stroke, goal primary color (dark variant: #60AEFF/#34D366/etc.)
Glow effect:      Shadow: goal color at 40% opacity, blur 24px, spread 0
  Implement with react-native-svg drop shadow filter or nested shadows

Time display:     timer (72px), font-thin, white, centered
Label:            footnote, rgba(255,255,255,0.5), 'remaining', 8px below time

Animation:
  Ring fill depletes clockwise as time elapses
  Every second: Reanimated.withTiming on strokeDashoffset
  Glow pulses subtly: withRepeat(withSequence(withTiming(0.35), withTiming(0.45)), -1)
```

---

## 7. Screen-by-Screen Redesign

### 7.1 Today Screen (Home)

**Current problems:** The "100" is enormous and unlabeled. The action row has no color language. The emoji labels for goals feel random. Empty bottom half of screen.

**New layout (top to bottom):**

```
STATUS BAR (auto)

HEADER ZONE (height: 88px, padding: 20px top, 16px horizontal)
  Left column (flex: 1):
    Line 1: "Good morning," — callout (16px), text-secondary
    Line 2: User name — title2 (22px), font-semibold, text-primary
    Line 3: "Wednesday, 18 March" — footnote, text-tertiary, margin-top: 2px
  Right column:
    TodayScoreRing (80px × 80px)

SEPARATOR (1px, separator color, 16px horizontal margin)

GOAL FILTER ROW (height: 44px, padding: 12px vertical, 16px left)
  Horizontal ScrollView (no scroll indicator)
  Items: "All" chip + one GoalChip per goal
  "All" chip style: same as GoalChip but bg-tertiary, text-primary, no border
  Active chip: filled with goal color, white label (inverse of normal GoalChip)
  Gap between chips: 8px

SECTION LABEL ("TODAY'S ACTIONS", 12px padding top, 16px horizontal)
  footnote, uppercase, text-tertiary, tracking-wider

ACTION LIST (ScrollView, 16px horizontal padding, 8px gap between items)
  ActionRows (see 6.2)
  If empty / all done:
    Center-aligned: large checkmark icon (60px, accent-success)
    "You crushed today." — title2, text-primary, margin-top: 16px

TAB BAR (83px, see 7.6)
```

**Key design decisions:**
- The `TodayScoreRing` is the only element in the header right column. Give it space.
- Never group action rows under goal headers with section labels — the left accent bar IS the goal indicator. Let the color speak.
- The filter chips allow the user to focus on one goal at a time without needing section headers.

---

### 7.2 Focus Screen

**Current state:** Does not appear in the screenshots (likely not reached). Build it right the first time.

**Full-screen dark experience:**

```
BACKGROUND: #0F0F14 — full bleed, no safe area, StatusBar light content

TOP SECTION (centered, 56px from top):
  GoalChip (dark variant):
    Background: rgba(goal_primary, 0.15)
    Border: 1px rgba(goal_primary, 0.4)
    Label: goal primary color (dark variant)
  Action name: subheadline, rgba(255,255,255,0.6), 8px below chip

CENTER (absolute center of screen):
  FocusTimerRing (260px × 260px)
  Timer: "45:00" format — timer size (72px), font-thin, white
  Glow: goal color shadow

BOTTOM SECTION (fixed, 40px above home indicator area):
  Two ghost buttons side by side (16px gap, 16px horizontal margin):
    "Pause" → ghost, goal color border, goal color label (150px wide)
    "End"   → ghost, #DC2626 border, #DC2626 label (150px wide)
  AppBlockBadge: centered, 16px above the two buttons
    Style: pill, rgba(255,255,255,0.08) bg, 1px rgba(255,255,255,0.15) border
    Icon: lock icon (12px, rgba(255,255,255,0.6))
    Label: "Apps Blocked" — caption, rgba(255,255,255,0.6)
```

**Critical:** No tab bar on the focus screen. It's a different world.

---

### 7.3 Insights Screen

**Current problems:** The empty state is a small icon with text in the center of a vast gray void. No visual interest, no motivation, no sense of what the data will look like.

**New layout:**

```
NAVIGATION BAR:
  Left: "Insights" — largeTitle, font-bold, text-primary
  Right: Segmented control (Week / Month / All)
    Style: bg-tertiary background, rounded-lg, active segment bg-white with shadow.card
    Width: 180px, height: 32px

SECTION 1 — TIME PER GOAL (16px horizontal margin):
  Section label: "TIME PER GOAL"
  Bar chart card: bg-secondary, rounded-xl, padding 16px, shadow.card
    4 bars, 48px wide each, 24px gap
    Bar: goal color fill (100%), goal tint at 40% as empty background
    Top of each bar: hours value — footnote, semibold, goal color
    Below each bar: abbreviated goal name — caption, text-secondary
    Max bar height: 120px
    Animation: bars grow from 0 on mount, staggered 100ms each

SECTION 2 — GOAL BALANCE (16px horizontal margin, 24px margin-top):
  Section label: "GOAL BALANCE"
  Radar chart card: bg-secondary, rounded-xl, padding 16px, shadow.card
    240px × 240px centered canvas
    Grid rings: 3 concentric, separator color
    Polygon: accent-blue at 15% opacity fill, 2px blue stroke
    Axis labels: caption, goal emoji + name

SECTION 3 — STREAKS (16px horizontal margin, 24px margin-top):
  Section label: "STREAKS"
  StreakBadge list (8px gap):
    Each badge: bg-secondary, rounded-lg, 64px height, shadow.card
    Left: flame icon (24px, accent-warning)
    Center: streak count (title2, text-primary) + "day streak" (subheadline, text-secondary)
    Right: "Best: X" (footnote, text-tertiary)

EMPTY STATE (when no data):
  Center of screen (not just the chart area — full screen center):
    Icon: A clean chart icon, 64px, goal color gradient (use the 4 goal colors as a 2×2 grid of small bars)
    Title: "Your progress story" — title2, text-primary, margin-top 16px
    Body: "Complete your first session and watch your week take shape." — body, text-secondary, centered, max-width 280px
    CTA: Ghost PrimaryButton "Start a Session" → navigates to Focus tab
```

---

### 7.4 Goals Manager Screen

**Current problems:** Not shown in screenshots but described in spec. The Edit Goal screen shown in screenshot 1 is the main issue.

**Goals Manager List:**

```
NAVIGATION BAR:
  Left: "My Goals" — largeTitle, font-bold, text-primary
  Right: Edit button — "Edit" text, accent-blue-light, or pencil icon

GOAL CARD LIST (16px horizontal margin, 8px gap):
  Each card: bg-primary, rounded-xl, 88px height, shadow.card

  GOAL CARD INTERNAL LAYOUT:
    Left: 48px circle, goal color fill, emoji/icon at 24px white
    Center (flex: 1, 12px left margin):
      Goal name: title2, font-semibold, text-primary
      Action count: footnote, text-secondary — "3 daily actions"
    Right (12px right margin, items-end):
      Weekly hours: headline, font-semibold, goal color — "4.5h"
      Label: caption, text-tertiary — "this week"
      Chevron: 16px, text-tertiary

ADD GOAL CARD (dashed):
  Same dimensions as goal card
  Border: 2px dashed, separator
  Center: "+" icon (24px, accent-blue) + "Add Goal" (headline, accent-blue)
  No shadow — it's an affordance, not content
```

**Edit Goal Sheet (replaces current Edit Goal screen):**

The current Edit Goal is a full-screen page. It should be a **modal bottom sheet** with a clean, intentional layout.

```
MODAL BOTTOM SHEET (not full screen):
  Handle: 36px × 4px pill, separator color, centered, 8px from top
  Corner radius: xl (24px) on top corners only
  Background: bg-primary
  Drag to dismiss: enabled

SHEET CONTENT:
  Header (16px padding, 16px top):
    "Edit Goal" — title2, font-semibold, text-primary
    Close button (×) — 24px, text-tertiary, top-right

  GOAL IDENTITY SECTION:
    Emoji picker (44px × 44px circle, goal tint bg, goal color border 2px)
      Tapping opens emoji keyboard
    Goal name input (flex: 1, 16px left of emoji):
      Input style: bg-secondary, rounded-lg, height 50px, horizontal padding 16px
      Font: title3, text-primary
      Placeholder: "Goal name", text-tertiary

  COLOR THEME SECTION:
    Section label: "COLOR THEME" — footnote, uppercase, text-tertiary, tracking-wider
    Color swatches: 4 circles (36px each), 12px gap
      Physique (#4A9EED), Finances (#22C55E), Skills (#8B5CF6), Mind (#F59E0B)
      Selected state: white border 3px + shadow.card (ring effect)
      Unselected: plain circle

  THE "WHY" SECTION:
    Section label: "YOUR WHY" — same style
    Multiline input: bg-secondary, rounded-lg, 100px height, 16px padding
    Placeholder: "Why does this goal matter to you?"
    Character count: caption, text-tertiary, right-aligned below input, "0 / 140"

  DAILY ACTIONS SECTION:
    Section label: "DAILY ACTIONS" + action count badge
    List of actions (simplified ActionRows without start button)
    Each action has:
      Left accent bar (goal color)
      Name: headline, text-primary
      Type badge: "Habit" or "Session + Xmin" — footnote, text-secondary
      Swipe-left: delete (danger color)
    "Add New Action" card:
      Dashed border, rounded-lg, 56px height
      "+" icon + "Add New Action" — headline, accent-blue

  SAVE BUTTON (fixed to bottom, 16px margin, 16px bottom safe area):
    PrimaryButton full-width "Save Changes" — accent-blue background
```

---

### 7.5 Session Complete Screen

```
BACKGROUND: bg-primary
CONFETTI: React Native confetti library (e.g. react-native-confetti-cannon)
  Colors: all 4 goal colors
  Origin: { x: screenWidth/2, y: 0 }
  Auto-fire on mount

COMPLETION CARD (centered, 360px wide, rounded-xl, bg-primary, shadow.float):
  Check icon circle: 64px, goal tint background, checkmark at 40px, goal color
    Animate: scale from 0 to 1.2 to 1.0 (spring) on mount
  "Session Complete" — title1, goal color, font-bold, centered, mt 16px
  Time logged: largeTitle, font-bold, text-primary — "2h 03m" — large and proud
  GoalChip: centered below time — shows goal attribution
  StreakBadge: below GoalChip, full width inside card padding
  Note input: body placeholder "How did the session feel? (optional)"
    bg-secondary, rounded-lg, 80px height, 16px padding
  "Back to Today" button: PrimaryButton, accent-blue, full-width, mt 16px
```

---

### 7.6 Tab Bar

The tab bar is currently a weak link. Redesign it:

```
Height: 83px (includes home indicator area)
Background: bg-primary with blur effect (expo-blur BlurView, intensity: 80, tint: light)
Top border: 1px separator color
Safe area: respect bottom inset (use useSafeAreaInsets)

Tabs: Today / Focus / Insights / Goals
Each tab:
  Icon: 24px (use appropriate icon set — Ionicons recommended for Expo)
  Label: caption (12px), 4px below icon
  Inactive: icon + label in text-tertiary
  Active: icon + label in accent-blue (#1E3A8A)
  Active indicator: small dot (6px, accent-blue) below label OR
    subtle bg-tertiary pill behind icon+label (pill height 32px, rounded-full)

Recommended icons:
  Today    → house or home-outline / house.fill (active)
  Focus    → timer-outline / timer (active)
  Insights → bar-chart-outline / bar-chart (active)
  Goals    → list-outline / list (active)

Animation (Reanimated):
  On tab switch: icon scale withSpring(1.15) then back to 1.0
  Label: withTiming on opacity and color
```

---

## 8. Animation Choreography

Use `react-native-reanimated` (v3) for all animations. Never use the JS Animated API.

### 8.1 Screen Entry Animations

Every screen entrance should have a coordinated reveal:
```
Pattern: Staggered fade-up
  - Each element enters with: opacity 0→1, translateY 12→0
  - Duration: 350ms per element
  - Stagger: 80ms between elements
  - Easing: Easing.out(Easing.cubic)

Implementation: Use entering={FadeInDown.delay(n * 80).duration(350)} from reanimated
```

### 8.2 Action Row Completion

When a habit is toggled or session completed:
```
1. Row scales: withSpring({ scale: 0.97 }) then back to 1.0
2. Left accent bar color transitions: withTiming to green (#16A34A), 400ms
3. Progress bar fills: withTiming to full width, 600ms, easeOut
4. Checkmark icon: scale from 0 to 1, withSpring (damping: 10, stiffness: 200)
5. Today Score ring: re-animates to new value, 800ms
```

### 8.3 Focus Timer

```
Ring depletion: Every second, Reanimated shared value decrements
  withTiming(newOffset, { duration: 1000, easing: Easing.linear })

Glow pulse:
  withRepeat(
    withSequence(
      withTiming(0.35, { duration: 2000 }),
      withTiming(0.5, { duration: 2000 })
    ),
    -1,
    true
  )
```

### 8.4 Score Ring on Load

```
Initial: strokeDashoffset = full circumference (empty)
Animate to: target value
Timing: 800ms, Easing.out(Easing.exp)
Color: interpolate based on percentage
```

---

## 9. Navigation Architecture

```
Root Navigator: Tab Navigator (custom tab bar)
  Tab 1: Today Stack
    - TodayScreen
    - (no sub-screens needed)
  Tab 2: Focus Stack
    - FocusScreen (modal full-screen on iOS)
    - PreSessionSheet (bottom sheet modal)
    - SessionCompleteScreen
  Tab 3: Insights Stack
    - InsightsScreen
  Tab 4: Goals Stack
    - GoalsManagerScreen
    - EditGoalSheet (bottom sheet modal, not full-screen push)

Modal Presentation:
  EditGoalSheet: use @gorhom/bottom-sheet or expo-router sheet modal
  PreSessionSheet: same
  These should NOT be full-screen stack pushes — they are sheets
```

---

## 10. Implementation Priority Order

Build in this exact order to always have a shippable app:

1. **Design tokens** — tailwind config, goal color utility, shadow constants
2. **Tab bar** — custom component, correct dimensions, Reanimated switch animation
3. **ActionRow component** — the most-used element, get it perfect
4. **GoalChip component** — used everywhere
5. **PrimaryButton component** — all variants
6. **Today Screen** — wire up ActionRows, GoalChips, header
7. **TodayScoreRing** — SVG ring, animation
8. **Goals Manager Screen** — goal cards, edit sheet
9. **Focus Screen** — dark mode, timer ring, FocusTimerRing
10. **Session Complete Screen** — confetti, completion card
11. **Insights Screen** — charts, empty state
12. **All animations** — add Reanimated choreography last, after layout is correct

---

## 11. Common Mistakes to Avoid

- **Never use `position: absolute` for the TodayScoreRing** — it should be in a `flexDirection: 'row'` header with `justifyContent: 'space-between'`
- **Never apply goal tint color as ActionRow background** — the background is always `bg-secondary (#F9FAFB)`. Goal color only touches the accent bar, icon circle, and progress bar fill.
- **Never use a tab bar with static `height: 49`** — always use `useSafeAreaInsets().bottom + 49` for the actual content height
- **Never put an explicit `borderRadius` on the focus screen background** — it's full bleed
- **Never animate with the JS thread** — all `withSpring`/`withTiming` must be inside `useAnimatedStyle` or `withTiming` on a shared value
- **Never hardcode platform-specific spacing** — use `Platform.OS` or Expo's `useWindowDimensions`
- **Section headers must not have divider lines** — use the uppercase label style only
- **The "Edit Goal" page must become a bottom sheet** — full-screen push navigation breaks the mental model
- **Goal color is not decorative — it's semantic.** Only apply it where it communicates goal identity.

---

## 12. Library Recommendations

```
Navigation:       expo-router (file-based) or @react-navigation/native
Bottom sheets:    @gorhom/bottom-sheet
SVG:              react-native-svg (for rings and radar chart)
Confetti:         react-native-confetti-cannon
Icons:            @expo/vector-icons (Ionicons)
Blur:             expo-blur (tab bar)
Animations:       react-native-reanimated v3
Haptics:          expo-haptics (on action completion, session start)
Safe area:        react-native-safe-area-context
```

**Haptics implementation:**
- Action completed → `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`
- Session started → `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)`
- Button press → `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`

---

## 13. Design Quality Checklist

Before shipping any screen, verify:

- [ ] All text uses defined token sizes (no raw px values)
- [ ] All colors reference the token system (no hardcoded hex except in the token file)
- [ ] All cards have `shadow.card` applied
- [ ] Horizontal margins are exactly 16px on both sides
- [ ] No element touches the status bar or home indicator area without safe area inset
- [ ] Goal color is ONLY used for: accent bar, icon circle bg, progress fill, chip, and button (not for card backgrounds)
- [ ] All press interactions have a Reanimated scale animation
- [ ] All screen entries have the staggered fade-up animation
- [ ] Tab bar active state is clearly distinct from inactive
- [ ] Empty states are motivational, not just informational
- [ ] The Focus screen has ZERO non-essential elements
- [ ] The TodayScoreRing animates on every score change
- [ ] Bottom sheets are used for editing flows, not full-screen pushes