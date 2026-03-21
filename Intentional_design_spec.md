# INTENTIONAL — Complete Design Specification
**For AI Agent Use · Expo / React Native · v1.0**

---

## SECTION 1 — Design Philosophy & Aesthetic Rules

### The Core Rule: Split Personality

The app operates in two distinct visual modes. Every screen is assigned exactly one mode. There are no exceptions.

| Mode | When to use | Background | Grain | Scanlines |
|------|-------------|------------|-------|-----------|
| **BRUTALIST** | Focus Session, Session Complete, Welcome (Step 1) | `#080808` | ON — opacity 0.04 | ON |
| **CLEAN DARK** | Today, Insights, Goals Manager, Onboarding Steps 2–4 | `#0d0d0d` | OFF | OFF |

**Why this matters:** BRUTALIST mode signals presence and ceremony — entering focus, completing a session. CLEAN DARK mode signals utility — scanning tasks, reading data. Applying grain to data screens destroys legibility. Omitting it from focus screens kills the atmosphere.

### The Grain + Scanline Implementation

The grain and scanline overlays are always two separate absolute-positioned views stacked above all content with `pointerEvents: 'none'`.

**Grain layer** — use a React Native `Canvas` (via `@shopify/react-native-skia`) drawing a fractal noise pattern, or a static PNG tileable grain asset at ~200×200px tiled across the screen. Opacity: `0.04`. zIndex: 98.

**Scanline layer** — a View with a repeating linear gradient: `repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,0,0,0.05) 3px, rgba(0,0,0,0.05) 4px)`. In React Native, implement as an `<Animated.View>` with a manually tiled pattern using SVG stripes. Opacity: 1.0. zIndex: 99.

All interactive content sits at zIndex 1–10.

### The Goal Color Rule

Every UI element that *belongs to* or *represents* a specific Meta Goal must render in that goal's color. Neutral chrome never takes a goal color.

**Elements that inherit goal color:**
- Action row left accent bar
- Goal dot / pill background
- Focus session timer ring stroke
- Focus session CTA button border + text
- Streak card number
- Radar chart polygon fill + vertex dots
- Bar chart fill
- Session Complete burst rings + checkmark + CTA border
- Onboarding color swatch selection state
- Chip selector (type, duration) selected state border + text

**Elements that never take goal color (always neutral):**
- Tab bar icons and labels
- Section `▶` labels
- Divider lines
- Page background
- Notch
- Progress dots (active dot = `#e8e4dc`, done = `#333`, inactive = `#1e1e1e`)

---

## SECTION 2 — Global Design Tokens

### Backgrounds

```
BG_DEEPEST   #080808   — BRUTALIST screens only
BG_BASE      #0d0d0d   — CLEAN DARK page background
BG_SURFACE   #111111   — lifted surface (e.g. Today screen base)
BG_CARD      #161616   — action row cards, input fields
BG_ELEVATED  #1a1a1a   — secondary cards, streak cards
BG_OVERLAY   #0e0e0e   — text input areas, why-box
```

### Goal Colors

```
PHYSIQUE     #4A9EED   — Blue
FINANCES     #22C55E   — Green
SKILLS       #8B5CF6   — Purple
MIND         #F59E0B   — Amber
```

Additional palette for user-created goals (in order of assignment):
```
EXTRA_1      #EF4444   — Red
EXTRA_2      #EC4899   — Pink
EXTRA_3      #14B8A6   — Teal
```

Each goal color used for borders should be applied at 25–30% opacity on dark backgrounds. Use these border variants:
```
PHYSIQUE border   rgba(74, 158, 237, 0.28)
FINANCES border   rgba(34, 197, 94, 0.28)
SKILLS border     rgba(139, 92, 246, 0.28)
MIND border       rgba(245, 158, 11, 0.28)
```

### Text Colors

```
TEXT_PRIMARY     #e8e4dc   — headlines, key values
TEXT_SECONDARY   #888888   — goal names (inactive state)
TEXT_MUTED       #555555   — body copy, descriptions
TEXT_DIM         #444444   — timer sub-labels, char counts
TEXT_GHOST       #333333   — section labels, meta tags
TEXT_INVISIBLE   #2a2a2a   — placeholder text, skip links
TEXT_BORDER_LOW  #222222   — subtle borders
TEXT_BORDER_MID  #1e1e1e   — card borders
TEXT_BORDER_HIGH #1a1a1a   — dividers
```

### Typography

**Display font:** `Space Grotesk` (Google Fonts)
- Weights used: 300 (timer only), 400, 500, 700
- Used for: all headlines, goal names, timer, large numbers, onboarding headline

**Metadata font:** `IBM Plex Mono` (Google Fonts)
- Weights used: 300, 400, 500
- Used for: section labels, tags, dates, button text, CTA text, caption data, char counts, tab labels

**Never use:** Inter, Roboto, SF Pro, system default sans for any display or label text.

### Font Size Scale

```
72px   Space Grotesk 300   — Focus timer (large countdown)
54px   Space Grotesk 700   — Hero headline (Welcome screen)
34px   Space Grotesk 700   — Featured block headline
22px   Space Grotesk 700   — Screen title (Today, Insights)
20px   Space Grotesk 700   — Onboarding step headline
18px   Space Grotesk 700   — Card titles, streak values
16px   Space Grotesk 700   — Goal name preview pill
14px   Space Grotesk 700   — Goal name input, action name
13px   Space Grotesk 700   — Streak number (compact)
12px   Space Grotesk 400   — Supporting body text

11px   IBM Plex Mono 400   — Action name in row
10px   IBM Plex Mono 400   — Body / description text
 9px   IBM Plex Mono 400   — Section tag, step tag
 8px   IBM Plex Mono 400   — CTA button text, meta labels
 7px   IBM Plex Mono 400   — Color label, type label, tab label
 6px   IBM Plex Mono 400   — Char count, sub-sub labels
```

### Letter Spacing

```
Headlines (Space Grotesk 700):   -0.04em
Goal names (Space Grotesk 700):  -0.03em
Body text:                        0.02em
IBM Plex labels:                  0.20em – 0.25em
CTA buttons:                      0.20em
Tab labels:                       0.08em – 0.10em
```

### Border Radius

```
RADIUS_SM    4px    — duration/type chips, badge pills
RADIUS_MD    6px    — streak cards, icon chips
RADIUS_LG    8px    — action rows, input fields, CTA buttons
RADIUS_XL    10px   — session complete card
RADIUS_PHONE 32–36px — phone shell (mockup only, not in app)
```

### Spacing Scale

```
4px   — gap between dots, tight icon spacing
5px   — gap between chips
6px   — gap between swatch and label
8px   — internal card padding (compact)
10px  — standard card horizontal padding
12px  — gap between goal groups
14px  — section gap
16px  — screen horizontal padding
20px  — between major sections
24px  — screen top padding (below notch)
28px  — hero section top padding
```

### Border Widths

```
0.5px  — all card borders, input borders, dividers, CTA ghost borders
1px    — goal left accent bar width
1.5px  — goal color ring (timer), swatch selection ring
2px    — progress dot height
3px    — progress dot (active) — same height, wider width (16px)
```

---

## SECTION 3 — Component Library

Every component below is defined once. Reuse exactly across all screens.

### 3.1 Screen Shell

Every screen wraps its content in:

```jsx
// BRUTALIST mode
<View style={{ flex: 1, backgroundColor: '#080808' }}>
  <GrainOverlay />       // absolute, zIndex 98
  <ScanlineOverlay />    // absolute, zIndex 99
  <View style={{ flex: 1, zIndex: 1, paddingTop: 52, paddingHorizontal: 16 }}>
    {/* screen content */}
  </View>
</View>

// CLEAN DARK mode
<View style={{ flex: 1, backgroundColor: '#0d0d0d' }}>
  <View style={{ flex: 1, paddingTop: 52, paddingHorizontal: 16 }}>
    {/* screen content */}
  </View>
</View>
```

### 3.2 SectionLabel

The `▶` prefixed uppercase mono label used before every content group.

```jsx
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 7 }}>
  <Text style={{ fontFamily: 'IBMPlexMono', fontSize: 6, color: '#333', letterSpacing: 1 }}>▶</Text>
  <Text style={{ fontFamily: 'IBMPlexMono', fontSize: 7, color: '#333', letterSpacing: 3.5, textTransform: 'uppercase' }}>
    {label}
  </Text>
</View>
```

### 3.3 GoalPill

Small inline pill showing a goal's color dot + name. Used in onboarding steps 3–4 and action rows as context.

```jsx
<View style={{
  flexDirection: 'row', alignItems: 'center', gap: 7,
  backgroundColor: '#0e0e0e', borderWidth: 0.5, borderColor: '#1a1a1a',
  borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10,
}}>
  <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: goalColor }} />
  <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 10, color: '#e8e4dc', letterSpacing: -0.1 }}>
    {goalName}
  </Text>
</View>
```

### 3.4 ActionRow

The core repeating unit on the Today screen. Two states: default and done.

```jsx
<View style={{
  backgroundColor: '#161616', borderWidth: 0.5, borderColor: '#222',
  borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10,
  flexDirection: 'row', alignItems: 'center', gap: 8,
  opacity: isDone ? 0.45 : 1.0,
  marginBottom: 4,
}}>
  {/* Left accent bar */}
  <View style={{ width: 2, height: 28, borderRadius: 2, backgroundColor: goalColor }} />

  {/* Info */}
  <View style={{ flex: 1 }}>
    <Text style={{ fontFamily: 'IBMPlexMono', fontSize: 11, fontWeight: '500', color: '#d8d4cc' }}>
      {actionName}
    </Text>
    <Text style={{ fontFamily: 'IBMPlexMono', fontSize: 8, color: '#444', marginTop: 1, letterSpacing: 0.5 }}>
      {subLabel}  {/* e.g. "45 min · 0 logged" or "done" */}
    </Text>
  </View>

  {/* Right: START button or checkmark */}
  {isDone ? (
    <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: goalColor, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 8, color: '#080808', fontWeight: '700' }}>✓</Text>
    </View>
  ) : (
    <TouchableOpacity style={{
      borderWidth: 0.5, borderColor: goalColorBorder, borderRadius: 4,
      paddingVertical: 4, paddingHorizontal: 8,
    }}>
      <Text style={{ fontFamily: 'IBMPlexMono', fontSize: 7, color: goalColor, letterSpacing: 2 }}>START</Text>
    </TouchableOpacity>
  )}
</View>
```

### 3.5 ProgressDots

Four-dot step indicator used in onboarding.

```jsx
<View style={{ flexDirection: 'row', gap: 5 }}>
  {[0,1,2,3].map(i => (
    <View key={i} style={{
      width: i === currentStep ? 16 : 16,
      height: 3,
      borderRadius: 2,
      backgroundColor: i === currentStep ? '#e8e4dc' : i < currentStep ? '#333' : '#1e1e1e',
    }} />
  ))}
</View>
```

### 3.6 CTAButton (Primary)

Full-width bordered button. Color is always the active goal color or `#e8e4dc` for neutral screens.

```jsx
<TouchableOpacity style={{
  width: '100%', paddingVertical: 11, borderRadius: 8,
  borderWidth: 0.5, borderColor: goalColorBorder,
  alignItems: 'center', justifyContent: 'center',
  backgroundColor: 'transparent',
}}>
  <Text style={{
    fontFamily: 'IBMPlexMono', fontSize: 8, color: goalColor,
    letterSpacing: 3.5, textTransform: 'uppercase',
  }}>
    {label}
  </Text>
</TouchableOpacity>
```

For the neutral Welcome screen CTA, use `color: '#e8e4dc'` and `borderColor: '#2a2a2a'`.

### 3.7 CTAGhost (Secondary / Skip)

Low-contrast text-only link. Always below primary CTA.

```jsx
<TouchableOpacity style={{ alignItems: 'center', marginTop: 6 }}>
  <Text style={{
    fontFamily: 'IBMPlexMono', fontSize: 7, color: '#2a2a2a',
    letterSpacing: 2.5, textTransform: 'uppercase',
  }}>
    {label}
  </Text>
</TouchableOpacity>
```

### 3.8 TabBar

Bottom navigation. 4 items: Today, Focus, Insights, Goals.

```jsx
<View style={{
  flexDirection: 'row', justifyContent: 'space-around',
  paddingTop: 7, paddingBottom: 12,
  borderTopWidth: 0.5, borderTopColor: '#1a1a1a',
}}>
  {tabs.map(tab => (
    <TouchableOpacity key={tab.id} style={{ alignItems: 'center', gap: 2 }}>
      <TabIcon name={tab.icon} active={activeTab === tab.id} />
      <Text style={{
        fontFamily: 'IBMPlexMono', fontSize: 7, letterSpacing: 1.5,
        textTransform: 'uppercase',
        color: activeTab === tab.id ? '#e8e4dc' : '#2e2e2e',
      }}>
        {tab.label}
      </Text>
    </TouchableOpacity>
  ))}
</View>
```

Tab icons are thin-stroke SVG outlines, 16×16px. Never filled. Active = `#e8e4dc` stroke, inactive = `#2e2e2e` stroke.

### 3.9 StatCell

Small metric card used in Insights top row.

```jsx
<View style={{
  flex: 1, backgroundColor: '#141414', borderWidth: 0.5, borderColor: '#1e1e1e',
  borderRadius: 6, paddingVertical: 6, paddingHorizontal: 7,
}}>
  <Text style={{ fontFamily: 'IBMPlexMono', fontSize: 6, color: '#333', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>
    {label}
  </Text>
  <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 13, color: valueColor || '#e8e4dc', letterSpacing: -0.2 }}>
    {value}
  </Text>
</View>
```

### 3.10 StreakCard

```jsx
<View style={{
  flex: 1, backgroundColor: '#141414', borderWidth: 0.5, borderColor: '#1e1e1e',
  borderRadius: 6, padding: 7,
}}>
  <Text style={{ fontFamily: 'IBMPlexMono', fontSize: 9, fontWeight: '500', color: goalColor, marginBottom: 3 }} numberOfLines={1}>
    {actionName}
  </Text>
  <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: goalColor, letterSpacing: -0.3, lineHeight: 16 }}>
    {currentStreak}
  </Text>
  <Text style={{ fontFamily: 'IBMPlexMono', fontSize: 6, color: '#333', letterSpacing: 1.5, marginTop: 1, textTransform: 'uppercase' }}>
    DAYS · BEST {bestStreak}
  </Text>
</View>
```

### 3.11 ColorSwatch

Used in Goal creation step.

```jsx
<TouchableOpacity
  style={{
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: color,
    borderWidth: isSelected ? 1.5 : 0,
    borderColor: isSelected ? '#e8e4dc' : 'transparent',
  }}
  onPress={() => onSelect(color)}
/>
```

### 3.12 ChipSelector (Type / Duration)

```jsx
// Type chip (Habit / Session)
<TouchableOpacity style={{
  flex: 1, paddingVertical: 6, borderRadius: 6,
  borderWidth: 0.5,
  borderColor: isSelected ? goalColor : '#1e1e1e',
  alignItems: 'center',
}}>
  <Text style={{
    fontFamily: 'IBMPlexMono', fontSize: 7, letterSpacing: 1.5,
    color: isSelected ? goalColor : '#333',
    textTransform: 'uppercase',
  }}>
    {label}
  </Text>
</TouchableOpacity>

// Duration chip (25m / 45m / 60m / 90m / Custom)
<TouchableOpacity style={{
  paddingVertical: 5, paddingHorizontal: 8, borderRadius: 5,
  borderWidth: 0.5,
  borderColor: isSelected ? goalColor : '#1e1e1e',
}}>
  <Text style={{
    fontFamily: 'IBMPlexMono', fontSize: 7, letterSpacing: 1.5,
    color: isSelected ? goalColor : '#333',
    textTransform: 'uppercase',
  }}>
    {label}
  </Text>
</TouchableOpacity>
```

### 3.13 ScoreRing

SVG circle ring used on Today screen top-right.

```jsx
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

<Svg width={48} height={48} viewBox="0 0 48 48">
  {/* Track */}
  <Circle cx={24} cy={24} r={20} fill="none" stroke="#1e1e1e" strokeWidth={3} />
  {/* Progress — circumference = 2π×20 = 125.6 */}
  <Circle
    cx={24} cy={24} r={20} fill="none"
    stroke={topGoalColor}  // color of highest-time goal this week
    strokeWidth={3}
    strokeDasharray={125.6}
    strokeDashoffset={125.6 * (1 - score / 100)}
    strokeLinecap="round"
    transform="rotate(-90 24 24)"
  />
  <SvgText x={24} y={22} textAnchor="middle" fontFamily="SpaceGrotesk-Bold" fontSize={9} fill="#e8e4dc">
    {score}
  </SvgText>
  <SvgText x={24} y={30} textAnchor="middle" fontFamily="IBMPlexMono" fontSize={5} fill="#444" letterSpacing={1}>
    SCORE
  </SvgText>
</Svg>
```

`score` is 0–100, calculated as: `(completedActions / totalActions) * 100` rounded to integer.

### 3.14 TimerRing

SVG ring for Focus screen. Larger, more dramatic.

```jsx
// circumference = 2π×62 = 389.6
<Circle
  cx={70} cy={70} r={62} fill="none"
  stroke={goalColor}
  strokeWidth={1.5}
  strokeDasharray={389.6}
  strokeDashoffset={389.6 * (1 - elapsed / totalDuration)}
  strokeLinecap="round"
  transform="rotate(-90 70 70)"
  opacity={0.8}
/>
```

### 3.15 RadarChart

Pure SVG. 4 axes (one per goal). Equal = regular quadrilateral. Drawn with SVG `<polygon>` and `<line>` grid.

Grid rings: 3 rings at radii 15, 29, 44. Grid color: `#1e1e1e` (innermost) → `#1a1a1a` → `#161616`.
Axis lines: `#1a1a1a`, 0.5px.
Data polygon fill: `rgba(139, 92, 246, 0.15)` — use the color of the dominant goal.
Data polygon stroke: dominant goal color, 1px.
Vertex dots: 2.5px radius, filled with that axis's goal color.

Axis labels: `IBMPlexMono`, 6px, color `#333`, letter-spacing 1.

---

## SECTION 4 — Screen Specifications

### 4.1 Onboarding — Step 1: Welcome

**Mode:** BRUTALIST  
**Background:** `#080808`  
**Grain:** ON · **Scanlines:** ON

**Layout (top to bottom):**
1. Progress dots row — 4 dots, first active — `paddingTop: 32, marginBottom: 20`
2. Stacked wordmark — "IN / TEN / TION / AL." in Space Grotesk 700, fontSize 48, color `#1a1a1a`. The period is part of the last line. `marginBottom: 16`
3. Pull quote block — left border 1px `#1e1e1e`, paddingLeft 10, the James Clear quote in IBMPlexMono 8px color `#2a2a2a`, attribution line color `#222`. `marginBottom: 16`
4. Body copy — IBMPlexMono 9px color `#3a3a3a`, `marginBottom: auto` (pushes CTA to bottom)
5. Primary CTA — "BEGIN ▶" — neutral style (`#e8e4dc` text, `#2a2a2a` border)

**No tab bar on any onboarding screen.**

**Body copy (exact):**  
`Every hour you spend should trace back to something you care about. This is the system.`

---

### 4.2 Onboarding — Step 2: Create Goal

**Mode:** CLEAN DARK  
**Background:** `#0d0d0d`

**Layout:**
1. Progress dots — dot 0 done, dot 1 active — `marginBottom: 16`
2. StepTag — `#01 · Meta goal`
3. Headline — "Name your first pillar." — SpaceGrotesk 700, 20px, `marginBottom: 10`
4. Goal name input — full width, `backgroundColor: '#0e0e0e'`, `borderColor: '#222'`, `borderRadius: 7`, `padding: 9 11`, SpaceGrotesk 700 14px `#e8e4dc`. Placeholder: "Physique"
5. Label "Color" + ColorSwatch row (7 swatches, gap 6)
6. GoalPill preview — updates live as name/color change
7. Thin divider `#141414`
8. Body copy — IBMPlexMono 8px `#282828` — "You can create 3–5 pillars. These are the roots of everything in the app."
9. Primary CTA — "NEXT ▶" — goal color (active swatch color)
10. Ghost CTA — "+ Add another goal"

**Interaction rule:** When user selects a color swatch:
- CTA button border-color → `goalColorBorder`
- CTA button text color → `goalColor`
- GoalPill dot color → `goalColor`
- This is driven by a single `selectedColor` state variable. No animation/transition — instant.

**Default selected color:** `#4A9EED` (Physique blue)

---

### 4.3 Onboarding — Step 3: Daily Action

**Mode:** CLEAN DARK  
**Background:** `#0d0d0d`

**Layout:**
1. Progress dots — dots 0–1 done, dot 2 active — `marginBottom: 16`
2. StepTag — `#02 · Daily action`
3. Headline — "What will you do for it?" — SpaceGrotesk 700, 19px, `marginBottom: 4`
4. GoalPill — shows parent goal (name + color from step 2), fontSize 10px — `marginBottom: 10`
5. Action name input — same style as goal input, placeholder "Morning run"
6. Label "Type" + 2 ChipSelectors side by side: `Habit` | `Session`. Default: `Session` selected.
7. Label "Target duration" + 5 duration chips in a flex-wrap row: `25m`, `45m`, `60m`, `90m`, `Custom`. Default: `45m` selected.
8. Thin divider `#141414`
9. Body copy — IBMPlexMono 8px `#282828` — "Sessions log time. Habits are done / not done. You can add more later."
10. Primary CTA — "NEXT ▶" — goal color

**Interaction rules:**
- When `Habit` type is selected: hide the duration row entirely (Habits have no duration target)
- When `Session` type is selected: show duration row
- Duration chips + type chips use the inherited goal color for selected state (from step 2)

---

### 4.4 Onboarding — Step 4: Why Statement

**Mode:** CLEAN DARK  
**Background:** `#0d0d0d`

**Layout:**
1. Progress dots — dots 0–2 done, dot 3 active — `marginBottom: 16`
2. StepTag — `#03 · Your why`
3. Headline — "Why does this matter to you?" — SpaceGrotesk 700, 19px, `marginBottom: 6`
4. GoalPill — parent goal, fontSize 10px — `marginBottom: 10`
5. Why text input — multiline, `backgroundColor: '#0e0e0e'`, `borderColor: '#1e1e1e'`, `borderRadius: 8`, `padding: 10`, `minHeight: 70`, IBMPlexMono 9px `#888888`. Placeholder: "Add a reflection..."
6. Character count — IBMPlexMono 7px `#2a2a2a`, right-aligned, format: `{n} / 140`
7. Example block — `backgroundColor: '#0c0c0c'`, `borderColor: '#161616'`, `borderRadius: 6`, `padding: 7 9`. Label "▶ EXAMPLE" IBMPlexMono 6px `#2a2a2a`. Example text SpaceGrotesk 10px `#3a3a3a`: *"So I have energy to show up fully — for work, for people I love."*
8. Body copy — IBMPlexMono 8px `#282828` — "This appears on your lock screen. It's the reason you open the app on hard days."
9. Primary CTA — "FINISH SETUP ▶" — goal color
10. Ghost CTA — "Skip for now"

**Interaction rules:**
- Character count updates on every keystroke
- At 140 chars: input stops accepting new characters, count turns `#444` → `#EF4444`
- Ghost CTA "Skip for now" navigates to Today without saving a why statement

---

### 4.5 Today (Home Screen)

**Mode:** CLEAN DARK  
**Background:** `#111111` (slightly lifted from base for warmth)

**Layout:**
1. Top bar — `flexDirection: 'row'`, `justifyContent: 'space-between'`, `alignItems: 'flex-start'`, `marginBottom: 18`
   - Left: Date block
     - IBMPlexMono 9px `#444` letter-spacing 0.2em: `"THURSDAY · MAR 20"`
     - SpaceGrotesk 700 18px `#e8e4dc` letter-spacing -0.03em: `"Today"`
   - Right: ScoreRing (48×48, see component 3.13)
2. SectionLabel — "Daily actions"
3. Goal groups — for each Meta Goal that has actions today:
   - Goal header row: GoalDot (6px circle) + goal name (IBMPlexMono 10px 700, goal color, letter-spacing 0.05em uppercase) — `marginBottom: 5`
   - ActionRow per action (see component 3.4)
   - `marginBottom: 12` after each group
4. TabBar at bottom (see component 3.8) — Today tab active

**Empty state:** If no goals exist, show a centered block: StepTag "▶ NO GOALS YET", then SpaceGrotesk 700 20px `#1a1a1a` text "Start by adding your first pillar.", then CTAButton "SET UP GOALS ▶" (neutral color, navigates to onboarding step 2).

**Today Score calculation:**
```
score = Math.round((completedActionsCount / totalActionsCount) * 100)
```
Ring stroke color = color of the goal with the most logged time this week.

---

### 4.6 Focus Session

**Mode:** BRUTALIST  
**Background:** `#080808`  
**Grain:** ON · **Scanlines:** ON

**Pre-session state (selection):**
- GoalPill showing selected action's parent goal — `marginBottom: 16`
- Action name — IBMPlexMono 8px `#444` letter-spacing 0.15em uppercase — `marginBottom: 28`
- Duration selector row: 4 pills + Custom — same chip style, goal color for selected
- Primary CTA — "START SESSION ▶" — goal color

**Active state layout:**
1. StepTag — `#02 · Focus session` — `marginBottom: 16`
2. Goal name — SpaceGrotesk 700 11px, goal color — `marginBottom: 2`
3. Action name — IBMPlexMono 8px `#444` uppercase letter-spacing 0.15em — `marginBottom: 28`
4. TimerRing (140×140, see component 3.14) centered — `marginBottom: 20`
   - Center text: countdown `HH:MM:SS` or `MM:SS`, SpaceGrotesk 300 32px `#e8e4dc`
   - Below center: "remaining" IBMPlexMono 7px `#333`
5. Status badge — IBMPlexMono 7px, goal color text, goal color border (0.5px), `borderRadius: 3`, `padding: 4 10` — text: "FOCUSING" — `marginBottom: 20`
6. Controls row — gap 10:
   - "END" chip — IBMPlexMono 8px `#555`, `borderColor: '#222'`
   - "PAUSE" chip — IBMPlexMono 8px, goal color text + border
7. App blocking badge (bottom, `marginTop: auto`) — IBMPlexMono 7px `#333`, `borderColor: '#1e1e1e'` — "▶ APPS BLOCKED · {N} CATEGORIES"

**Timer logic:**
- Uses `setInterval` every 1000ms while `isFocusing === true`
- `elapsed` counts up in seconds. `remaining = targetDuration - elapsed`
- On `elapsed >= targetDuration`: transition to `completed` state → navigate to Session Complete
- On pause: `isFocusing = false`, interval cleared, app block temporarily lifted
- On resume: `isFocusing = true`, interval restarted, app block re-engaged
- On end: `isFocusing = false`, `isAborted = true`, log partial time → navigate to Session Complete

**FamilyControls equivalent in Expo:**
Use `expo-focus-mode` or the `@react-native-community/blur` approach. The recommended Expo-compatible solution is `expo-notifications` + guided user flow to enable Screen Time manually on iOS, OR use `react-native-screen-time-api` (community package). The UI shows the blocking badge regardless — if the API is unavailable, show a disabled state with a tooltip explaining manual setup.

---

### 4.7 Session Complete

**Mode:** BRUTALIST  
**Background:** `#080808`  
**Grain:** ON · **Scanlines:** ON

**Layout:**
1. StepTag — `#04 · Session complete` — `marginBottom: 16`
2. Burst animation (120×120 centered) — see Motion Spec section 6.2
3. Large checkmark — SpaceGrotesk or Unicode ✓, 32px, goal color — centered inside burst
4. Headline — "Session complete." — SpaceGrotesk 700 22px `#e8e4dc`, letter-spacing -0.04em, text-align center, line-height 1.05 — `marginBottom: 4`
5. Sub-tag — IBMPlexMono 8px `#333` uppercase letter-spacing 0.15em, center — `"{GOAL NAME} · {ACTION NAME}"`
6. Data card — `backgroundColor: '#111'`, `borderWidth: 0.5`, `borderColor: '#1e1e1e'`, `borderRadius: 10`, `padding: 12 14`, `width: '100%'`
   - Row: "TIME LOGGED" label ↔ `1h 27m` in goal color
   - Divider `#1a1a1a` 0.5px
   - Row: "GOAL CREDITED" label ↔ goal name in goal color
   - Divider
   - Row: "CURRENT STREAK" label ↔ `{n} days` in `#e8e4dc`
7. Note input box — `backgroundColor: '#0e0e0e'`, `borderWidth: 0.5`, `borderColor: '#1a1a1a'`, `borderRadius: 7`, `padding: 8 10`, `width: '100%'`
   - Label: "SESSION NOTE" IBMPlexMono 7px `#2e2e2e`
   - Placeholder: "Add a reflection..." IBMPlexMono 9px italic `#2a2a2a`
   - Max 280 chars
8. CTA — `marginTop: auto` — "▶ BACK TO TODAY" — goal color

**Data card label style:** IBMPlexMono 8px `#333` uppercase letter-spacing 0.12em  
**Data card value style:** SpaceGrotesk 700 13px, goal color or `#e8e4dc`

---

### 4.8 Insights

**Mode:** CLEAN DARK  
**Background:** `#0d0d0d`

**Layout:**
1. Top bar — `marginBottom: 14`
   - Left: Title "Insights" SpaceGrotesk 700 22px `#e8e4dc` + sub "▶ WEEK OF MMM DD" IBMPlexMono 8px `#333`
   - Right: Range pills row — `WK` | `MO` | `ALL` — active pill: `borderColor: '#333'` text `#e8e4dc`; inactive: `borderColor: '#222'` text `#444`
2. Stats row — 3 StatCells (see 3.9): `Total hrs`, `Daily avg`, `Top goal` (value color = top goal's color)
3. SectionLabel — "Hours per goal"
4. Bar chart — 4 rows, one per goal:
   - Row: GoalDot (5px) + goal name (IBMPlexMono 7px `#555` 44px wide fixed) + track (flex: 1, height 6px, `#161616` bg, `borderRadius: 3`) + bar fill (goal color opacity 0.85) + value (IBMPlexMono 7px `#444` 22px wide right-aligned)
   - Bar fill width = `(goalHours / maxGoalHours) * 100%`
5. Radar chart SVG (130×115, see component 3.15) — centered
6. SectionLabel — "Streaks"
7. 2-column grid of StreakCards (see component 3.10)
8. TabBar — Insights tab active

**Time range toggle logic:**
- `WK`: sum FocusSessions where `startedAt >= startOfWeek`
- `MO`: sum FocusSessions where `startedAt >= startOfMonth`
- `ALL`: sum all FocusSessions
- Re-run all calculations when range changes. Store `selectedRange` in component state.

---

### 4.9 Goals Manager

**Mode:** CLEAN DARK  
**Background:** `#0d0d0d`

**Layout:**
1. Top bar — "Goals" title SpaceGrotesk 700 22px + "+" add button IBMPlexMono 14px `#e8e4dc` right-aligned
2. SectionLabel — "Meta goals"
3. Goal list — one card per MetaGoal:
   - `backgroundColor: '#161616'`, `borderWidth: 0.5`, `borderColor: '#1e1e1e'`, `borderRadius: 8`, `padding: 10 12`
   - Left color accent bar (2px wide, full card height, goal color)
   - Goal name SpaceGrotesk 700 14px `#e8e4dc`
   - Sub row: IBMPlexMono 7px `#333` — `"{n} actions · {weekHours}h this week"`
   - Right: chevron `>` IBMPlexMono `#333`
4. TabBar — Goals tab active

**Interactions:**
- Tap goal card → navigate to Goal Detail (v1.1, show "Coming soon" state for MVP)
- Tap "+" → navigate to Onboarding Step 2 (add new goal)
- Long press → enable drag-to-reorder (use `react-native-draggable-flatlist`)
- Swipe left → reveal "Archive" button (`backgroundColor: '#1a1a1a'`, `color: '#555'`)

---

## SECTION 5 — Color System Rules (Full Reference)

### Rule 1: Goal Color Propagates Through Context

When a screen or component is rendered *in the context of a specific goal*, all interactive and accent elements use that goal's color. The goal color is passed as a prop named `goalColor` and `goalColorBorder`.

```jsx
// Pass these two values everywhere a goal is in context
const goalColor = goal.color;  // e.g. "#8B5CF6"
const goalColorBorder = hexToRgba(goal.color, 0.28);

// Helper
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
```

### Rule 2: Never Mix Goal Colors on One Component

An ActionRow, StreakCard, or TimerRing always belongs to exactly one goal. It never uses two goal colors simultaneously.

### Rule 3: Multi-Goal Screens Use Color as Identity

Screens showing multiple goals (Today, Insights, Goals Manager) use goal colors only as identity markers — dots, accent bars, bar fills, vertex dots. The background and chrome remain neutral at all times.

### Rule 4: Opacity Levels for Dark Background

On dark backgrounds, full-opacity goal colors are too harsh for fills. Use:
- Full opacity (`1.0`): text, stroke, dot fills
- 85% opacity (`0.85`): bar chart fills
- 28% opacity (`0.28`): border colors
- 15% opacity (`0.15`): large fill areas (radar polygon fill)
- 8% opacity (`0.08`): very large fill areas (burst inner circle)

---

## SECTION 6 — Motion & Transition Spec

### 6.1 Color Swatch Selection (Onboarding Step 2)

**Trigger:** User taps a color swatch  
**Duration:** Instant — 0ms  
**What changes:** `selectedColor` state → all derived colors update in the same render cycle  
**Implementation:** No animation library needed. Pure React state update.

```jsx
const [selectedColor, setSelectedColor] = useState('#4A9EED');
// All color-dependent styles reference `selectedColor` directly
```

### 6.2 Session Complete Burst Animation

**Trigger:** Screen mounts (immediately on arrival)  
**Duration:** 600ms total  
**Easing:** `Easing.out(Easing.cubic)`  
**What animates:** 3 concentric SVG rings expand from radius 0 → final radius, staggered 80ms apart. Opacity fades from 0.6 → final opacity.

```jsx
import { Animated, Easing } from 'react-native';

const ring1 = useRef(new Animated.Value(0)).current;
const ring2 = useRef(new Animated.Value(0)).current;
const ring3 = useRef(new Animated.Value(0)).current;

useEffect(() => {
  Animated.stagger(80, [
    Animated.timing(ring1, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    Animated.timing(ring2, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    Animated.timing(ring3, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
  ]).start();
}, []);

// Ring radii: 22 → final (inner), 32 → final (mid), 44 → final (outer)
// Each ring: scale from 0.3 to 1.0, opacity from 0.6 to final opacity
```

No spring physics. No bounce. The burst is architectural, not playful.

### 6.3 Focus Screen Entry Transition

**Trigger:** User taps START on an action row (Today screen)  
**Duration:** 350ms  
**Easing:** `Easing.in(Easing.cubic)`  
**What animates:** Screen fades to black (`#080808`), grain and scanlines fade in over the last 150ms  
**Implementation:** Expo Router shared transition or a custom stack transition in React Navigation

```jsx
// In React Navigation stack config:
screenOptions: {
  transitionSpec: {
    open: { animation: 'timing', config: { duration: 350, easing: Easing.in(Easing.cubic) } },
    close: { animation: 'timing', config: { duration: 300, easing: Easing.out(Easing.cubic) } },
  },
  cardStyleInterpolator: ({ current }) => ({
    cardStyle: { opacity: current.progress },
  }),
}
```

### 6.4 Today Score Ring Fill

**Trigger:** Screen mounts / data loads  
**Duration:** 800ms  
**Easing:** `Easing.out(Easing.quad)`  
**What animates:** `strokeDashoffset` animates from `125.6` (empty) to calculated value  

```jsx
const ringAnim = useRef(new Animated.Value(0)).current;

useEffect(() => {
  Animated.timing(ringAnim, {
    toValue: score / 100,
    duration: 800,
    easing: Easing.out(Easing.quad),
    useNativeDriver: false,  // SVG props cannot use native driver
  }).start();
}, [score]);
```

### 6.5 Habit Toggle

**Trigger:** User taps a habit action row  
**Duration:** 200ms  
**What animates:** Row opacity from 1.0 → 0.45, checkmark scales from 0 → 1  
**Easing:** `Easing.out(Easing.back(1.5))` for checkmark (slight overshoot)

---

## SECTION 7 — Screen State Matrix

| Screen | Empty State | Loading | Active | Error |
|--------|------------|---------|--------|-------|
| Today | No goals → "Set up goals ▶" CTA centered | Skeleton rows (3 gray bars per group) | Full action list | Toast: "Failed to load. Pull to refresh." |
| Focus (pre) | No actions → redirect to Today | — | Duration selector + START | — |
| Focus (active) | — | — | Timer running | Timer paused, toast: "Session interrupted" |
| Session Complete | — | — | Results card | Partial data: show available fields, hide missing |
| Insights | No sessions yet → "No data yet. Complete your first session." centered | Skeleton bars + empty radar | Charts + streaks | Toast: "Could not load insights." |
| Goals Manager | No goals → "Add your first pillar ▶" CTA | Skeleton list items | Goal cards | Toast: "Could not load goals." |
| Onboarding | — | — | Step flow | Validation inline (name too long, etc.) |

**Skeleton style:** `backgroundColor: '#161616'`, `borderRadius: 4`, animated opacity pulse 1.0 → 0.4 → 1.0 over 1200ms repeating, `useNativeDriver: true`.

**Toast style:** Bottom of screen, `backgroundColor: '#161616'`, `borderWidth: 0.5`, `borderColor: '#1e1e1e'`, `borderRadius: 8`, IBMPlexMono 8px `#888`, padding `10 14`. Auto-dismiss after 3000ms. No error-red colors — neutral only (errors are not alarming in this app, just informational).

---

## SECTION 8 — Expo / React Native Implementation Notes

### 8.1 Project Setup

```bash
npx create-expo-app intentional --template blank-typescript
cd intentional
npx expo install expo-router expo-font expo-status-bar
npx expo install @expo-google-fonts/space-grotesk @expo-google-fonts/ibm-plex-mono
npx expo install react-native-svg
npx expo install expo-sqlite  # for local persistence
```

### 8.2 Font Loading

```tsx
// app/_layout.tsx
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
  SpaceGrotesk_300Light,
} from '@expo-google-fonts/space-grotesk';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from '@expo-google-fonts/ibm-plex-mono';
import { useFonts } from 'expo-font';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'SpaceGrotesk-Light': SpaceGrotesk_300Light,
    'SpaceGrotesk': SpaceGrotesk_400Regular,
    'SpaceGrotesk-Medium': SpaceGrotesk_500Medium,
    'SpaceGrotesk-Bold': SpaceGrotesk_700Bold,
    'IBMPlexMono': IBMPlexMono_400Regular,
    'IBMPlexMono-Medium': IBMPlexMono_500Medium,
  });
  if (!fontsLoaded) return null;
  return <Slot />;
}
```

### 8.3 Data Layer — expo-sqlite

Use `expo-sqlite` with a helper module. All data is local. No network calls.

```typescript
// lib/db.ts
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('intentional.db');

export function initDB() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS meta_goals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      why_statement TEXT,
      is_archived INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS daily_actions (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,  -- 'habit' | 'session'
      target_minutes INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY(goal_id) REFERENCES meta_goals(id)
    );
    CREATE TABLE IF NOT EXISTS focus_sessions (
      id TEXT PRIMARY KEY,
      action_id TEXT NOT NULL,
      goal_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_seconds INTEGER DEFAULT 0,
      note TEXT,
      was_completed INTEGER DEFAULT 0,
      FOREIGN KEY(action_id) REFERENCES daily_actions(id),
      FOREIGN KEY(goal_id) REFERENCES meta_goals(id)
    );
  `);
}
```

### 8.4 Grain Overlay (Static PNG approach)

The simplest Expo-compatible grain is a tiled semi-transparent PNG.

1. Include a 200×200 noise texture PNG at `assets/grain.png` (generate once with any noise tool)
2. Render as absolute full-screen Image with `resizeMode="repeat"`

```tsx
// components/GrainOverlay.tsx
import { Image, StyleSheet, View } from 'react-native';

export function GrainOverlay() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none" style={{ zIndex: 98, opacity: 0.04 }}>
      <Image
        source={require('../assets/grain.png')}
        style={StyleSheet.absoluteFillObject}
        resizeMode="repeat"
      />
    </View>
  );
}
```

Note: React Native's `Image` `resizeMode="repeat"` works on iOS. On Android, use `react-native-fast-image` with a tiled pattern, or use an SVG-based approach via `react-native-svg`.

### 8.5 Scanline Overlay

```tsx
// components/ScanlineOverlay.tsx
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Rect, Line } from 'react-native-svg';

export function ScanlineOverlay() {
  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 99 }]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="scanlines" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
            <Line x1="0" y1="3.5" x2="4" y2="3.5" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#scanlines)" />
      </Svg>
    </View>
  );
}
```

### 8.6 Focus Timer Implementation

```tsx
// hooks/useFocusTimer.ts
import { useState, useEffect, useRef } from 'react';

type TimerState = 'idle' | 'preparing' | 'focusing' | 'paused' | 'completed' | 'aborted';

export function useFocusTimer(targetSeconds: number) {
  const [state, setState] = useState<TimerState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const remaining = Math.max(0, targetSeconds - elapsed);

  const start = () => {
    setState('focusing');
    intervalRef.current = setInterval(() => {
      setElapsed(prev => {
        if (prev + 1 >= targetSeconds) {
          clearInterval(intervalRef.current!);
          setState('completed');
          return targetSeconds;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const pause = () => {
    clearInterval(intervalRef.current!);
    setState('paused');
  };

  const resume = () => {
    setState('focusing');
    intervalRef.current = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
  };

  const end = () => {
    clearInterval(intervalRef.current!);
    setState('aborted');
  };

  useEffect(() => () => clearInterval(intervalRef.current!), []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return { state, elapsed, remaining, start, pause, resume, end, formatTime };
}
```

### 8.7 Today Score Calculation

```typescript
// lib/score.ts
export function calculateTodayScore(actions: DailyAction[], sessions: FocusSession[], habits: HabitCompletion[]): number {
  if (actions.length === 0) return 0;
  let completed = 0;
  for (const action of actions) {
    if (action.type === 'habit') {
      const done = habits.some(h => h.actionId === action.id && isToday(h.completedAt));
      if (done) completed++;
    } else {
      const todaySessions = sessions.filter(s => s.actionId === action.id && isToday(s.startedAt));
      const totalSeconds = todaySessions.reduce((sum, s) => sum + s.durationSeconds, 0);
      if (totalSeconds >= action.targetMinutes * 60) completed++;
    }
  }
  return Math.round((completed / actions.length) * 100);
}

function isToday(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}
```

### 8.8 Expo Router File Structure

```
app/
  _layout.tsx          — Root layout, font loading, DB init
  (onboarding)/
    _layout.tsx        — Onboarding stack, no tab bar
    index.tsx          — Step 1: Welcome
    goal.tsx           — Step 2: Create goal
    action.tsx         — Step 3: Daily action
    why.tsx            — Step 4: Why statement
  (tabs)/
    _layout.tsx        — Tab bar layout
    index.tsx          — Today screen
    focus.tsx          — Focus session
    insights.tsx       — Insights dashboard
    goals.tsx          — Goals manager
  session-complete.tsx — Full screen, no tab bar

components/
  GrainOverlay.tsx
  ScanlineOverlay.tsx
  ActionRow.tsx
  GoalPill.tsx
  SectionLabel.tsx
  ScoreRing.tsx
  TimerRing.tsx
  RadarChart.tsx
  StatCell.tsx
  StreakCard.tsx
  ColorSwatch.tsx
  ChipSelector.tsx
  CTAButton.tsx
  CTAGhost.tsx
  TabBar.tsx           — Custom (replaces expo-router default)
  SkeletonRow.tsx
  Toast.tsx

hooks/
  useFocusTimer.ts
  useGoals.ts
  useInsights.ts
  useTodayActions.ts

lib/
  db.ts               — SQLite init + queries
  score.ts            — Today score calculation
  colors.ts           — hexToRgba + goal color helpers
  time.ts             — isToday, formatDuration, startOfWeek helpers

assets/
  grain.png           — 200×200 noise texture
  fonts/              — (handled by expo-google-fonts, no manual files needed)
```

### 8.9 Navigation Flow

```
App launch
  └─ Check: hasCompletedOnboarding (AsyncStorage key)
      ├─ false → (onboarding)/index (Step 1)
      │    → goal → action → why
      │    → on FINISH SETUP: set flag, navigate to (tabs)/index
      └─ true → (tabs)/index (Today)

(tabs)/index
  └─ Tap START on action row
       └─ navigate to focus.tsx with { actionId, goalId, targetMinutes }
            └─ on session end → navigate to /session-complete with { sessionId }
                 └─ tap BACK TO TODAY → navigate to (tabs)/index
```

### 8.10 AsyncStorage Keys

```typescript
const STORAGE_KEYS = {
  HAS_COMPLETED_ONBOARDING: 'intentional:onboarding:complete',
  ONBOARDING_DRAFT_GOAL:    'intentional:onboarding:draft_goal',
  ONBOARDING_DRAFT_ACTION:  'intentional:onboarding:draft_action',
  BLOCKED_APP_CATEGORIES:   'intentional:focus:blocked_categories',
};
```

---

*End of specification. Version 1.0 — MVP scope only.*