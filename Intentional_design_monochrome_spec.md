**INTENTIONAL**

Figma & UI Design Specification

*A complete visual blueprint for Figma generation via Gemini*

**\"Align your daily effort with what matters most.\"**

---

## Design Philosophy

Intentional uses an **Editorial Minimalism** aesthetic — also referred to as Swiss/International Typographic Style with a modern twist. This is not a decorative style. It is a philosophy: every visual decision must earn its place.

### Core Principles

**Monochromatic palette** — The entire UI operates in a warm monochrome scale: near-black (`#111111`) through warm off-white (`#EDEBE6`). No accent colors, no goal-color chrome. Color is not used to communicate — hierarchy, weight, and spacing do that work instead.

**Brutalist typography** — Headlines are heavy, oversized, and unapologetic. The type *is* the layout. SF Pro Display at large weights carries the visual identity of each screen. Where other apps use color to signal importance, Intentional uses scale and weight.

**Type hierarchy as layout** — There are no decorative elements. No illustrations, no gradients, no shadows used for aesthetics. The visual structure of every screen is built entirely from typographic hierarchy: large titles anchor the eye, monospaced captions provide metadata, thin timer numerals create drama on the Focus screen.

**Generous whitespace** — Breathing room is a design element, not wasted space. Margins are wide. Sections are separated by space before they are separated by lines. The grid is strict, invisible, and load-bearing.

**Clean grid structure** — Every element aligns to an 8pt base grid with 16pt screen margins. Section breaks use single 1px lines, not colored bars or decorative dividers. The structure should feel like a well-typeset editorial document, not a consumer app.

### The Emotional Register

The app should feel like a premium notebook — considered, quiet, confident. Not cold. The warm off-white background (`#EDEBE6`) and the DM Serif italic moments give it humanity. The Focus screen inverts to full black (`#0F0F14`) — a genuine change of mental space, not just a dark mode toggle.

> "The design should make you feel like the kind of person who finishes what they start."

---

  ----------------------------------- -----------------------------------
  Platform                            iOS 17+ (iPhone)

  Frame Size                          390 x 844 pt (iPhone 14 base)

  Scale                               \@3x for all assets

  Color Mode                          Light Mode primary / Dark Mode for
                                      Focus screen

  Design Language                     Apple Human Interface Guidelines +
                                      custom

  Corner Radius System                8 / 12 / 16 / 24 pt

  Grid                                16pt margins, 8pt base unit, 8pt
                                      column gutter
  ----------------------------------- -----------------------------------

**1. Design Tokens**

These tokens are the single source of truth for every color, type style,
radius and shadow in Intentional. Every screen and component is built
exclusively from these values.

**1.1 Color System**

**Goal Colors (Primary Palette)**

Each Meta Goal has a fixed color identity. This color is used for: card
backgrounds, icon tints, progress rings, chart bars, and focus screen
accents.

  --------------- ---------------- ---------------- ----------------------
  **Goal**        **Light Mode     **Dark Mode      **Usage**
                  Hex**            Hex**            

  Physique        #4A9EED          #60AEFF          Blue --- calm,
                                                    physical strength

  Finances        #22C55E          #34D366          Green --- growth,
                                                    wealth

  Skills          #8B5CF6          #A78BFA          Purple --- knowledge,
                                                    mastery

  Mind            #F59E0B          #FBBF24          Amber --- wisdom,
                                                    reflection
  --------------- ---------------- ---------------- ----------------------

**Neutral & Semantic Colors**

  ---------------------------- ---------------- ---------------------------------
  **Token Name**               **Hex Value**    **Usage**

  color.background.primary     #FFFFFF          Main screen backgrounds

  color.background.secondary   #F9FAFB          Card surfaces, input fields

  color.background.tertiary    #F3F4F6          Subtle separators, rows

  color.background.focus       #0F0F14          Focus screen ONLY --- near-black

  color.text.primary           #111827          Headlines, primary labels

  color.text.secondary         #6B7280          Supporting text, captions

  color.text.tertiary          #9CA3AF          Placeholder text, disabled

  color.text.inverse           #FFFFFF          Text on dark/colored backgrounds

  color.accent.blue            #1E3A8A          Primary CTA buttons, links

  color.accent.success         #16A34A          Completion states, streaks

  color.accent.warning         #D97706          Reminders, caution states

  color.accent.danger          #DC2626          Abort session, destructive
                                                actions

  color.separator              #E5E7EB          List dividers, card borders

  color.shadow                 #00000014        Elevation shadows (8% opacity)
  ---------------------------- ---------------- ---------------------------------

**Goal Tint Colors (Background fills for cards)**

These are 10% opacity versions of each goal color, used as card/row
background fills.

  -------------------------- ------------------ ----------------------------------
  **Token**                  **Hex**            **Goal**

  color.goal.physique.tint   #EFF6FF            Physique --- light blue wash

  color.goal.finances.tint   #F0FDF4            Finances --- light green wash

  color.goal.skills.tint     #FAF5FF            Skills --- light purple wash

  color.goal.mind.tint       #FFFBEB            Mind --- light amber wash
  -------------------------- ------------------ ----------------------------------

**1.2 Typography**

All text uses SF Pro --- the native iOS system font. Use SF Pro Display
for sizes 20pt+ and SF Pro Text for sizes below 20pt. Do NOT use custom
fonts.

  ------------------ ------------ ------------ ----------------------------
  **Token Name**     **Font /     **Size /     **Usage**
                     Weight**     Leading**    

  type.largeTitle    SF Pro       34pt / 41pt  Screen titles on hero
                     Display /                 screens
                     Bold                      

  type.title1        SF Pro       28pt / 34pt  Section headers
                     Display /                 
                     Bold                      

  type.title2        SF Pro       22pt / 28pt  Card titles, goal names
                     Display /                 
                     Semibold                  

  type.title3        SF Pro       20pt / 25pt  Action names, sub-headers
                     Display /                 
                     Semibold                  

  type.headline      SF Pro Text  17pt / 22pt  List item labels, tab labels
                     / Semibold                

  type.body          SF Pro Text  17pt / 22pt  Body copy, descriptions
                     / Regular                 

  type.callout       SF Pro Text  16pt / 21pt  Supporting descriptions
                     / Regular                 

  type.subheadline   SF Pro Text  15pt / 20pt  Secondary info
                     / Regular                 

  type.footnote      SF Pro Text  13pt / 18pt  Captions, metadata
                     / Regular                 

  type.caption       SF Pro Text  12pt / 16pt  Timestamps, tiny labels
                     / Regular                 

  type.timer         SF Pro       72pt / 72pt  Focus screen timer ONLY
                     Display /                 
                     Thin                      

  type.score         SF Pro       48pt / 48pt  Today score ring number
                     Display /                 
                     Black                     
  ------------------ ------------ ------------ ----------------------------

**1.3 Spacing & Layout**

All spacing is based on an 8pt grid. Use only multiples of 4pt for
micro-spacing (padding inside elements) and multiples of 8pt for layout
spacing.

  -------------------- ------------- ---------------------------------------
  **Token**            **Value**     **Usage**

  spacing.xs           4pt           Icon-to-label gap, inner chip padding

  spacing.sm           8pt           Between related elements

  spacing.md           12pt          Card internal vertical padding

  spacing.lg           16pt          Screen horizontal margin, section gap

  spacing.xl           24pt          Between major sections

  spacing.xxl          32pt          Above/below screen titles

  spacing.screen.h     16pt          Horizontal screen edge inset

  spacing.screen.v     20pt          Vertical screen top/bottom inset

  spacing.tab.height   83pt          Tab bar height (including home
                                     indicator)
  -------------------- ------------- ---------------------------------------

**1.4 Corner Radii**

  ------------------ ------------- ---------------------------------------
  **Token**          **Value**     **Usage**

  radius.sm          8pt           Tags, chips, small badges

  radius.md          12pt          Action rows, input fields

  radius.lg          16pt          Cards, modals, session cards

  radius.xl          24pt          Large cards, goal overview cards

  radius.full        9999pt        Pills, toggle buttons, progress rings
  ------------------ ------------- ---------------------------------------

**1.5 Elevation & Shadows**

  ------------------ ----------------------------------------------------
  **Level**          **CSS-equivalent Shadow**

  elevation.0 ---    none (use border instead: 1pt #E5E7EB)
  Flat               

  elevation.1 ---    0pt 1pt 3pt rgba(0,0,0,0.08), 0pt 1pt 2pt
  Card               rgba(0,0,0,0.04)

  elevation.2 ---    0pt 4pt 12pt rgba(0,0,0,0.10), 0pt 2pt 4pt
  Float              rgba(0,0,0,0.06)

  elevation.3 ---    0pt 20pt 60pt rgba(0,0,0,0.18), 0pt 8pt 16pt
  Modal              rgba(0,0,0,0.10)
  ------------------ ----------------------------------------------------

**2. Component Library**

Every UI element in Intentional is built from these base components.
Gemini / Figma should create each as a named, reusable Auto Layout
component with defined variants.

**2.1 GoalChip**

A pill-shaped label used inline to identify which goal an action or
session belongs to.

  ------------------ ------------------ ---------------------------------
  **Component**      **Property**       **Value**

  GoalChip           Size               Height: 24pt, horizontal padding:
                                        10pt, corner radius: full

  GoalChip           Background         Goal tint color (10% opacity
                                        fill)

  GoalChip           Border             1pt stroke in goal primary color

  GoalChip           Icon               8pt SF Symbol or emoji, goal
                                        color tint, left of label

  GoalChip           Label              type.footnote, goal primary
                                        color, semibold

  GoalChip           Variants           Physique / Finances / Skills /
                                        Mind --- one per goal
  ------------------ ------------------ ---------------------------------

**2.2 ActionRow**

The primary list item in the Today screen. Represents a single Daily
Action with its goal color, name, progress, and start button.

  ------------------ ------------------ ---------------------------------
  **Component**      **Property**       **Value**

  ActionRow          Height             72pt minimum, expands for long
                                        names

  ActionRow          Corner radius      radius.lg (16pt)

  ActionRow          Background         color.background.secondary --- no
                                        goal tint here

  ActionRow          Left accent        4pt vertical bar in goal primary
                                        color, full height, radius.full

  ActionRow          Icon area          40pt circle, goal tint fill, goal
                                        color SF Symbol at 20pt

  ActionRow          Title              type.headline, color.text.primary

  ActionRow          Subtitle           type.footnote,
                                        color.text.secondary --- e.g.
                                        \'4hr target\'

  ActionRow          Progress bar       Full-width, 4pt height, goal tint
                                        bg, goal color fill, radius.full

  ActionRow          Start button       See PrimaryButton spec --- goal
                                        color background, \'Start\' label

  ActionRow          Completed state    Left accent becomes green,
                                        checkmark icon, progress bar at
                                        100%

  ActionRow          Shadow             elevation.1
  ------------------ ------------------ ---------------------------------

**2.3 PrimaryButton**

  ------------------ ------------------ ---------------------------------
  **Component**      **Property**       **Value**

  PrimaryButton      Height             50pt, corner radius: radius.full

  PrimaryButton      Padding            Horizontal: 24pt

  PrimaryButton      Background         Context-dependent: goal color OR
                                        color.accent.blue

  PrimaryButton      Label              type.headline, semibold,
                                        color.text.inverse (white)

  PrimaryButton      State: Pressed     90% scale transform, 80% opacity

  PrimaryButton      State: Disabled    color.background.tertiary fill,
                                        color.text.tertiary label

  PrimaryButton      Variant: Small     Height: 36pt, horizontal padding:
                                        16pt, type.subheadline

  PrimaryButton      Variant: Ghost     Transparent bg, goal color border
                                        1.5pt, goal color label
  ------------------ ------------------ ---------------------------------

**2.4 TodayScoreRing**

A circular progress ring displayed at the top of the Today screen
showing daily completion percentage.

  ------------------ ------------------ ---------------------------------
  **Component**      **Property**       **Value**

  TodayScoreRing     Outer size         80pt x 80pt

  TodayScoreRing     Ring track         8pt stroke width,
                                        color.background.tertiary

  TodayScoreRing     Ring fill          8pt stroke, gradient: 0% = amber,
                                        50% = blue, 100% = green

  TodayScoreRing     Center number      type.score, color.text.primary

  TodayScoreRing     Center label       type.caption, \'TODAY\',
                                        color.text.secondary, below
                                        number

  TodayScoreRing     Animation          Stroke dash offset animated on
                                        load --- 0.8s ease-out
  ------------------ ------------------ ---------------------------------

**2.5 FocusTimerRing**

The large central timer display on the Focus screen. Dark background
exclusive component.

  ------------------ ------------------ ---------------------------------
  **Component**      **Property**       **Value**

  FocusTimerRing     Outer size         260pt x 260pt

  FocusTimerRing     Ring track         6pt stroke,
                                        rgba(255,255,255,0.08) --- barely
                                        visible

  FocusTimerRing     Ring fill          6pt stroke, goal primary color,
                                        animates as time elapses

  FocusTimerRing     Glow effect        Outer shadow: 0pt 0pt 24pt \<goal
                                        color\> at 40% opacity

  FocusTimerRing     Time display       type.timer (72pt thin),
                                        color.text.inverse, center

  FocusTimerRing     Label              type.footnote,
                                        rgba(255,255,255,0.5), below time
                                        --- \'remaining\'

  FocusTimerRing     Background         color.background.focus (#0F0F14)
                                        --- full screen
  ------------------ ------------------ ---------------------------------

**2.6 InsightBarChart**

  ------------------ ------------------ ---------------------------------
  **Component**      **Property**       **Value**

  InsightBarChart    Bar width          48pt, corner radius: radius.sm on
                                        top corners only

  InsightBarChart    Bar spacing        24pt gap between bars

  InsightBarChart    Bar fill           Goal primary color, 100% opacity

  InsightBarChart    Bar background     Goal tint color at 40% --- shows
                                        empty state

  InsightBarChart    Height scale       Max bar = 160pt height, others
                                        scale proportionally

  InsightBarChart    Label below        type.caption, goal name
                                        abbreviated, color.text.secondary

  InsightBarChart    Value above        type.footnote, semibold, goal
                                        color, hours count

  InsightBarChart    Animation          Bars grow from 0 height on appear
                                        --- 0.6s staggered ease-out
  ------------------ ------------------ ---------------------------------

**2.7 RadarChart (Goal Balance)**

  ------------------ ------------------ ---------------------------------
  **Component**      **Property**       **Value**

  RadarChart         Canvas             240pt x 240pt centered

  RadarChart         Axes               One per goal, equal angles,
                                        extends to 120pt radius

  RadarChart         Grid rings         3 concentric rings at 40/80/120pt
                                        radius, color.separator

  RadarChart         Data polygon       Filled polygon connecting data
                                        points on each axis

  RadarChart         Fill color         color.accent.blue at 15% opacity

  RadarChart         Stroke             color.accent.blue, 2pt, solid

  RadarChart         Axis labels        type.caption, goal emoji + name,
                                        positioned at axis end

  RadarChart         Data points        6pt circle, white fill, goal
                                        color stroke 2pt, at each axis
                                        intersection
  ------------------ ------------------ ---------------------------------

**2.8 StreakBadge**

  ------------------ ------------------ ---------------------------------
  **Component**      **Property**       **Value**

  StreakBadge        Size               Full width card, 64pt height

  StreakBadge        Background         color.background.secondary,
                                        elevation.1

  StreakBadge        Left icon          Flame SF Symbol at 24pt,
                                        color.accent.warning

  StreakBadge        Count              type.title2, color.text.primary
                                        --- the number

  StreakBadge        Label              type.subheadline,
                                        color.text.secondary --- \'day
                                        streak\'

  StreakBadge        Right              Best streak in type.footnote,
                                        color.text.tertiary
  ------------------ ------------------ ---------------------------------

**2.9 AppBlockBadge**

Shown at the bottom of the Focus screen to confirm app blocking is
active.

  ------------------ ------------------ ---------------------------------
  **Component**      **Property**       **Value**

  AppBlockBadge      Size               Pill: auto-width, 28pt height,
                                        horizontal padding 12pt

  AppBlockBadge      Background         rgba(255,255,255,0.08) ---
                                        frosted glass on dark bg

  AppBlockBadge      Border             1pt rgba(255,255,255,0.15)

  AppBlockBadge      Icon               lock.fill SF Symbol, 12pt,
                                        rgba(255,255,255,0.6)

  AppBlockBadge      Label              type.caption, \'Apps Blocked\',
                                        rgba(255,255,255,0.6)
  ------------------ ------------------ ---------------------------------

**3. Screen-by-Screen Specifications**

Each screen is described with exact frame dimensions, layout zones,
component references, and content hierarchy. All screens use the 390 x
844pt iPhone 14 base frame at \@3x.

**Screen 1 --- Onboarding (4-step flow)**

**Step 1: Welcome**

  ---------------- ------------------------------------------------------
  **Property**     **Value**

  Frame            390 x 844pt, background: color.background.primary

  Zone 1           Top 40% --- large centered wordmark \'intentional\' in
                   type.largeTitle, color.accent.blue, lowercase,
                   letterSpacing: -1pt

  Zone 2           Below wordmark --- tagline: \'Build your life
                   intentionally.\' type.title3, color.text.secondary,
                   centered, max-width 280pt

  Zone 3           Bottom 30% --- PrimaryButton full-width, label
                   \'Begin\', color.accent.blue background

  Background       Subtle radial gradient: white center fading to #F0F4FF
                   at edges

  Animation        Wordmark fades in from y+20pt, tagline follows 200ms
                   later, button appears last
  ---------------- ------------------------------------------------------

**Step 2: Create Your Meta Goals**

  ---------------- ------------------------------------------------------
  **Property**     **Value**

  Frame            390 x 844pt, background: color.background.primary

  Progress         Top: 4 dot indicators, current dot =
                   color.accent.blue, others = color.separator

  Instruction      type.title2 \'Your life pillars\' + type.body subtitle
                   below, left-aligned, 16pt margin

  Goal rows        4 x ActionRow-style input rows, each with: color
                   swatch circle (32pt), text input for name, emoji
                   picker button

  Preset chips     Below each empty field: suggestion chips \'Physique\',
                   \'Finances\', \'Skills\', \'Mind\' --- tap to fill

  Add more         Ghost button \'+ Add another goal\' below the 4 rows,
                   max 6 goals total

  CTA              PrimaryButton \'Continue\' fixed to bottom, disabled
                   until at least 1 goal named
  ---------------- ------------------------------------------------------

**Step 3: Add Your First Action**

  ---------------- ------------------------------------------------------
  **Property**     **Value**

  Frame            390 x 844pt

  Context          GoalChip at top showing the first goal created

  Instruction      type.title2 \'What will you do daily?\' centered

  Input            Single large text input, placeholder \'e.g. Gym
                   session, Learn ML, Read books\', radius.lg, 56pt
                   height

  Type toggle      Segmented control: \'Habit\' (done / not done) vs
                   \'Session\' (time-based). 2-segment, full-width

  Duration         Shown only when Session selected: horizontal scroll of
                   time chips: 30m / 1h / 2h / 3h / 4h / Custom

  CTA              PrimaryButton \'Continue\' in goal primary color
  ---------------- ------------------------------------------------------

**Step 4: Your Why**

  ---------------- ------------------------------------------------------
  **Property**     **Value**

  Frame            390 x 844pt

  Instruction      type.title2 \'Why does this matter?\' --- centered,
                   top third of screen

  Subtitle         type.body \'Write one sentence. You\'ll see it on your
                   lock screen.\' --- color.text.secondary

  Input            Multiline text area, 120pt height, radius.lg,
                   placeholder \'Becoming the best version of
                   myself\...\'

  Char count       type.caption, right-aligned below input, \'0 / 140\'
                   format

  Skip             Ghost text button \'Skip for now\' above CTA

  CTA              PrimaryButton \'Start Intentional\' ---
                   color.accent.blue
  ---------------- ------------------------------------------------------

**Screen 2 --- Today (Home)**

  ---------------- ------------------------------------------------------
  **Property**     **Value**

  Frame            390 x 844pt, background: color.background.primary

  Nav bar          Height 44pt. Left: greeting \'Good morning,\' +
                   user\'s name in type.headline. Right: TodayScoreRing
                   (80pt)

  Date strip       Below nav: type.footnote date \'Tuesday, March 11\',
                   color.text.secondary

  Goal filter      Horizontal scroll row of GoalChips below date ---
                   \'All\' chip + one per goal. Tap to filter action list

  Section header   type.subheadline \'TODAY\'S ACTIONS\',
                   color.text.tertiary, uppercase, letterSpacing: 1pt

  Action list      Vertically stacked ActionRows with 8pt gap, 16pt
                   horizontal margin. Grouped by goal color.

  Empty state      If all done: large checkmark animation + \'You crushed
                   today.\' in type.title2

  Bottom tab bar   83pt tall. 4 tabs: Today (house.fill) / Focus (timer)
                   / Insights (chart.bar.fill) / Goals (list.bullet).
                   Active tab uses color.accent.blue, inactive uses
                   color.text.tertiary
  ---------------- ------------------------------------------------------

  -----------------------------------------------------------------------
  *Design note for Gemini: The Today screen should feel like a morning
  dashboard --- clean, motivating, never overwhelming. The score ring in
  the top right is the hero element. Goal color bars on ActionRows make
  scanning effortless.*

  -----------------------------------------------------------------------

**Screen 3 --- Focus Session**

**Pre-session sheet (modal bottom sheet)**

  ---------------- ------------------------------------------------------
  **Property**     **Value**

  Frame            390pt wide, 520pt tall, radius.xl top corners,
                   elevation.3

  Drag handle      36pt x 4pt pill, color.separator, centered at top, 8pt
                   from edge

  Goal chip        GoalChip for selected goal --- centered below handle

  Action name      type.title2, color.text.primary, centered

  Duration grid    2x3 grid of duration chips: 25m / 45m / 60m / 90m /
                   120m / Custom. Selected = goal color fill + white
                   label. Unselected = color.background.tertiary +
                   color.text.primary

  Start button     PrimaryButton full-width \'Start Focus\' in goal
                   primary color, 50pt height

  Cancel           Ghost text button \'Cancel\' below main CTA
  ---------------- ------------------------------------------------------

**Active Focus Screen**

  ---------------- ------------------------------------------------------
  **Property**     **Value**

  Frame            390 x 844pt, background: color.background.focus
                   (#0F0F14) --- full bleed dark

  Status bar       Light content --- white time, white icons

  Goal label       Top center: GoalChip variant on dark bg (lighter
                   version), 56pt from top

  Action label     type.subheadline, rgba(255,255,255,0.6), below goal
                   chip, 8pt gap

  Timer ring       FocusTimerRing centered --- 260pt x 260pt, vertically
                   centered on screen

  Controls         Below timer ring, 40pt gap: two buttons side by side
                   with 16pt gap

  Pause button     PrimaryButton Ghost variant: \'Pause\' label, goal
                   color border, 152pt wide

  End button       PrimaryButton Ghost variant: \'End\' label,
                   color.accent.danger border, 152pt wide

  App lock badge   AppBlockBadge pinned 24pt above tab bar area, centered

  Ambient          Screen stays on during session
                   (UIApplication.shared.isIdleTimerDisabled = true)
  ---------------- ------------------------------------------------------

  -----------------------------------------------------------------------
  *Design note for Gemini: The Focus screen is the emotional core of the
  app. It should feel like entering a different mental space --- dark,
  minimal, almost meditative. The only light is the timer ring glowing in
  the goal color. Nothing else competes for attention.*

  -----------------------------------------------------------------------

**Screen 4 --- Session Complete**

  ---------------- ------------------------------------------------------
  **Property**     **Value**

  Frame            390 x 844pt, background: color.background.primary

  Hero animation   Full-width confetti burst in goal colors (1.2s), fades
                   out. Behind completion card.

  Completion card  360pt wide, radius.xl, elevation.2, white bg, centered
                   vertically

  Check icon       64pt circle, goal tint fill, checkmark.circle.fill SF
                   Symbol 40pt in goal color --- top of card

  Headline         type.title1 \'Session Complete\' --- goal color text,
                   centered

  Time logged      type.largeTitle bold, color.text.primary --- e.g. \'2h
                   03m\' --- large and proud

  Goal credit      GoalChip centered below time, shows which goal
                   received the credit

  Streak badge     StreakBadge full-width inside card, 16pt horizontal
                   padding

  Note field       Multiline input: \'Add a session note\...
                   (optional)\', 80pt height, radius.lg,
                   color.background.secondary border, type.body

  CTA              PrimaryButton \'Back to Today\' --- color.accent.blue,
                   fixed to bottom of card
  ---------------- ------------------------------------------------------

**Screen 5 --- Insights Dashboard**

  ---------------- ------------------------------------------------------
  **Property**     **Value**

  Frame            390 x 844pt, scrollable, background:
                   color.background.primary

  Nav bar          type.title1 \'Insights\', left-aligned. Right: time
                   range picker \'Week / Month / All\'

  Section 1        type.subheadline \'TIME PER GOAL\' header.
                   InsightBarChart below --- 4 bars, full-width chart
                   area, 180pt tall

  Section 2        type.subheadline \'GOAL BALANCE\' header. RadarChart
                   centered, 240pt x 240pt, card bg

  Section 3        type.subheadline \'STREAKS\' header. Vertical list of
                   StreakBadges --- one per DailyAction

  Section 4        Summary stats row: 3 equally-wide stat cards ---
                   \'Total Hours\', \'Daily Average\', \'Best Day\'. Each
                   card: large number in type.title1, label in
                   type.footnote below, elevation.1

  Empty state      If no data: centered illustration + \'Complete your
                   first session to see insights.\' in type.body
  ---------------- ------------------------------------------------------

**Screen 6 --- Goals Manager**

  ---------------- ------------------------------------------------------
  **Property**     **Value**

  Frame            390 x 844pt, background: color.background.primary

  Nav bar          type.title1 \'My Goals\'. Right: Edit button (pencil
                   icon) to enable reorder mode

  Goal cards       Vertically stacked cards --- 16pt margin, 8pt gap,
                   elevation.1

  Goal card        radius.xl, 88pt height. Left: 48pt circle in goal
                   color with SF Symbol icon. Center: goal name
                   type.title2 + action count in type.footnote. Right:
                   weekly hours in type.headline + goal color + chevron

  Reorder mode     Drag handles appear on left of each card (3-line
                   icon), chevrons hide

  Add goal CTA     Dashed border card at bottom, \'+\' icon, \'Add Goal\'
                   label in type.headline, color.accent.blue

  Swipe actions    Swipe left: Archive (orange) and Delete (red) actions
  ---------------- ------------------------------------------------------

**Screen 7 --- Goal Detail (v1.1)**

  ---------------- ------------------------------------------------------
  **Property**     **Value**

  Frame            390 x 844pt, scrollable

  Header           Full-width 160pt hero zone: goal color gradient
                   background (goal color to slightly darker). Goal icon
                   48pt white SF Symbol centered. Goal name in
                   type.largeTitle white below.

  Why section      White card below header: type.subheadline \'WHY THIS
                   MATTERS\' label + type.body why statement text +
                   pencil edit icon top-right

  Stats strip      3 inline stat pills: total hours, current streak,
                   actions count --- goal color text

  Actions list     type.subheadline \'DAILY ACTIONS\' header + list of
                   action rows (simplified ActionRow variant, no start
                   button)

  Add action CTA   Ghost button \'+ Add Action\' in goal color

  Wallpaper CTA    Bottom card: \'Set as Lock Screen\' button, goal
                   color, photo icon
  ---------------- ------------------------------------------------------

**Screen 8 --- Wallpaper Generator (v1.1)**

  ---------------- ------------------------------------------------------
  **Property**     **Value**

  Frame            390 x 844pt, background: #0F0F14 (matches Focus
                   screen)

  Preview          iPhone mockup frame (290pt wide) in center of screen
                   showing live wallpaper preview

  Wallpaper        1170x2532 canvas (iPhone 14 resolution). Dark gradient
                   bg. Goals listed with icon + name + why statement
                   (truncated to 1 line). Each goal in its color.

  Layout tpl       Horizontal scroll of 3 layout chips below preview:
                   \'Minimal\' / \'Bold\' / \'Grid\'

  Save button      PrimaryButton \'Save to Photos\' ---
                   color.accent.success (green), full-width
  ---------------- ------------------------------------------------------

**Screen 9 --- Reminders (v1.1)**

  ---------------- ------------------------------------------------------
  **Property**     **Value**

  Frame            390 x 844pt

  List             One reminder row per DailyAction --- shows ActionRow
                   simplified + time picker on right

  Time picker      Native iOS UIDatePicker in .time mode, compact style,
                   inline in each row

  Toggle           UISwitch on each row to enable/disable reminder for
                   that action

  Save             Reminders save immediately on toggle/time change ---
                   no explicit save button
  ---------------- ------------------------------------------------------

**Screen 10 --- Weekly Review (v1.1)**

  ---------------- ------------------------------------------------------
  **Property**     **Value**

  Frame            390 x 844pt, scrollable

  Header card      Full-width card with InsightBarChart summary for the
                   week --- compact 120pt height

  Q1               type.title3 \'What went well this week?\' + multiline
                   textarea, radius.lg

  Q2               type.title3 \'What would I improve?\' + multiline
                   textarea, radius.lg

  Q3               type.title3 \'Goal focus for next week?\' + GoalChip
                   multi-select grid

  CTA              PrimaryButton \'Save Review\' --- color.accent.blue
  ---------------- ------------------------------------------------------

**4. Figma File Structure**

When recreating this in Figma, organize the file exactly as follows for
handoff-readiness:

**4.1 Pages**

  ------------------ ----------------------------------------------------
  **Page Name**      **Contents**

  🎨 Tokens          Color styles, text styles, effect styles, spacing
                     tokens --- all design tokens as Figma styles and
                     variables

  🧩 Components      All 9 base components as named Figma components with
                     variants (states, sizes, goal variants)

  📱 Screens --- MVP All 6 MVP screens at 390x844pt, labeled, in order:
                     Onboarding / Today / Focus / Session Complete /
                     Insights / Goals Manager

  📱 Screens ---     Screens 7--10: Goal Detail / Wallpaper Generator /
  v1.1               Reminders / Weekly Review

  🔄 Flows           User flow diagram: onboarding flow + focus session
                     flow using frame-to-frame arrows

  📐 Architecture    Technical architecture diagram (data models, state
                     machine, API layer) recreated as a FigJam-style
                     diagram
  ------------------ ----------------------------------------------------

**4.2 Naming Conventions**

-   Frames: \[ScreenNumber\]-\[ScreenName\] e.g. \'02-Today\'

-   Components: \[Category\]/\[Name\]/\[Variant\] e.g.
    \'Action/ActionRow/Completed\'

-   Colors: \[category\].\[name\].\[variant\] e.g.
    \'goal.physique.primary\'

-   Text styles: \[scale\].\[name\] e.g. \'type.title2\'

-   All components use Auto Layout with defined resize behaviour

**4.3 Component Variants Required**

  ---------------------- ------------------------------------------------
  **Component**          **Required Variants**

  GoalChip               Goal=Physique/Finances/Skills/Mind

  ActionRow              Goal=Physique/Finances/Skills/Mind ×
                         State=Default/InProgress/Completed

  PrimaryButton          Size=Default/Small × Style=Filled/Ghost ×
                         State=Default/Pressed/Disabled

  TodayScoreRing         Score=0/25/50/75/100 (for design exploration
                         only)

  FocusTimerRing         Goal=Physique/Finances/Skills/Mind ×
                         Progress=0/25/50/75/100

  InsightBarChart        Period=Week/Month/AllTime

  RadarChart             State=Balanced/PhysiqueDominant/SkillsDominant
                         (example states)

  StreakBadge            Goal=Physique/Finances/Skills/Mind

  AppBlockBadge          State=Active/Inactive
  ---------------------- ------------------------------------------------

**5. Gemini Prompt Guide**

Use the following prompt structure when sending each screen to Gemini
for generation. The more context you provide upfront, the better the
output.

**5.1 Master Context Prompt**

Send this FIRST in your Gemini session before any screen prompts:

  -----------------------------------------------------------------------
  *You are a senior iOS UI designer creating screens for an app called
  Intentional --- a goal-tracking and focus app for iOS 17+. DESIGN
  SYSTEM: - Frame: 390 x 844pt (iPhone 14), \@3x assets - Font: SF Pro
  Display (headlines) / SF Pro Text (body) - Corner radius system: 8 / 12
  / 16 / 24pt - Spacing unit: 8pt base grid, 16pt screen margins - Goal
  colors: Physique=#4A9EED, Finances=#22C55E, Skills=#8B5CF6,
  Mind=#F59E0B - Background: #FFFFFF primary, #F9FAFB cards - Focus
  screen only: #0F0F14 dark background - Shadows: cards use 0 1px 3px
  rgba(0,0,0,0.08) - Style: Apple HIG-compliant, minimal, purposeful,
  premium feel - No decorative gradients except on the Goal Detail header
  and Focus timer glow - The app has a philosophy of intentional living
  --- every design choice should feel deliberate and calm Acknowledge
  this context and wait for individual screen prompts.*

  -----------------------------------------------------------------------

**5.2 Per-Screen Prompt Template**

  -----------------------------------------------------------------------
  *Create the \[SCREEN NAME\] screen for Intentional iOS app. LAYOUT:
  \[Paste the layout zones from Section 3 for this screen\] COMPONENTS TO
  USE: \[List the component names from Section 2 that appear on this
  screen\] CONTENT (use this exact placeholder text): \[Paste specific
  text/data examples\] STYLE NOTES: \[Any screen-specific style guidance
  from Section 3 design notes\] Output as a high-fidelity Figma-ready
  flat design at 390x844pt. Use the design system defined in the master
  context.*

  -----------------------------------------------------------------------

**5.3 Screen Order for Generation**

Generate screens in this order --- each one informs the visual language
of the next:

1.  Tokens & Components page first (establish the system)

2.  Today (Home) --- the visual language is set here

3.  Focus Session --- dark mode variant of the same language

4.  Session Complete --- celebratory, full color

5.  Insights --- data-dense but calm

6.  Goals Manager --- list-heavy, color-coded

7.  Onboarding --- last, because you now know the full system

**5.4 3D / Isometric Version Notes**

If generating a 3D or isometric marketing version of the screens,
provide these additional instructions to Gemini:

  -----------------------------------------------------------------------
  *For the 3D / isometric marketing render: - Place iPhone 14 Pro frame
  at 30-degree isometric angle - Background: deep navy gradient #0A0E1A
  to #1a1f35 - Multiple screens floating in 3D space --- stagger them at
  different depths and slight rotations - Ambient lighting: soft
  purple/blue rim light from top-left - Screen glow: each screen emits a
  subtle colored glow matching its goal color - Add depth shadow beneath
  each device - Style reference: Apple product photography meets
  Stripe\'s 3D illustrations - Resolution: 2880 x 1800pt for App Store
  feature graphic*

  -----------------------------------------------------------------------

**6. Asset Export Checklist**

Before handing off to development, ensure these assets are exported from
Figma:

-   App icon: 1024x1024pt, no alpha, rounded corners applied by the OS

-   All SF Symbols used --- list the exact symbol names (not custom
    icons)

-   Goal color fills as named Figma styles --- exported as Swift Color
    Assets

-   Onboarding illustrations if any added --- \@1x \@2x \@3x PNG

-   Wallpaper template backgrounds --- \@3x PNG at 1170x2532pt

-   All component states documented --- for SwiftUI implementation
    reference

-   Spacing and radius tokens --- exported as a JSON token file for
    Style Dictionary

  -----------------------------------------------------------------------
  *This document is the complete design handoff for Intentional v1.0
  (MVP) and v1.1. Every measurement, color, component, and screen state
  needed to build and ship the app is defined here. No assumptions should
  be needed during development.*

  ----------------------------------------------------------------------