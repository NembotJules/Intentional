# Design System Document

## 1. Overview & Creative North Star: "The Digital Sanctuary"
This design system is engineered to transform goal-tracking from a chore into a ritual. The Creative North Star is **"The Digital Sanctuary"**—a high-end editorial experience that prioritizes cognitive ease through intentional asymmetry, vast negative space, and tonal depth. 

While fully compliant with iOS 17+ HIG, this system moves beyond standard "table view" layouts. It treats the screen as a gallery where content is curated, not just displayed. We achieve a "premium" feel by replacing harsh structural lines with soft environmental shifts and utilizing sophisticated SF Pro typography scales to create a sense of authoritative calm.

---

## 2. Colors & Surface Logic
The palette is rooted in a pure, light-flooded aesthetic, using subtle tonal shifts to define importance rather than traditional dividers.

### Core Palette
- **Background (`surface`):** `#F9F9FF` (A cool, premium white)
- **Primary Action (`primary_container`):** `#1E3A8A` (Deep Accent Blue)
- **Focus Mode Background:** `#0F0F14` (Deep Ink)
- **Goal Specifics (10% Opacity Tints):**
    - Physique: `#4A9EED`
    - Finances: `#22C55E`
    - Skills: `#8B5CF6`
    - Mind: `#F59E0B`

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section content. Boundaries must be defined through background color shifts. Use `surface-container-low` for secondary sections sitting on a `surface` background. This creates a "seamless" interface that feels modern and bespoke.

### Surface Hierarchy & Nesting
Treat the UI as a series of layered fine paper. 
- **Base Layer:** `surface` (#F9F9FF)
- **Secondary Section:** `surface-container-low` (#F1F3FF)
- **Floating Element/Card:** `surface-container-lowest` (#FFFFFF)
This nesting creates a soft, natural lift that guides the eye without visual "noise."

### The "Glass & Gradient" Rule
For floating action buttons or high-priority stats, use Glassmorphism (semi-transparent `surface` colors with a `20px` backdrop blur). Use subtle linear gradients for progress rings (e.g., `primary` to `primary-container`) to provide a "liquid" soul to completion metrics.

---

## 3. Typography: Editorial Authority
We utilize the SF Pro family to create a high-contrast hierarchy that feels like a luxury magazine.

| Level | Token | Size | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Display** | `display-lg` | 3.5rem | Bold | Hero stats or morning greetings. |
| **Headline**| `headline-md`| 1.75rem| Semibold | Main category headers. |
| **Title**   | `title-lg`   | 1.375rem| Medium | Card titles and goal names. |
| **Body**    | `body-md`    | 0.875rem| Regular | Descriptions and supportive text. |
| **Label**   | `label-sm`   | 0.6875rem| Bold (All Caps) | Meta-data and status indicators. |

**Editorial Note:** Use wide letter-spacing (`+0.5pt`) for `label-sm` to maintain legibility and a premium, spacious feel.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows are often a sign of lazy design. This system favors **Tonal Layering**.

- **The Layering Principle:** Depth is achieved by "stacking" surface tiers. A `surface-container-lowest` card placed on a `surface-container-low` section provides a 3D effect through color contrast alone.
- **Ambient Shadows:** For high-priority floating elements, use "Ambient Shadows": `0 8px 32px rgba(20, 27, 43, 0.06)`. This mimics soft, overhead museum lighting.
- **The Ghost Border:** If a boundary is required for accessibility, use the `outline-variant` token at **15% opacity**. Never use a 100% opaque border.
- **Glassmorphism:** Apply a `blur(12px)` and `opacity(80%)` to `surface-container-highest` for modal overlays to keep the user grounded in their previous context.

---

## 5. Components
All components follow the **8pt Grid System** with a mandatory **16pt screen margin**.

### Cards & Lists
- **Rule:** No divider lines. Separate list items using `spacing-4` (1rem) of vertical white space.
- **Goal Cards:** Use a **4pt vertical accent bar** on the leading edge (left) colored with the specific Goal Color. The background of the card should be the 10% tint of the Goal Color.
- **Radius:** Standard cards use `xl` (1.5rem / 24pt) for a soft, approachable feel.

### Buttons & Chips
- **Primary Button:** Large `full` pill shape using the `primary_container` (#1E3A8A). Text should be `on_primary`.
- **Secondary/Ghost:** `surface-container-high` background with `on_surface` text.
- **Chips:** `sm` (0.25rem / 4pt) or `full` pill shapes. Used for goal categories (e.g., "Daily", "Weekly").

### Progress Rings
- **Visual Style:** Use a `6pt` stroke width. The "track" is `outline-variant` at 20% opacity. The "fill" is a gradient of the Goal Color. Ensure the ends of the stroke are `rounded`.

### Inputs
- **Style:** `surface-container-low` background, `md` (0.75rem / 12pt) corner radius. Use `label-md` for floating labels that animate to 70% size on focus.

---

## 6. Do’s and Don’ts

### Do:
- **Use "Breathing Room":** If you think there is enough white space, add 8pt more.
- **Intentional Asymmetry:** Align primary headers to the left, but place secondary stats (like streaks) in asymmetrical floating chips to create visual interest.
- **Soft Transitions:** Use `cubic-bezier(0.4, 0, 0.2, 1)` for all state transitions (hover, press, toggle).

### Don't:
- **Don't use black (#000000):** It is too harsh for this system. Use `on_background` (#141B2B) for maximum contrast.
- **Don't use standard iOS Dividers:** They break the "Sanctuary" vibe. Use spacing or tonal shifts instead.
- **Don't crowd the margins:** Respect the 16pt (2.0rem) safety zone. Content should never feel "trapped" by the screen edges.

---
*End of Design System Document*