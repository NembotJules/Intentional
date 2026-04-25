# Intentional Design System - Quiet Ledger

## Status

This document is the design source of truth for the Expo / React Native app.

Ignore `Intentional_design_spec.md` for new UI work. The product source of truth is
`Intentional_product_spec.md`; this document owns visual execution.

The approved visual direction is captured in:

- `../intentional-quiet-ledger-preview.html`

## Visual References

Use these static HTML files alongside this document. `DESIGN.md` explains the
rules; the HTML files show what those rules should feel like on screen.

- Overview: `design-references/quiet-ledger/index.html`
- Today: `design-references/quiet-ledger/today.html`
- Focus: `design-references/quiet-ledger/focus.html`
- Session Complete: `design-references/quiet-ledger/session-complete.html`
- Insights: `design-references/quiet-ledger/insights.html`
- Goals: `design-references/quiet-ledger/goals.html`
- Onboarding: `design-references/quiet-ledger/onboarding.html`
- Reminders: `design-references/quiet-ledger/reminders.html`

These are reference assets, not production web screens. Implement in Expo /
React Native using the tokens and component rules below.

## Product Context

Intentional helps a user align daily effort with what matters most.

The product loop is:

1. Define 3-5 life pillars.
2. Attach daily actions to those pillars.
3. Start focus sessions and reminders from those actions.
4. Log time honestly to the action and pillar.
5. Review where hours actually went.

The design must make that loop feel calm, exact, and personal. This is not a
generic goals app. It is a private ledger for attention.

## Design Thesis

Intentional should feel like a quiet ledger for your attention.

The main app is warm, legible, and reflective. Focus mode is darker and more
ceremonial. Session completion feels like receiving a receipt for real effort,
not like winning an arcade badge.

## Emotional Rules

- **Today** should feel like a clear morning desk.
- **Focus** should feel like stepping into a quiet room.
- **Session Complete** should feel like proof.
- **Insights** should feel like honest accounting, not analytics theater.
- **Goals** should feel durable, like pillars, not tags.
- **Onboarding** should feel like a short personal commitment, not a tutorial.

## Aesthetic Direction

**Name:** Quiet Ledger

**Mood:** warm paper, ink, exact timekeeping, calm accountability.

**Decoration level:** minimal but tactile. Use ruled lines, warm surfaces, soft
paper-like contrast, and precise mono labels. Do not add decorative blobs,
gradients, confetti, or generic productivity illustrations.

**Creative risk:** the core app is mostly warm light, not dark. The dark surface is
reserved for Focus because focus is a state change. This contrast makes focus feel
intentional.

## Color System

### Core Surfaces

| Token | Hex | Use |
| --- | --- | --- |
| `canvas` | `#F7F2EA` | Main app background |
| `surface` | `#FFFCF6` | Cards, inputs, grouped content |
| `surfaceRaised` | `#F0E6D8` | Bottom nav selected state, progress tracks |
| `ink` | `#171411` | Primary text and filled buttons |
| `muted` | `#746B60` | Secondary text |
| `faint` | `#A69685` | Tertiary text, inactive metadata |
| `rule` | `#E4D8C8` | Dividers, card borders, chart grid |
| `ruleStrong` | `#CDBDA8` | Selected chips, stronger separators |

### Focus Surfaces

| Token | Hex | Use |
| --- | --- | --- |
| `focusCanvas` | `#0B0E0F` | Focus session background |
| `focusSurface` | `#121819` | Pause/end controls, dark cards |
| `focusRule` | `#253034` | Dark borders and separators |
| `focusText` | `#FFF8EE` | Focus primary text |
| `focusMuted` | `#9FA9A5` | Focus secondary text |
| `focusFaint` | `#6F7A78` | Focus metadata |

### Pillar Colors

Pillar color is the main semantic layer. Use it for dots, action accents,
selected chips, timer accent, progress bars, chart bars, and goal icons.

| Default Pillar | Token | Hex |
| --- | --- | --- |
| Body | `pillarBody` | `#D65A31` |
| Finances | `pillarMoney` | `#2F8F5B` |
| Mind | `pillarMind` | `#4C6FFF` |
| Craft / Skills | `pillarCraft` | `#A66A00` |

Additional user-created pillars should use muted, medium-saturation colors that
sit comfortably on warm paper:

- `#9A4D7A`
- `#2F7C83`
- `#7C6A2F`
- `#7D5FB2`

### Semantic Colors

Use semantic colors sparingly. Pillar colors should carry most app meaning.

| Token | Hex | Use |
| --- | --- | --- |
| `success` | `#2F8F5B` | Completed habit, successful save |
| `warning` | `#A66A00` | Reminder permission warnings |
| `danger` | `#B5442E` | Destructive action, focus end confirmation |
| `info` | `#4C6FFF` | Educational helper states |

## Typography

### Font Stack

| Role | Font | Use |
| --- | --- | --- |
| Display | `Instrument Serif` | Onboarding headlines, Today hero, Focus timer support, completion copy |
| Interface | `Source Sans 3` | Body text, lists, forms, buttons where not metadata |
| Data / Metadata | `IBM Plex Mono` | Time values, captions, section labels, chart labels, receipt rows |

Do not use Inter, Roboto, SF Pro, or system defaults as the intended design voice.
System fallback is acceptable only while fonts are loading.

### Expo Font Names

Load these through `expo-font`:

- `InstrumentSerif-Regular`
- `InstrumentSerif-Italic`
- `SourceSans3-Regular`
- `SourceSans3-Medium`
- `SourceSans3-SemiBold`
- `SourceSans3-Bold`
- `IBMPlexMono-Regular`
- `IBMPlexMono-Medium`
- `IBMPlexMono-SemiBold`

### Type Scale

| Token | Size | Line Height | Font | Use |
| --- | ---: | ---: | --- | --- |
| `display1` | 56 | 56 | Instrument Serif | Onboarding / screen hero |
| `display2` | 44 | 44 | Instrument Serif | Today, Insights, Goals titles |
| `display3` | 34 | 36 | Instrument Serif | Cards, section feature titles |
| `title` | 24 | 30 | Source Sans 3 Semibold | Card titles |
| `body` | 17 | 24 | Source Sans 3 Regular | Primary reading text |
| `bodySmall` | 15 | 21 | Source Sans 3 Regular | Secondary body |
| `label` | 12 | 16 | IBM Plex Mono Semibold | Section labels, chips |
| `caption` | 11 | 15 | IBM Plex Mono Medium | Metadata |
| `timer` | 112 | 112 | Instrument Serif | Active focus timer |
| `timeLarge` | 64 | 64 | Instrument Serif | Session receipt, day total |

Use Dynamic Type where practical. At larger accessibility sizes, keep hierarchy by
allowing cards to grow vertically rather than shrinking text.

## Spacing

Base unit: 4px.

| Token | Value |
| --- | ---: |
| `space1` | 4 |
| `space2` | 8 |
| `space3` | 12 |
| `space4` | 16 |
| `space5` | 20 |
| `space6` | 24 |
| `space8` | 32 |
| `space10` | 40 |
| `space12` | 48 |

Screen padding:

- iPhone compact width: 20px horizontal.
- Dense list screens: 18px horizontal is acceptable.
- Focus mode: 22px horizontal, with more vertical air.

Vertical rhythm:

- Section header to first item: 12-16px.
- Card internal padding: 16-20px.
- Between goal groups: 12-16px.
- Between major screen regions: 24-32px.

## Radius

Use generous radius for warm surfaces, not bubbly radius everywhere.

| Token | Value | Use |
| --- | ---: | --- |
| `radiusSm` | 12 | Small chips, compact buttons |
| `radiusMd` | 18 | Action rows, inputs |
| `radiusLg` | 24 | Cards and grouped sections |
| `radiusXl` | 32 | Large hero cards |
| `radiusFull` | 9999 | Pills, check circles |

Avoid one-radius-for-everything. Important containers should feel more spacious
than controls.

## Shadows

Use shadows only on large elevated preview-like surfaces or modal sheets.
Most in-app cards should rely on surface contrast and borders.

Default card:

- background `surface`
- border `rule`
- no shadow

Modal / sheet:

- shadow color `rgba(54, 38, 20, 0.16)`
- radius `radiusXl`
- warm surface

## NativeWind Token Mapping

The Engineer should update `intentional-expo/tailwind.config.js` to expose these
semantic names:

```js
colors: {
  canvas: '#F7F2EA',
  surface: '#FFFCF6',
  'surface-raised': '#F0E6D8',
  ink: '#171411',
  muted: '#746B60',
  faint: '#A69685',
  rule: '#E4D8C8',
  'rule-strong': '#CDBDA8',
  'focus-canvas': '#0B0E0F',
  'focus-surface': '#121819',
  'focus-rule': '#253034',
  'focus-text': '#FFF8EE',
  'focus-muted': '#9FA9A5',
  'pillar-body': '#D65A31',
  'pillar-money': '#2F8F5B',
  'pillar-mind': '#4C6FFF',
  'pillar-craft': '#A66A00',
}
```

Keep semantic token names. Do not encode old mode names like `brutalist` or
`cleanDark` into the new system.

## Component Rules

### App Shell

The main tabs are:

- Today
- Focus
- Insights
- Goals

Use warm light shell for Today, Insights, Goals, and Onboarding.

Focus uses the dark shell.

The tab bar should feel like a warm floating pill:

- background `surface` at 84-92% opacity if blur is available
- border `rule`
- selected item background `surfaceRaised`
- selected label `ink`
- inactive label `muted`
- labels in IBM Plex Mono, all caps, 10-11px

### Screen Header

Every main screen starts with:

1. Mono eyebrow: date, range, or step.
2. Large serif headline.
3. Optional compact control on the right.

Examples:

- Today: "Today serves what?"
- Focus: "Ship client proposal" with current pillar above it.
- Insights: "Where time went."
- Goals: "What days answer to."
- Onboarding: "What should your days serve?"

### Cards

Cards are warm surfaces with thin ruled borders.

- background `surface`
- border `rule`
- radius `radiusLg`
- padding 16-20
- no default shadow

Do not over-card the screen. Group related things. Remove containers when spacing
and typography already create enough structure.

### Goal Group

Used on Today.

Structure:

- group container with `surface` or translucent `surface`
- top row: pillar dot + name, then logged / target time
- action rows divided by `rule`
- no heavy card shadows

Pillar color appears as:

- 9px dot next to goal name
- start button or progress accent
- progress fill

### Action Row

Action rows must answer in one scan:

1. What action?
2. Which kind: habit or session?
3. What is today’s state?
4. What is the obvious next tap?

Session row:

- action name, Source Sans 3 semibold 16-17
- mono metadata: `SESSION - 90M TARGET`
- logged line: `20m / 90m today`
- primary action: `Start`
- progress track if partially logged

Habit row:

- action name
- mono metadata: `HABIT`
- state: `Done today` or `Not done`
- large enough circular check target, minimum 44px touch area

### Primary Button

Filled primary:

- background `ink`
- text `surface`
- radius full for main actions
- mono label, uppercase, 11px, semibold
- min height 50

Secondary / outline:

- transparent
- border `ruleStrong` or pillar color at 35% opacity
- text `ink` or pillar color

Avoid tiny rectangular CTAs. The approved direction uses pill-like commitment
buttons, not harsh terminal buttons.

### Chips

Used for duration presets, ranges, categories, and selected reminders.

- unselected: `surface`, border `rule`, text `muted`
- selected: tint of selected pillar or `surfaceRaised`, border pillar at 35%, text `ink`
- height 36-42
- radius full

### Inputs

Inputs should feel like writing on paper, not filling a SaaS form.

- background `surface`
- border `rule`
- focus border `ruleStrong` or pillar color
- placeholder `faint`
- label in IBM Plex Mono
- field text Source Sans 3

For "why" statements, use a larger multiline field with a serif prompt nearby.

### Charts

Charts are accounting tools.

Bars are preferred for MVP Insights because they are legible and direct.

Rules:

- Each pillar uses its pillar color.
- Grid and axes use `rule`.
- Labels use IBM Plex Mono.
- Chart cards must include a plain-language sentence beneath the visual.

Example insight copy:

- "Finances carried the week. Craft is underfed, but not invisible anymore."
- "Body is consistent. Mind is only happening on weekends."
- "Your logged time is balanced, but reminders are doing most of the work."

Do not ship decorative radar charts unless the data is genuinely easier to read
that way.

### Session Receipt

Session completion should be a receipt of effort.

Required content:

- time logged
- pillar credited
- action credited
- completed vs ended early
- optional note
- streak if applicable
- primary action back to Today

Visual:

- large serif time
- receipt rows with mono labels
- pillar color used for credited goal
- no confetti, emoji, or generic celebration art

## Screen Specifications

### Onboarding

Goal: get the user to a usable Today screen fast.

Steps:

1. Pick or create 3-5 pillars.
2. Add one action to one pillar.
3. Optional why statement.
4. Optional reminder prompt if action needs time.

Design:

- warm light shell
- large serif questions
- one decision per screen
- progress in mono, e.g. `STEP 1 OF 3`
- suggested pillars as large selectable rows
- selected state uses pillar dot and warm border

Copy should be philosophy through action. No long tutorial.

### Today

Goal: daily command center.

Required hierarchy:

1. Date eyebrow.
2. Headline: "Today serves what?"
3. Day total / alignment readout.
4. Goal groups with actions.
5. Bottom tabs.

Design:

- warm light shell
- day score as a quiet readout, not a moral grade
- group actions by pillar
- make Start Focus one obvious tap
- completed habits should dim but remain readable

### Focus

Goal: make a commitment feel active.

Required hierarchy:

1. Pillar label.
2. Action name.
3. Shield state if enabled.
4. Large timer.
5. Pause and End controls.

Design:

- dark shell
- no bottom nav while active
- one pillar accent
- large timer in Instrument Serif
- copy states category-level shielding honestly

Example shield copy:

- `CATEGORY SHIELD ACTIVE`
- `SOCIAL + GAMES REDUCED`
- `SHIELD OFF - TIMER ONLY`

### Session Complete

Goal: close the loop and make time attribution feel real.

Required hierarchy:

1. Completion headline.
2. Large logged time.
3. Credited pillar and action.
4. Receipt details.
5. Note field.
6. Back to Today.

Design:

- warm light shell
- receipt-like card
- no dismissible-sheet feel
- meaningful but restrained celebration

### Insights

Goal: show where hours went across pillars.

Required hierarchy:

1. Range selector.
2. Total attributed time.
3. Bar chart by pillar.
4. Plain-language observation.
5. Streaks / completion stats.

Design:

- warm light shell
- bar chart first for MVP
- concise interpretation after chart
- avoid dense dashboards

### Goals

Goal: manage durable life pillars.

Required hierarchy:

1. Headline: "What days answer to."
2. Goal cards ordered by sort order.
3. Each goal: icon/color, name, why, action count, weekly hours.
4. Add / reorder / archive affordances.

Design:

- goals are not tags
- each card should feel like a stable pillar
- "why" line visible where possible
- archive copy must say history is kept

### Reminders

Goal: pull the user back into the loop.

Design:

- reminder controls live inside action edit/create
- one reminder time for MVP
- permission prompt happens only when the user turns reminders on
- notification copy deep-links to Today or preselected Focus

Copy examples:

- "Time to serve Mind: 30 minutes of reading."
- "Finances is waiting. Start your proposal session?"

## Motion and Haptics

Motion should support state change, not decorate.

Use:

- subtle press scale: 0.98
- card entry fade + 8px rise on screen load
- focus start transition: warm shell fades to dark shell over 260ms
- timer tick is visual only; do not animate every second aggressively
- completion receipt enters with a soft rise and one haptic success

Haptics:

- habit completion: light impact
- focus start: medium impact
- natural session complete: success notification
- early end: warning or light impact, not punitive

Respect reduced motion. Disable decorative transitions when reduced motion is on.

## Accessibility

Minimum standards:

- Touch targets at least 44x44.
- Body text contrast must be readable on warm surfaces.
- Pillar color is never the only indicator. Pair with text, icon, or position.
- Charts need text summaries.
- Dynamic Type must not clip key content.
- Focus controls must be reachable and labeled.
- Reminders and shields must use honest copy.

Colorblind support:

- goal cards include icon or short label, not color alone
- charts include labels and values
- selected chips include border + text change

## Empty, Error, and Edge States

Empty states are part of the product.

### No Goals Yet

Headline: "Name what your days should serve."

Body: "Start with one pillar. You can add the rest later."

CTA: "Create first pillar"

### No Actions Today

Headline: "Nothing is assigned to today."

Body: "Add one action to a pillar, or start a manual focus session."

CTAs: "Add action", "Start manual focus"

### No Focus Sessions Yet

Headline: "No time credited yet."

Body: "Start one session and Intentional will show where the day went."

CTA: "Start focus"

### No Insights Yet

Headline: "Your ledger is empty."

Body: "Insights appear after you log focus time to a pillar."

CTA: "Start first session"

### Shield Permission Denied

Headline: "Timer still works."

Body: "iOS permission is needed for category shields. You can still log focus time honestly."

CTAs: "Open Settings", "Continue without shield"

## Copy Rules

Voice:

- clear
- private
- reflective
- never preachy

Do:

- "credited to Finances"
- "where time went"
- "today serves"
- "category shield"
- "timer only"

Do not:

- "crush your goals"
- "level up"
- "unlock your potential"
- "become unstoppable"
- "block Instagram" unless the platform actually supports that exact promise

## Anti-Drift Guardrails

Do not reintroduce these patterns:

- dark mode across the whole app by default
- brutalist scanlines, grain, terminal UI, or harsh monochrome surfaces
- purple gradients
- confetti or emoji celebration
- generic productivity illustrations
- over-carded dashboards
- tiny square CTA buttons
- pillar colors on neutral navigation chrome
- charts without plain-language interpretation
- focus screens with bottom nav visible during active sessions

## Implementation Notes for Engineer

Recommended first implementation pass:

1. Replace `constants/design.ts` tokens with Quiet Ledger tokens.
2. Update `tailwind.config.js` semantic colors and radius values.
3. Load `Instrument Serif`, `Source Sans 3`, and `IBM Plex Mono` via `expo-font`.
4. Rework `PrimaryButton` to use warm filled/outline pill variants.
5. Rework `ActionRow` and Today goal groups against the new warm ledger pattern.
6. Convert Focus to the dark focus shell.
7. Convert Insights to bar-chart-first with plain-language summaries.
8. Remove old brutalist overlay usage from new screens.

Do this in layers. Tokens first, shared components second, screens third.

## Design QA Checklist

Before shipping a screen:

- Does the first 3-second scan tell the user what to do?
- Is the pillar/action/time relationship visible?
- Is the next action obvious without reading instructions?
- Does any text feel generic or motivational-poster-ish?
- Is color paired with text or shape?
- Does Dynamic Type still work?
- Does Focus feel meaningfully different from planning/review?
- Does Session Complete prove what happened?
- Is there any old dark/brutalist styling left by accident?

If the answer to the last question is yes, fix it.
