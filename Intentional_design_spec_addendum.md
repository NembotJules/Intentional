# INTENTIONAL — Design Spec Addendum v1.1
**Aesthetic Refinements from Stitch · Applies on top of intentional-design-spec.md**

---

## How to use this document

This addendum updates specific sections of `intentional-design-spec.md` with aesthetic
refinements extracted from the Stitch "Disciplined Archive" output. **It does not
replace the product logic, screen layouts, component library, or color system from
the original spec.** Goal colors, the split personality rule, the component names,
and the screen-by-screen layout are unchanged.

Read the original spec first. Then apply these overrides where indicated.

---

## What changes. What does not.

| Area | Status | What changes |
|---|---|---|
| Goal colors (Blue, Green, Purple, Amber) | UNCHANGED | Nothing |
| Split personality rule (BRUTALIST / CLEAN DARK) | UNCHANGED | Nothing |
| Screen layouts and component hierarchy | UNCHANGED | Nothing |
| User stories and acceptance criteria | UNCHANGED | Nothing |
| Background color scale | **UPDATED** | Richer surface hierarchy |
| Body text colors | **UPDATED** | Higher contrast, readable on-screen |
| Input field style | **UPDATED** | Bottom-border only, no box |
| Card / section separation | **UPDATED** | Background shifts, not borders |
| Typography weight + tracking | **UPDATED** | Tighter headlines, wider labels |
| Progress dots | **UPDATED** | 2px segmented bars, not round dots |
| Primary CTA button | **UPDATED** | Full-width, higher padding, bolder |
| Border strategy | **UPDATED** | Ghost borders at 15% opacity only |

---

## Section 1 — Updated Background Scale

**Replace** the background tokens in Section 2.1 of the original spec with this
richer surface hierarchy. The Stitch system uses 6 levels instead of 4, creating
more depth without any shadows.

```
OLD (original spec)     NEW (v1.1)
────────────────────    ────────────────────────────────────────
BG_DEEPEST  #080808  →  SURFACE_LOWEST    #0e0e0e  (BRUTALIST screens)
BG_BASE     #0d0d0d  →  SURFACE           #131313  (CLEAN DARK base)
BG_SURFACE  #111111  →  SURFACE_LOW       #1b1b1b  (secondary regions)
BG_CARD     #161616  →  SURFACE_CONTAINER #1f1f1f  (cards, grouped content)
BG_ELEVATED #1a1a1a  →  SURFACE_HIGH      #2a2a2a  (elevated cards, active states)
            —        →  SURFACE_HIGHEST   #353535  (highest elevation, modals)
```

**Why this is better:** The original 4-step scale had gaps that forced the use of
borders to separate sections. The 6-step scale lets you separate sections purely
by background shift — which feels more premium and avoids the "boxed-in" look.

**BRUTALIST screens** (Focus, Session Complete, Welcome, The Problem, The System)
still use `SURFACE_LOWEST #0e0e0e` as base. This is essentially unchanged from
`#080808` — the grain and scanlines create the atmosphere, not the background.

---

## Section 2 — Updated Text Color Scale

**Replace** the text tokens in Section 2.3 of the original spec.

The core problem in v1 was that body copy at `#3a3a3a`–`#444` on `#080808`
was near-invisible. The Stitch system uses a tighter, higher-contrast scale.

```
Token              v1.0 value    v1.1 value    Usage
──────────────────────────────────────────────────────────────────────
TEXT_PRIMARY       #e8e4dc    →  #e2e2e2       Headlines, key values
TEXT_SECONDARY     #888888    →  #c6c6c6       Goal names, card titles
TEXT_MUTED         #555555    →  #8a8a8a       Body copy, descriptions
TEXT_LABEL         #444444    →  #6b6b6b       Section labels, meta tags
TEXT_DIM           #333333    →  #474747       Placeholders, char counts
TEXT_GHOST         #252525    →  #353535       Ghost text, skip links
```

**The rule:** never use a text color darker than `#474747` for any visible copy.
If text needs to be de-emphasised, use opacity (`0.4`) on `#e2e2e2` rather than
reaching for a near-black hex. This keeps dark-mode legibility consistent.

---

## Section 3 — Input Field Style (Breaking Change)

**Replace** the input field style in Section 3 (Component Library) of the
original spec entirely.

**v1.0 style** — full box with background and border on all sides:
```jsx
background: '#0e0e0e'
border: '0.5px solid #222'
borderRadius: 8
padding: '11px 13px'
```

**v1.1 style** — bottom border only, transparent background:
```jsx
// Text input (goal name, action name)
background: 'transparent'
borderWidth: 0
borderBottomWidth: 1
borderBottomColor: '#474747'  // outline_variant at full opacity
borderRadius: 0
paddingVertical: 14
paddingHorizontal: 0
fontFamily: 'SpaceGrotesk-Bold'
fontSize: 22
color: '#e2e2e2'
letterSpacing: -0.5
// Placeholder
placeholderTextColor: '#353535'

// Focus state
borderBottomColor: '#e2e2e2'  // full white on focus
```

**Textarea (Why Statement)**
```jsx
background: 'transparent'
borderWidth: 0
borderBottomWidth: 1
borderBottomColor: '#474747'
borderRadius: 0
paddingVertical: 12
paddingHorizontal: 0
fontFamily: 'IBMPlexMono'
fontSize: 12
color: '#e2e2e2'
lineHeight: 20
```

**Why this is better:** The boxed input on a near-black background created a
"form on a dark website" feel. The bottom-border-only treatment reads as
intentional editorial design — like filling in a field on a physical document.
It also removes one layer of visual noise from the screen.

---

## Section 4 — Card and Section Separation (Breaking Change)

**Replace** the card background and border approach throughout the app.

**The No-Line Rule (from Stitch DESIGN.md, adopted verbatim):**
> Sectioning must be achieved through background shifts, not 1px solid borders.
> Lines are architectural "scars" — use them only for progress or technical
> dividers, never for layout containment.

**v1.0** — cards used `background: #161616` + `border: 0.5px solid #222`

**v1.1** — cards use background shifts only:

```
Screen background:    SURFACE          #131313
Card / group:         SURFACE_CONTAINER #1f1f1f   (no border)
Elevated card:        SURFACE_HIGH     #2a2a2a    (no border)
Active / selected:    SURFACE_HIGHEST  #353535    (no border)
```

**Exception — Ghost Border:** For interactive elements that need a boundary
(input fields in focus state, selected chips, swatch ring), use a single
border at **15% opacity** of `#ffffff`:

```jsx
borderColor: 'rgba(255, 255, 255, 0.15)'
borderWidth: 0.5
```

This is visible enough to communicate interactivity without boxing things in.

**Exception — Accent bars:** The 2px left accent bar on ActionRows still uses
full goal color at opacity 1.0. This is a deliberate mark, not a container border.

**Exception — Technical dividers:** The horizontal `hdiv` separator (1px) between
content sections is kept. It reads as a technical element, not a layout border.

---

## Section 5 — Typography Refinements

**Update** the font size scale in Section 2.4 of the original spec.

### Headline tracking (letter-spacing)

Stitch uses tighter tracking on large display text and wider tracking on labels.
Apply these values:

```
Display (64px+):      letterSpacing: -3      (-0.05em equivalent)
Large headline (36px+): letterSpacing: -2    (-0.04em — unchanged)
Medium headline (24px): letterSpacing: -1    (-0.03em — unchanged)
Small headline (18px):  letterSpacing: -0.5
Body (IBM Plex Mono):   letterSpacing: 0.3   (0.02em — unchanged)
Labels uppercase:       letterSpacing: 2.5   (0.2em — slightly wider)
Tab labels:             letterSpacing: 1.5   (keep as-is)
```

### Section labels — format update

**v1.0:** `▶ DAILY ACTIONS`
**v1.1:** `01 // DAILY ACTIONS` or `▶ 01 · DAILY ACTIONS`

The Stitch numbering system (`01 //`, `02 //`) adds a "technical serial" quality
that reinforces the brutalist aesthetic without changing meaning. Apply selectively
to onboarding steps and section headers. Keep `▶` prefix on Today screen group
headers (goal name headers don't need numbers).

### CTA button typography

```
v1.0: fontSize: 10, letterSpacing: 3
v1.1: fontSize: 11, letterSpacing: 3.5, fontWeight: '700'
```

---

## Section 6 — Progress Indicator Update

**Replace** the progress dots component (Section 3.5) with segmented bars.

**v1.0** — round dots, 3px height:
```jsx
<View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: ... }} />
```

**v1.1** — rectangular segmented bars, 2px height, no border radius:
```jsx
// Each segment
<View style={{
  flex: 1,          // equal width, fills row with gap
  height: 2,
  borderRadius: 0,  // hard rectangular ends — no softness
  backgroundColor: i === step ? '#e2e2e2'    // active: full white
                  : i < step  ? '#353535'    // done: surface_highest
                              : '#1f1f1f',   // future: surface_container
}} />

// Container
<View style={{
  flexDirection: 'row',
  gap: 4,
  marginBottom: 20,
}} />
```

**Visual effect:** Instead of dots that grow, you get a row of equal-width bars
where the active one is white and the rest recede. This matches the Stitch
aesthetic exactly and reads as a "progress tape" rather than "step counter."

---

## Section 7 — Primary CTA Button Update

**Replace** the CTAButton component (Section 3.6) with this higher-weight version.

```jsx
// v1.1 Primary CTA
<TouchableOpacity style={{
  width: '100%',
  paddingVertical: 18,        // was 11 — more presence
  borderRadius: 6,            // was 8 — slightly more angular
  borderWidth: 0,             // no border on primary CTA
  backgroundColor: '#ffffff', // solid white fill for primary action
  alignItems: 'center',
  justifyContent: 'center',
}}>
  <Text style={{
    fontFamily: 'IBMPlexMono-Medium',
    fontSize: 11,
    color: '#0e0e0e',          // dark text on white button
    letterSpacing: 3.5,
    textTransform: 'uppercase',
  }}>
    {label} →
  </Text>
</TouchableOpacity>

// v1.1 Secondary / Goal-colored CTA (used on CLEAN DARK screens)
// Keep the original bordered style but with updated values:
<TouchableOpacity style={{
  width: '100%',
  paddingVertical: 16,
  borderRadius: 6,
  borderWidth: 1,
  borderColor: goalColorBorder,   // rgba(goalColor, 0.3)
  backgroundColor: 'transparent',
  alignItems: 'center',
  justifyContent: 'center',
}}>
  <Text style={{
    fontFamily: 'IBMPlexMono-Medium',
    fontSize: 11,
    color: goalColor,
    letterSpacing: 3.5,
    textTransform: 'uppercase',
  }}>
    {label} →
  </Text>
</TouchableOpacity>
```

**When to use which:**
- **White fill CTA** — BRUTALIST screens (Welcome, The Problem, System, Session Complete, Ready). The white button is the single high-contrast "decision point" element.
- **Goal-colored bordered CTA** — CLEAN DARK screens (Create Goal, Daily Action, Why Statement, Today action rows). Goal color is already the dominant accent — the button harmonises with it.

---

## Section 8 — Screen-Specific Updates

These are the direct corrections to the screen specs in Section 4 of the original.
Apply these on top of the existing screen definitions — they are additive, not
replacements.

### All CLEAN DARK screens (Today, Insights, Goals Manager, Onboarding steps 2–4)

```
Background:       #131313   (was #0d0d0d)
Card background:  #1f1f1f   (was #161616, no border)
Elevated card:    #2a2a2a   (was #1a1a1a, no border)
Input fields:     bottom-border only (see Section 3)
Section labels:   #6b6b6b   (was #333)
Body copy:        #8a8a8a   (was #555)
```

### All BRUTALIST screens (Focus, Session Complete, Welcome, Story screens)

```
Background:       #0e0e0e   (was #080808 — barely perceptible difference,
                             grain makes the atmosphere, not the hex)
Card background:  #1b1b1b   (was #111, no border)
Text primary:     #e2e2e2   (was #e8e4dc)
```

### Today screen — action row update

```jsx
// v1.1 ActionRow — remove border, use surface shift
<View style={{
  backgroundColor: '#1f1f1f',    // SURFACE_CONTAINER (was #161616 + border)
  borderWidth: 0,                // REMOVE border
  borderRadius: 8,
  paddingVertical: 12,           // was 8 — more breathing room
  paddingHorizontal: 12,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  marginBottom: 6,               // was 4
}}>
```

### Insights screen — bar chart update

The bar chart track background changes from `#161616` to match surface hierarchy:
```jsx
barTrack: { backgroundColor: '#1f1f1f' }   // was #161616
```

---

## Section 9 — What NOT to take from Stitch

These Stitch design choices look good in isolation but conflict with Intentional's
product logic. Do not implement them.

| Stitch feature | Why to reject it |
|---|---|
| Monochrome bar charts and analytics | Goal colors are the meaning system. White-only charts lose the ability to read which goal data belongs to. |
| "PROTOCOL 001 //" action naming | Your actions have user-defined names. The protocol numbering is decorative branding for a different product. |
| Bottom-border only inputs for ALL fields | Keep bottom-border for single-line inputs (goal name, action name). The Why Statement textarea still needs a contained field because it's multi-line — use `SURFACE_CONTAINER` background with ghost border. |
| "FREQUENCY ARCHITECTURE" (Daily/Weekly) | Not in Intentional's data model. Habits are binary, sessions are time-based. No frequency selector. |
| Glassmorphism for floating overlays | Looks great in a web demo, unreliable in React Native without react-native-blur. Skip for MVP. |
| `surface_tint: #c6c6c7` on backgrounds | Creates an unwanted warm cast on the dark surfaces. Not needed. |
| Inter for body text | Your spec uses IBM Plex Mono for metadata. Keep it — it defines the aesthetic more than Inter does. |

---

## Agent Prompt

Use this exact prompt when handing the combined spec to your coding agent:

---

```
You are implementing the UI for Intentional, a focus and goal-tracking iOS app
built with Expo / React Native.

You have two documents to work from:

1. intentional-design-spec.md  — the primary specification. Screen layouts,
   component library, user stories, navigation, and data layer are all defined
   here. This is your source of truth for WHAT to build and HOW it is structured.

2. intentional-design-spec-addendum-v1.1.md (this document) — aesthetic
   refinements only. This updates specific visual tokens: background colors,
   text colors, input field style, card separation approach, progress indicator
   shape, CTA button weight, and typography tracking. It does not change any
   screen layout, component name, or product logic.

Apply the addendum as a set of overrides on top of the primary spec.
When the two documents conflict on a visual value (a color hex, a border style,
a padding value), the addendum wins. When the primary spec defines something the
addendum does not mention (screen structure, navigation, data models, component
names, acceptance criteria), the primary spec is authoritative.

The visual hierarchy to keep in mind:
- BRUTALIST screens use SURFACE_LOWEST (#0e0e0e), grain overlay, scanlines
- CLEAN DARK screens use SURFACE (#131313) as base
- Cards and groups are separated by background shift, never by borders
- Goal colors (Blue #4A9EED, Green #22C55E, Purple #8B5CF6, Amber #F59E0B)
  are the only non-neutral colors in the app — they propagate to every element
  that belongs to a specific goal
- Primary CTAs on BRUTALIST screens are solid white (#ffffff background,
  #0e0e0e text)
- Bordered CTAs on CLEAN DARK screens use goal color at 0.3 opacity for border

Reference intentional-screens-reference.png for the visual ground truth on
layout and composition. The color values in this addendum supersede what you
see in that image — the image shows the v1.0 palette, this addendum upgrades it.

Do not invent new screens, rename components, or introduce product concepts not
present in intentional-design-spec.md. Build exactly what the spec describes,
with the visual refinements from this addendum applied on top.
```

---

*Addendum v1.1 — applies to intentional-design-spec.md v1.0.*
*Changes: background scale, text scale, inputs, cards, progress indicator, CTA.*