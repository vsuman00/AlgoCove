# AlgoCove Design System and Product UI Plan

**Status:** Approved brand and visual direction, implementation not started  
**Document role:** Project-wide source of truth for learner-facing UI and visual design  
**Design basis:** The three approved DSA mockups are the visual authority: Learner Home, Guided Problem Workspace, and DSA Roadmap  
**Last updated:** 2026-09-17  
**Architecture status:** This document defines design intent only. It does not approve product implementation or change Gate A0.

---

## 1. Purpose

This document turns the approved AlgoCove mockups into a repeatable design system. It defines the brand, logo, color tokens, typography, spacing, layout, components, interaction states, visualization language, responsive behavior, accessibility rules, and page patterns required to build a consistent product.

Every learner-facing page must feel like part of one system. New UI must reuse these rules rather than inventing a new visual language per feature.

The approved mockups are authoritative for brand aesthetics, color relationships, page composition, visual density, illustration character, and visualization style. This document is authoritative for behavior, accessibility, responsive rules, component states, and implementation constraints that a static mockup cannot express.

If the implementation does not visually resemble the relevant approved mockup at first inspection, the implementation is not conformant. Accessibility corrections may darken a text or action color, but must preserve the approved hue family, hierarchy, and overall character.

### 1.1 Product definition

AlgoCove is a guided Data Structures and Algorithms mastery platform for students and job seekers. It supports a measurable learning loop:

1. Recommend one useful next activity.
2. Teach the concept, pattern, invariant, and algorithmic reasoning.
3. Ask the learner to plan and predict before execution.
4. Let the learner code in Python, JavaScript, TypeScript, Java, C++, or C.
5. Run tests and show normalized diagnostics.
6. Use active, accessible 2D visualization to inspect state changes.
7. Collect evidence through prediction, pseudocode, tests, visualization, and explain-back.
8. Unlock an outbound external practice link when the readiness policy permits it.
9. Schedule later review and transfer work.

### 1.2 Intended users

- Students learning DSA foundations.
- Job seekers preparing for technical interviews.
- Developers strengthening pattern recognition and transfer skills.
- Learners who benefit from keyboard access, reduced motion, text-equivalent visualizations, or structured guidance.

### 1.3 Design thesis

> AlgoCove should feel like a calm place for serious practice: clear enough to reduce cognitive load, rigorous enough to earn trust, and warm enough to support productive struggle.

The interface must communicate that understanding matters more than activity. It must not resemble a trading terminal, a generic administration dashboard, a LeetCode clone, or a gamified streak application.

### 1.4 The memorable idea

The product should be remembered as **the learning environment that makes algorithmic thinking visible before it rewards the answer**.

Every important design decision should reinforce that idea.

### 1.5 Approved mockup registry

The three approved references are preserved as local design artifacts. These files are immutable visual references; create a new dated version rather than replacing them.

| Reference | Stable artifact | SHA-256 | Authority |
|---|---|---|---|
| Learner Home | `/Users/vaibhavsuman/.gstack/projects/AlgoCove/designs/approved-dsa-20260917/learner-home.png` | `6b2497a86a27084f3f06c795af9e95eb05bfbeb8007c20a7a9b08399f61a08fd` | Logo, light home shell, greeting, Continue Learning, daily plan, review queue, learning signals, coastal-header treatment |
| Guided Problem Workspace | `/Users/vaibhavsuman/.gstack/projects/AlgoCove/designs/approved-dsa-20260917/guided-problem-workspace.png` | `7265b7cfff0dce39282ae5ca3ad059366319cb375f451c4e467799a79f98e16a` | Focused shell, step rail, three-pane workspace, pseudocode dock, prediction visualizer, evidence and hint treatment |
| DSA Roadmap | `/Users/vaibhavsuman/.gstack/projects/AlgoCove/designs/approved-dsa-20260917/dsa-roadmap.png` | `8263fd561aeff48c74d1fad38b711a8f31517af175b23ad0f86b6afc04ff9a08` | Deep-ocean journey shell, prerequisite path, current-plan blue, weekly capacity, safe replan, plan health and provenance |

The incorrect triangular and double-wave logos visible in the second and third generated images are explicitly superseded by the first mockup's cove-and-angle-brackets mark. All screens use the first mockup's logo when implemented.

Open the references: [Learner Home](/Users/vaibhavsuman/.gstack/projects/AlgoCove/designs/approved-dsa-20260917/learner-home.png), [Guided Problem Workspace](/Users/vaibhavsuman/.gstack/projects/AlgoCove/designs/approved-dsa-20260917/guided-problem-workspace.png), [DSA Roadmap](/Users/vaibhavsuman/.gstack/projects/AlgoCove/designs/approved-dsa-20260917/dsa-roadmap.png).

These paths are local to this machine, not portable repository assets. Transfer this reference set with the document for another machine or collaborator, retaining the checksums. Approval covers the visual direction and first logo, not every illustrative date, arithmetic value, learning-state label, or generated sentence in the images. Product data and state consistency must come from the product contracts.

---

## 2. Core Experience Principles

### 2.1 One calm next action

The home page prioritizes one recommended action with an explanation. Secondary work remains visible but does not compete with the primary action.

### 2.2 Reasoning before execution

Pseudocode and prediction are first-class work, not optional decoration around the code editor. The UI should make the learner's reasoning visible and revisable.

### 2.3 Evidence instead of confidence theater

Readiness is shown through evidence categories. Never replace it with a circular percentage, arbitrary confidence score, XP total, or a single blended mastery number.

### 2.4 Productive struggle without punishment

Hints are progressive, bounded, and recorded. Missed days are handled through safe replanning, not guilt, red streaks, or impossible catch-up schedules.

### 2.5 Visualization is an interaction

The learner predicts, manipulates, or explains state. Passive animation is secondary. Every visual state must have a text equivalent.

### 2.6 External practice is honestly labeled

External practice is learner-confirmed and separate from AlgoCove-observed evidence. The UI must never imply provider verification or live account synchronization.

### 2.7 Color carries meaning sparingly

Jade means learning progress, readiness, or a top-level primary action. Deep Ocean is the focused-workspace action color. Current Blue marks the learner's present location inside a roadmap or weekly plan. Coral indicates an error, destructive condition, or overdue obligation. Sand indicates review or attention. Tide blue supports information and explanation. External Blue distinguishes learner-confirmed outbound practice. No color may be the sole state indicator.

---

## 3. Visual Direction

### 3.1 Direction name

**Calm Computational Cove**

The design combines:

- the clarity and density of a strong developer tool;
- the warmth and reassurance of a thoughtful learning product;
- a cove-inspired marine palette that gives the product a recognizable identity;
- editorial moments for reflection without turning the application into a marketing page.

### 3.2 Aesthetic properties

| Dimension | Direction |
|---|---|
| Decoration | Intentional, not expressive |
| Layout | Grid-disciplined application shell with focused workspace variants |
| Density | Comfortable on guidance pages; compact inside workspaces and data views |
| Shape | Mostly rectangular with modest radii and clear borders |
| Depth | Flat surfaces; hierarchy comes from spacing, tone, and borders |
| Illustration | Limited to purposeful cove landscapes, algorithm diagrams, and learning-state visuals |
| Motion | Minimal and instructional |
| Theme | Canonical light theme; dark theme is deferred until designed independently |

### 3.3 Deliberate departures from category conventions

1. **No gamified mastery theater.** Progress uses evidence and review health rather than coins, lives, leaderboards, or giant streaks.
2. **The visualizer is prediction-first.** Playback remains unavailable until the learner commits a prediction at required checkpoints.
3. **The roadmap is a prerequisite path, not a task board.** It shows why concepts appear in sequence and whether the schedule fits the learner's capacity.
4. **External practice is visually separated.** Provider handoffs use a distinct outbound symbol and learner-confirmed label.

### 3.4 Anti-patterns

Do not introduce:

- purple or violet gradients;
- glassmorphism or frosted panels;
- maximum rounding on every surface;
- large generic metric-card grids;
- marketing-style hero blocks inside the authenticated product;
- neon developer aesthetics;
- passive visualizations presented as proof of understanding;
- celebratory confetti for ordinary completion;
- color-only status indicators;
- XP, coins, hearts, ranking, or public leaderboards;
- giant streak flames or shame-oriented missed-day states;
- copied visual language from external coding platforms.

---

## 4. AlgoCove Brand and Logo

### 4.1 Canonical logo

The canonical AlgoCove logo is the mark approved in the first DSA Learner Home mockup.

It consists of:

1. An open circular **cove form** that suggests shelter, continuity, and a wave.
2. A pair of **angle brackets** inside the cove, representing code and structured reasoning.
3. The **AlgoCove** wordmark in a confident semibold sans serif.

The cove must remain the dominant shape. The brackets should feel held by the cove rather than floating beside it. The mark must be redrawn as a clean vector during implementation, using the approved mockup silhouette as the visual reference. Do not replace it with the triangular or double-wave marks that appeared in later generated drafts.

### 4.2 Construction guidance

- Base construction box: `40 × 40` units.
- Outer cove: approximately `32–34` units in diameter.
- Stroke/solid-form visual weight: approximately `4–5` units.
- Opening: upper-right quadrant, large enough to keep the shape from reading as a generic letter C.
- Lower cove: gently weighted to suggest a wave or protected inlet.
- Angle brackets: optically centered within the inner negative space.
- Bracket stroke: approximately `60–70%` of the cove stroke weight.
- Internal clearance: brackets must never touch the cove.
- Optical correction is allowed; strict mathematical centering is not required.

These measurements guide vector recreation. The approved silhouette, not an arbitrary geometric circle, remains the final visual test.

### 4.3 Lockups

| Lockup | Usage |
|---|---|
| Primary horizontal | Product navigation, authentication, marketing header |
| Compact mark | Collapsed navigation, favicon, app icon, mobile header |
| Monochrome | Printing, constrained single-color use, embossed or engraved use |

The product shell uses the mark plus `AlgoCove`. A tagline is not part of the product-shell logo and must not be baked into the vector asset.

### 4.4 Color variants

| Surface | Mark | Wordmark |
|---|---|---|
| Light/cloud | Deep Ocean `#123F46` with Jade accent `#1A8F78` | Ink `#102A2E` |
| Deep-ocean navigation | Seafoam `#73D6C4` or white | Cloud White `#F8FBFA` |
| Monochrome light | Ink `#102A2E` | Ink `#102A2E` |
| Monochrome dark | White `#FFFFFF` | White `#FFFFFF` |

Do not use coral, sand, gradients, shadows, or multiple unrelated colors inside the logo.

### 4.5 Clear space and minimum size

- Define `x` as the width of one angle-bracket stroke.
- Keep at least `4x` clear space around the mark or complete lockup.
- Minimum digital mark: `28 × 28px`.
- Preferred navigation mark: `36–40px`.
- Minimum horizontal lockup width: `116px`.
- Favicon sizes must be optically simplified at `16px` and `24px`; preserve the cove opening and brackets.

### 4.6 Prohibited logo treatments

Never:

- stretch, skew, rotate, or outline the mark;
- close the cove opening;
- substitute braces, parentheses, or a terminal prompt for the brackets;
- place the logo over low-contrast photography;
- use the mark as a decorative page watermark;
- add an unapproved tagline directly to the lockup;
- animate the logo continuously;
- replace the first-mockup cove mark with another generated logo.

---

## 5. Color System

### 5.1 Color philosophy

AlgoCove uses a balanced but restrained palette: warm whites, ink text, cool borders, a light Home rail, and a deep-ocean Roadmap rail. Jade indicates completion and top-level action; Deep Ocean indicates workspace commitments; Current Blue identifies the current plan item. Tide blue explains. Sand calls for reflection or review. Coral identifies failure or urgency, with the labeled right-pointer exception defined in Section 15.3.

The hexadecimal values below are implementation targets derived from the approved palette and visual inspection, not exact colors extracted from a native design file. Generated raster images contain shading and antialiasing. Compare rendered swatches and components to the references before accepting the implementation; preserve the visible hue relationships when contrast requires an adjustment.

Color must not become decoration. If a color has no semantic or structural purpose, remove it.

### 5.2 Brand primitives

| Token | Hex | Purpose |
|---|---:|---|
| `ocean-950` | `#082F35` | Deep pressed states, strongest navigation depth |
| `ocean-900` | `#0B3B42` | Deep-ocean rail and dark surfaces |
| `ocean-800` | `#123F46` | Brand primary, headings on tinted surfaces |
| `ocean-700` | `#18565D` | Secondary dark action, hover borders |
| `ocean-600` | `#247079` | Supporting brand tone |
| `jade-800` | `#0C5C4E` | Primary-action pressed state |
| `jade-700` | `#0F6F5E` | Primary-action hover state |
| `jade-600` | `#147E69` | Accessible primary-action fill |
| `jade-500` | `#1A8F78` | Progress, active learning state, non-text accents |
| `jade-400` | `#42A991` | Supporting progress visuals |
| `jade-200` | `#A9DED2` | Strong selected/complete tint |
| `jade-100` | `#DDF2ED` | Selected navigation and success surface |
| `jade-50` | `#EEF8F5` | Quiet positive background |

### 5.3 Neutral and surface primitives

| Token | Hex | Purpose |
|---|---:|---|
| `cloud-0` | `#FFFFFF` | Raised surface, editor surface |
| `cloud-25` | `#FBFCFB` | Subtle page layer |
| `cloud-50` | `#F6F8F7` | Canonical application background |
| `cloud-100` | `#EEF3F1` | Muted surface and skeleton base |
| `slate-200` | `#DCE6E3` | Default border |
| `slate-300` | `#C8D6D3` | Strong border and disabled boundary |
| `slate-400` | `#99ABA8` | Placeholder, disabled icon |
| `slate-500` | `#6E8280` | Secondary text |
| `slate-600` | `#536966` | Supporting text |
| `ink-700` | `#294146` | Body text |
| `ink-800` | `#1B3338` | Strong body and labels |
| `ink-900` | `#102A2E` | Primary text and headings |
| `ink-950` | `#081D21` | Maximum emphasis and code editor text |

### 5.4 Supporting and semantic primitives

| Token | Hex | Purpose |
|---|---:|---|
| `tide-700` | `#225E78` | Accessible inline link text |
| `tide-500` | `#3C8FAD` | Informational icon and non-text accent |
| `tide-200` | `#B9DCE6` | Information boundary |
| `tide-100` | `#DCECEF` | Explanatory and visualization surface |
| `tide-50` | `#EFF7F8` | Quiet information background |
| `current-700` | `#1F63AF` | Current roadmap/day text and pressed state |
| `current-600` | `#2D7DD2` | Current roadmap node, today outline, in-progress plan state |
| `current-100` | `#DCEBFC` | Current roadmap/day surface |
| `current-50` | `#EFF6FE` | Quiet current-plan background |
| `sand-700` | `#80551D` | Accessible review/warning text |
| `sand-600` | `#9A6A27` | Review/warning icon and non-text accent |
| `sand-300` | `#DFC99D` | Review/warning boundary |
| `sand-100` | `#F1E7D5` | Review surface |
| `sand-50` | `#F8F3E9` | Quiet reflection background |
| `coral-700` | `#AE4037` | Critical/error text |
| `coral-600` | `#C65349` | Error hover or strong negative state |
| `coral-500` | `#D96B5F` | Error, destructive action, overdue marker |
| `coral-100` | `#F5D7D3` | Error boundary |
| `coral-50` | `#FBEDEC` | Error surface |
| `blue-600` | `#276EA6` | External-link and self-reported practice accent |
| `blue-100` | `#DDECF7` | External-practice surface |

### 5.5 Semantic aliases

Implementation must consume semantic tokens, not raw primitives.

| Semantic token | Value | Use |
|---|---|---|
| `bg-page` | `cloud-50` | Standard page background |
| `bg-surface` | `cloud-0` | Panels, cards, forms |
| `bg-subtle` | `cloud-100` | Muted groups and skeletons |
| `bg-nav` | `ocean-900` | Persistent top-level navigation |
| `bg-selected` | `jade-100` | Light selected state |
| `bg-info` | `tide-50` | Explanation or informational callout |
| `bg-review` | `sand-50` | Review and attention callout |
| `bg-danger` | `coral-50` | Error and destructive confirmation |
| `bg-current-plan` | `current-50` | Active roadmap node and today's scheduled work |
| `text-primary` | `ink-900` | Headings and primary content |
| `text-body` | `ink-700` | Paragraphs and normal controls |
| `text-secondary` | `slate-600` | Metadata and help text |
| `text-disabled` | `slate-400` | Disabled state only |
| `text-on-dark` | `cloud-0` | Text on deep-ocean surfaces |
| `text-link` | `tide-700` | Inline links |
| `border-default` | `slate-200` | Default divisions and outlines |
| `border-strong` | `slate-300` | Focused structural boundary |
| `action-primary` | `jade-600` | Accessible primary-button fill |
| `action-primary-hover` | `jade-700` | Hover |
| `action-primary-pressed` | `jade-800` | Pressed |
| `action-workspace` | `ocean-800` | Commit/save action inside the focused learning workspace |
| `action-workspace-hover` | `ocean-900` | Focused-workspace hover |
| `action-workspace-pressed` | `ocean-950` | Focused-workspace pressed state |
| `state-success` | `jade-500` | Complete or validated |
| `state-info` | `tide-500` | Informational state |
| `state-review` | `sand-700` | Due review or attention text |
| `state-danger` | `coral-500` | Error, overdue, destructive |
| `state-current-plan` | `current-600` | Current roadmap node, current day, in-progress scheduled item |
| `state-external` | `blue-600` | Outbound/self-reported external practice |

### 5.6 Allowed color pairings

- Primary body text: `ink-900` or `ink-700` on `cloud-0`, `cloud-25`, or `cloud-50`.
- Dark navigation: `cloud-0` primary text and muted seafoam/slate text on `ocean-900`.
- Primary button: `cloud-0` text on `jade-600` or darker.
- Focused-workspace primary button: `cloud-0` text on `ocean-800` or darker.
- Current roadmap/day state: `current-700` text or `current-600` non-text accent on `current-50`/`current-100`, paired with an icon and state label.
- Informational text: `ink-800` on `tide-50`.
- Warning/review text: `sand-700` or `ink-800` on `sand-50`.
- Error text: `coral-700` on `coral-50` or `cloud-0`.

All final text/background pairings must be measured before release. Target WCAG 2.2 AA: at least `4.5:1` for normal text and `3:1` for large text and meaningful graphical controls.

### 5.7 Dark theme policy

The approved system is light-first. Do not automatically invert the palette or ship a dark theme from these tokens. A dark theme requires separate surface, border, code-editor, visualizer, and semantic-state evaluation. Until that work is approved, only isolated technical surfaces such as an editor may use a dark treatment, and only if the page preserves visual coherence and accessibility.

---

## 6. Typography

### 6.1 Font stack

These are proposed reproduction typefaces, not identified source fonts from the generated images. The approved appearance is a serif Home greeting, compact readable sans-serif interface, and monospace algorithm/code text. Verify letterforms, weight, wrapping, and density with a specimen against the mockups before finalizing the font files. A named font alone does not prove visual fidelity.

| Role | Typeface | Weight | Rationale |
|---|---|---|---|
| Product UI and body | **Instrument Sans** | 400, 500, 600, 700 | Human, compact, readable, and less generic than common SaaS defaults |
| Reflective display accent | **Fraunces** | 600 | Adds warmth to greetings and reflective moments without entering technical workspaces |
| Code and algorithm state | **JetBrains Mono** | 400, 500, 600 | Clear code glyphs, distinction between similar characters, useful tabular behavior |
| Numeric/data fallback | Instrument Sans with tabular numerals | 500, 600 | Keeps schedules and evidence data aligned without adding another UI font |

Fonts should be self-hosted for production, subset to required scripts, preloaded only when used above the fold, and served with `font-display: swap`.

### 6.2 Usage rules

- Instrument Sans is the default everywhere.
- Fraunces is limited to the home greeting, selected onboarding moments, and optional marketing editorial copy.
- Fraunces must not appear in code, tables, form labels, tabs, workspace headings, or buttons.
- JetBrains Mono is used for code, pseudocode values, array indices, trace values, runtime output, and technical identifiers.
- Enable tabular numerals for time, dates, durations, percentages, counts, and aligned metrics.
- Never use all caps for headings. Small uppercase text is allowed only for rare overlines and must include tracking.

### 6.3 Type scale

| Token | Desktop | Mobile | Line height | Weight | Usage |
|---|---:|---:|---:|---:|---|
| `display` | `40px` | `32px` | `1.10` | 600 | Home greeting only |
| `h1` | `34px` | `28px` | `1.15` | 700 | Page title |
| `h2` | `26px` | `23px` | `1.20` | 700 | Major section title |
| `h3` | `20px` | `19px` | `1.25` | 600 | Panel/feature title |
| `h4` | `17px` | `17px` | `1.30` | 600 | Subsection title |
| `body-lg` | `17px` | `16px` | `1.55` | 400 | Lesson explanation and onboarding |
| `body` | `15px` | `15px` | `1.50` | 400 | Default UI content |
| `body-sm` | `14px` | `14px` | `1.45` | 400 | Supporting text |
| `label` | `13px` | `13px` | `1.30` | 600 | Form labels, tabs, status |
| `meta` | `12px` | `12px` | `1.35` | 500 | Metadata and timestamps |
| `code` | `14px` | `13px` | `1.60` | 400 | Editor and pseudocode |

### 6.4 Line length

- Lesson prose: `58–72ch` maximum.
- Help text: `45–60ch` maximum.
- Dialog body: `50–65ch` maximum.
- Dense table cells may be shorter, but truncated content must remain accessible through expansion or a labeled tooltip.

---

## 7. Spacing, Shape, Border, and Elevation

### 7.1 Base unit

Use a `4px` base unit. All layout spacing should come from this scale.

| Token | Value | Typical use |
|---|---:|---|
| `space-0` | `0` | Reset |
| `space-1` | `4px` | Icon/text micro-gap |
| `space-2` | `8px` | Compact control gap |
| `space-3` | `12px` | Row gap, compact padding |
| `space-4` | `16px` | Default control/panel padding |
| `space-5` | `20px` | Dense panel section spacing |
| `space-6` | `24px` | Standard page/panel rhythm |
| `space-8` | `32px` | Major section gap |
| `space-10` | `40px` | Large block separation |
| `space-12` | `48px` | Page-section separation |
| `space-16` | `64px` | Major editorial spacing |

Do not introduce off-scale values unless required for optical alignment, a one-pixel border, or a third-party editor constraint.

### 7.2 Radius hierarchy

| Token | Value | Usage |
|---|---:|---|
| `radius-xs` | `3px` | Code tokens, tiny swatches |
| `radius-sm` | `6px` | Buttons, fields, tabs, nodes |
| `radius-md` | `8px` | Standard panels and cards |
| `radius-lg` | `12px` | Primary learning modules and dialogs |
| `radius-pill` | `999px` | Status chips, avatars, compact progress only |

Do not use pill shapes for normal buttons, navigation rows, panels, or answer choices.

### 7.3 Borders

- Default border: `1px solid border-default`.
- Strong structural border: `1px solid border-strong`.
- Selected control: `1px solid action-primary` plus a visible focus treatment when focused.
- Dividers are preferred over nested containers when grouping can be expressed through alignment.

### 7.4 Elevation

The product is predominantly flat.

| Token | Treatment | Usage |
|---|---|---|
| `shadow-none` | none | Page panels and most surfaces |
| `shadow-float` | subtle cool shadow, low opacity | Menus, popovers, sticky headers |
| `shadow-dialog` | wider soft shadow | Modal dialogs only |

Never stack multiple shadowed cards. Hierarchy should remain understandable with shadows disabled.

---

## 8. Layout System

### 8.1 Breakpoints

| Name | Width | Behavior |
|---|---:|---|
| `xs` | `320–479px` | Single-column mobile |
| `sm` | `480–767px` | Wide mobile |
| `md` | `768–1023px` | Tablet, collapsed navigation |
| `lg` | `1024–1279px` | Compact desktop |
| `xl` | `1280–1535px` | Standard desktop |
| `2xl` | `1536px+` | Wide desktop, maximum workspace visibility |

### 8.2 Approved top-level shell family

The mockups establish two intentional visual modes within one shared shell structure. Do not flatten them into one treatment.

**Quiet Home shell — Learner Home authority**

- Used for `Today` only.
- Navigation rail: `240px` reference width at the `1536px` mockup canvas.
- Rail surface: `cloud-0`/`cloud-25`, separated by a cool 1px divider.
- Selected Today row: `jade-100` tint with ink label and jade icon.
- Logo: canonical dark cove mark plus ink wordmark.
- Header area may use the approved pale coastal landscape wash.
- Purpose: welcoming, reflective entry into the day's work.

**Deep Journey shell — DSA Roadmap authority**

- Used for Roadmap and may extend to Learn, Practice Journal, Progress, and Settings after each page is visually checked against the brand.
- Navigation rail: `208px` reference width at the `1536px` mockup canvas.
- Rail surface: `ocean-900`, with a darker coastal illustration anchored at the bottom.
- Selected row: lighter ocean/jade surface plus leading jade indicator, icon, and label.
- Logo: canonical first-mockup cove mark recolored for the dark surface; never use the double-wave mark from the generated Roadmap image.
- Purpose: structured movement through a longer learning journey.

**Shared shell measurements**

- Collapsed rail: `72px` when explicitly collapsed or space-constrained.
- Top utility bar: approximately `64px` high.
- Page gutter: `24px` at `lg`, `32px` at `xl` and above.
- Main content max width: `1600px`; center only on screens wider than the max.
- Content preserves a `24–32px` section rhythm.

The difference between the light Home rail and deep Roadmap rail is part of the approved aesthetics. Structure, iconography, typography, logo geometry, spacing rhythm, and interaction behavior keep both modes recognizably AlgoCove.

### 8.3 Focused learning workspace shell

The Guided Problem Workspace removes the persistent left navigation.

- Compact top bar: approximately `48–56px` desktop, `52px` mobile.
- Step rail: approximately `64–70px` desktop; horizontal scroll or compact step selector on smaller screens.
- Reference desktop grid at `1536px`: approximately `320px / minmax(520px, 1fr) / 360px`.
- Bottom workbench dock: approximately `320px` in the approved mockup, user-resizable with a `280px` minimum.
- The left lesson pane continues to the bottom of the viewport. The bottom dock spans only the center and right columns, beginning to the right of the lesson pane, as in the approved image.
- Panels may collapse independently, but the current task and evidence status must remain reachable.

The workspace optimizes attention and horizontal space. Removing the rail is intentional, not a separate brand. Replace the triangular generated mark with the canonical first-mockup logo.

### 8.4 Grid

- Top-level pages use a 12-column content grid.
- Gap: `24px` desktop, `16px` tablet, `12px` mobile.
- Primary content normally spans 8 columns and support content 4 columns.
- Dense learning tools may use explicit pane widths instead of the 12-column grid.
- Align headings, panel edges, table columns, and action rows to common vertical lines.

### 8.5 Mobile navigation

- Use a compact top bar with the logo mark, page title, and essential actions.
- Primary navigation moves into a labeled sheet opened by a standard menu button.
- Do not create a five-item bottom bar if it forces Progress, Journal, or Settings into ambiguous icons.
- Preserve route labels in the navigation sheet.

---

## 9. Navigation and Information Architecture

### 9.1 Primary learner navigation

Use this order:

1. Today
2. Roadmap
3. Learn
4. Practice Journal
5. Progress
6. Settings

In the Quiet Home shell, the selected item uses a pale jade row with ink text and a jade icon. In the Deep Journey shell, it uses a lighter ocean/jade row plus a leading indicator. Both modes use an icon and label; never signal selection by color alone.

### 9.2 Utility navigation

The top utility bar may contain:

- global search;
- learner timezone;
- notification center;
- help/accessibility entry;
- user avatar and account menu.

Do not crowd the bar with page-specific primary actions. Those belong in the page header.

### 9.3 Breadcrumbs

Use breadcrumbs in deep hierarchies:

- `Roadmap / Two Pointers / Pair Sum`
- `Learn / Arrays & Hashing / Hash Map invariant`
- `Practice Journal / LeetCode / Pair Sum`

Do not use breadcrumbs on Today or the top-level Roadmap page.

### 9.4 Page header anatomy

1. Optional breadcrumb or overline.
2. One `h1` page title.
3. One-line supporting context.
4. Status/version metadata when relevant.
5. One primary action at the far end.
6. Up to two secondary actions.

If more actions exist, place them in an overflow menu rather than extending the header indefinitely.

---

## 10. Iconography and Illustration

### 10.1 Icons

- Use **Lucide** as the canonical interface icon family. Custom algorithm-state symbols may be added only when Lucide has no semantically accurate option and must match its optical weight.
- Standard stroke: `1.75–2px` at a `20–24px` icon size.
- Standard sizes: `16px`, `20px`, `24px`.
- Use filled icons only for selected or completed states where shape improves recognition.
- Pair unfamiliar icons with visible labels.
- External practice always uses an outbound/external-link symbol.
- Evidence completion uses check plus text; locked steps use lock plus text.

### 10.2 Product illustration

Purposeful cove landscapes may appear in:

- the navigation rail footer;
- onboarding completion;
- empty states where calm context is valuable;
- a restrained home-header background.

Illustration style:

- simplified layered coastal forms;
- two to four flat marine tones;
- no character mascots;
- no stock-photo realism;
- no animation unless reduced-motion behavior is defined.

Illustrations must never compete with the current learning action.

The approved mockups establish two coastal compositions:

- **Morning Cove:** a very pale, low-contrast mountain-and-water panorama behind the Home greeting. It remains within the upper header band and fades before content begins.
- **Deep Cove:** a darker cliff-and-water scene anchored to the bottom of the Deep Journey rail. It may occupy the lower third of the rail but must not reduce navigation contrast.

These scenes must be recreated as reusable vector or optimized raster assets before UI implementation. Do not substitute stock landscape imagery or regenerate a different coastal scene independently for each page.

### 10.3 Algorithm diagrams

Algorithm visuals use geometry, labels, arrows, and state. They are not decorative illustrations. See Section 15.

---

## 11. Core Components

### 11.1 Buttons

| Variant | Usage |
|---|---|
| Jade primary | Top-level journey action: Continue session from Home, Adjust plan, Start review |
| Deep-ocean workspace primary | Focused learning commitment: Commit prediction, Save revision, Run/submit when it is the current workspace action |
| Secondary | Important alternative: Why this next?, Plan history |
| Ghost | Low-emphasis action in toolbars or rows |
| Destructive | Delete, abandon, or irreversible action after confirmation |
| Link | Inline navigation; never substitute for a primary workflow action |

Rules:

- Default height: `40px`; compact `32px`; large `44px`.
- Horizontal padding: `16px` default, `20px` large.
- Gap between icon and label: `8px`.
- Use sentence case.
- Match the approved context: jade primary on top-level learner pages; deep-ocean primary inside the Guided Problem Workspace.
- Preserve a visible loading label or progress indicator without changing width dramatically.
- Disable only when the reason is visible or immediately discoverable.
- Destructive buttons use coral only when the action is truly destructive.

### 11.2 Icon buttons

- Minimum hit target: `44 × 44px`, even if the visible icon is `20px`.
- Every icon-only button requires an accessible name.
- Tooltips supplement labels but do not replace accessible names.

### 11.3 Inputs and text areas

- Field height: `40px` standard, `44px` on touch-heavy surfaces.
- Visible label above the field.
- Help text below, followed by validation text when needed.
- Required fields use text or an explicit legend, not a red asterisk alone.
- Focus uses a high-contrast outline and border change.
- Error state uses icon, message, and coral boundary; never color alone.
- Long lesson responses support comfortable multiline entry and autosave status.

### 11.4 Selects and language selector

The language selector must always show the full supported set when relevant:

- Python
- JavaScript
- TypeScript
- Java
- C++
- C

Unavailable languages remain visible with an explanation; do not silently substitute another language.

### 11.5 Tabs

- Use tabs for sibling views of the same object.
- Default height: `40px`.
- Active state uses jade underline, stronger text, and appropriate ARIA state.
- Do not use tabs as a substitute for primary navigation.
- When tabs overflow on mobile, use horizontal scrolling with visible edge affordance or a labeled select.

### 11.6 Status chips

Chips are compact metadata, not buttons.

Approved statuses include:

- Complete
- In progress
- Ready
- Locked
- Review due
- Optional
- Learner-confirmed
- Internally observed
- Draft
- Active
- Paused
- Validated

Every chip combines text with an icon or shape when state is important.

### 11.7 Panels

- Standard padding: `20–24px`.
- Dense workbench padding: `12–16px`.
- Use a clear header, optional helper text, and action area.
- Prefer dividers and internal spacing over nesting cards inside cards.
- A primary module may use `radius-lg`; supporting panels use `radius-md`.

### 11.8 Tables and lists

- Tables are for aligned comparison, not general page layout.
- Header text uses `label`; row text uses `body-sm` or `body`.
- Row height: `44px` compact, `52px` comfortable.
- Sticky headers are allowed for long tables.
- Support keyboard row actions and visible focus.
- On narrow screens, convert to labeled rows, not horizontally compressed unreadable tables.

### 11.9 Dialogs and sheets

- Dialog width: `480–640px` for standard decisions.
- Use a sheet for navigation, filters, or contextual details on small screens.
- Move focus into the dialog, trap focus, and restore focus on close.
- The primary decision action appears last in reading order.
- Destructive confirmation copy must name the consequence.

### 11.10 Tooltips and popovers

- Tooltips contain short explanatory text only.
- Popovers may contain controls or structured detail.
- Both must work on keyboard focus, not hover alone.
- Avoid tooltips for essential instructions.

### 11.11 Notifications

| Type | Treatment |
|---|---|
| Inline info | Tide background and info icon |
| Inline review | Sand background and clock/review icon |
| Inline error | Coral background and error icon |
| Toast | Short confirmation for completed reversible actions |
| Banner | System-wide or workflow-blocking condition |

Success toasts disappear automatically only when the information is nonessential. Errors remain until dismissed or resolved.

---

## 12. Interaction States

Every interactive component must specify:

1. Default
2. Hover, where a hover-capable device exists
3. Focus-visible
4. Active/pressed
5. Selected, if applicable
6. Disabled, if applicable
7. Loading, if applicable
8. Success/error, if applicable

### 12.1 Focus treatment

- Use a `2px` focus ring with sufficient contrast and a `2px` offset.
- The ring must remain visible on light, tinted, and deep-ocean surfaces.
- Do not remove focus outlines without an equivalent replacement.

### 12.2 Loading

- Use skeletons for page and panel content.
- Use an inline progress state for code execution, plan generation, and tutor streaming.
- Preserve layout to avoid large shifts.
- Announce meaningful state changes through an appropriate live region.
- If an operation can take more than a few seconds, state what is happening and allow cancellation where safe.

### 12.3 Empty states

An empty state explains:

1. What is empty.
2. Why it may be empty.
3. The next useful action.

Avoid celebratory or apologetic filler. Example: `No reviews are due. Your next review is scheduled for Friday.`

### 12.4 Errors

Distinguish:

- learner code failure;
- compile/type-check failure;
- incorrect output;
- timeout/resource limit;
- unavailable content;
- infrastructure failure;
- network/offline state;
- authorization/session issue.

Do not collapse these into `Something went wrong` when a safer, clearer category is available.

---

## 13. Global Page Patterns

### 13.1 Today / Learner Home

**Purpose:** Recommend one calm next action and provide honest awareness of the learner's day and learning health.

**Desktop structure:**

1. Quiet Home shell with the light rail, canonical dark logo, pale coastal header wash, greeting, and plan-week context.
2. Primary Continue Learning module spanning the full content width.
3. Two-column row: Today's Plan and Review Queue.
4. Full-width Learning Signals section.
5. One short evidence-based insight.

**Continue Learning module must include:**

- pattern and lesson title;
- estimated session duration;
- learner-readable recommendation reason;
- session path: Learn → Plan → Predict → Code → Visualize → Explain;
- one meaningful algorithm preview;
- `Continue session` primary action;
- `Why this next?` secondary action.

**Learning Signals must remain separate:**

- Internal mastery
- External practice
- Plan adherence
- Review health
- Consistency

Never add an overall score above or between these dimensions.

### 13.2 Roadmap

**Purpose:** Show what the learner is building, why the order is valid, and whether the schedule fits their capacity.

**Desktop structure:**

1. Plan title, target, horizon, and preferred languages.
2. Active immutable plan version and history access.
3. Validation strip containing capacity, review spacing, and buffer summary.
4. Prerequisite roadmap across phases.
5. Current-week schedule and capacity meter.
6. Sidebar: Plan Health, Upcoming Reviews, safe replan, Plan Provenance.

**Required roadmap node states:**

- Complete: check icon + complete label.
- Active: Current Blue outline/fill, play/current icon, and active label, matching the approved Two Pointers node.
- Ready: open circle + ready label.
- Locked: lock icon + prerequisite explanation.
- Review due: dotted ring/clock + review label.
- Optional stretch: explicit optional label.

Current Blue is also used for `Today` and `In progress` inside the weekly plan. Jade remains the validated/complete/primary-action color. This distinction shown in the mockup must be preserved.

**Safe replan language:**

Use: `Completed evidence stays. Only future work is rescheduled.`  
Avoid: `You fell behind`, `Catch up now`, or streak-loss messaging.

### 13.3 Learn Library

**Purpose:** Browse concepts, patterns, internal problems, and review material without undermining the recommended path.

**Structure:**

- search and filters by concept, pattern, difficulty, language availability, and state;
- recommended path section first;
- concept/pattern list grouped by prerequisite relationship;
- clear labels for internal content, review items, and external-only references;
- availability labels for all six languages;
- no provider problem content copied into internal cards.

Cards should emphasize what the learner will understand, not only difficulty and completion.

### 13.4 Concept and Pattern Lesson

**Purpose:** Teach recognition cues, invariants, examples, failure modes, and complexity before a problem attempt.

**Structure:**

1. Objective and prerequisites.
2. Recognition cues.
3. Core invariant.
4. Worked example with active checkpoints.
5. Common mistakes.
6. Complexity reasoning.
7. Short concept check.
8. Continue to structured planning.

Reading column should remain within the line-length rules. Supporting diagrams may sit beside the content on desktop and follow it on mobile.

### 13.5 Guided Problem Workspace

**Purpose:** Unite lesson context, structured reasoning, prediction, code, tests, visualization, hints, and readiness evidence.

**Desktop anatomy:**

- Top: compact breadcrumb, timer, save state, exit/resume.
- Step rail: Learn, Plan, Predict, Code, Visualize, Explain.
- Left pane: brief, invariant, examples, prerequisites, bounded hint entry.
- Center pane: current learning activity or active visualizer.
- Right pane: session evidence and tutor/hint context.
- Bottom dock: Pseudocode, Code, Tests, Trace transcript, spanning center and right columns only; the left lesson pane remains full height.

**Step rules:**

- Completed steps remain reviewable.
- A locked step states what is required to unlock it.
- Practice-mode bypass is explicit and recorded.
- Autosave status is visible but quiet.
- Resume returns to the exact meaningful checkpoint.

### 13.6 Practice Handoff

**Purpose:** Make an honest, safe, one-way transition to the original provider.

**Required content:**

- provider name and icon;
- canonical destination title and URL host;
- attribution and last link check;
- readiness state or explicit practice-mode bypass;
- statement that the solve happens outside AlgoCove;
- statement that AlgoCove does not receive credentials or verify submission;
- `Open on LeetCode` or provider-specific primary action;
- cancel/back action.

After return, offer `I completed this externally` with a clear `Learner-confirmed` label. Do not use `Verified`, `Synced`, or equivalent language.

### 13.7 Practice Journal

**Purpose:** Record outbound handoffs, learner-confirmed outcomes, reflections, and scheduled follow-up.

Visually distinguish:

- outbound handoff recorded;
- learner-confirmed completion;
- internal AlgoCove evidence;
- scheduled review or transfer problem.

Use a timeline/list. Avoid totals that imply externally verified solved counts.

### 13.8 Progress

**Purpose:** Explain learning state without collapsing unlike measures.

Use five persistent sections:

1. Internal Mastery
2. External Practice
3. Plan Adherence
4. Review Health
5. Consistency

Each section must show:

- what the measure means;
- evidence source;
- `as of` time;
- policy/version where relevant;
- trend or history;
- next action.

Do not place a single score, ring, or rank above the five dimensions.

### 13.9 Settings and Learner Profile

Organize settings into:

- Goal and target role
- Timezone and weekly capacity
- Preferred languages
- Accessibility and learning preferences
- Notifications
- Privacy, export, and deletion
- Account and session security

Dangerous privacy actions sit in a separate final section and require explicit confirmation. Accessibility settings must be reachable without entering an active session.

### 13.10 Onboarding

Use a short, resumable sequence:

1. Goal and target role
2. Current level or diagnostic choice
3. Plan horizon
4. Available days and session duration
5. Preferred languages
6. Collections/interests
7. Accessibility and learning preferences
8. Review and create baseline

Show progress as steps, not a percentage. Explain why each input affects the plan. Validate capacity before presenting a plan.

### 13.11 Authentication

- Keep the page quiet and brand-led.
- Use the canonical logo on a light surface.
- One clear form and one primary action.
- Do not show decorative product screenshots behind the form if they reduce readability.
- Preserve return-to-session context after successful sign-in when safe.

### 13.12 Content Operations and Administration

Privileged surfaces use the same tokens with a denser layout.

- Display an explicit role label and environment label.
- Use tables for versioned content, provenance, rights, review, publication, and link health.
- Draft, published, quarantined, retired, and rights-blocked states require text and icons.
- Destructive or publishing actions require clear consequence copy and audit context.
- Never make the admin surface look like a learner page merely by hiding actions.

---

## 14. Structured Pseudocode and Code Workspace

### 14.1 Structured pseudocode fields

Always preserve these fields as distinct, versioned sections:

1. Inputs
2. State
3. Initialization
4. Invariant
5. Loop or recurrence rule
6. Termination
7. Output
8. Complexity

The UI may offer a compact table-like form on desktop and stacked sections on mobile. It must not merge pseudocode into executable source.

### 14.2 Revision behavior

- Show `Draft N` or equivalent revision context.
- Show autosave separately from an intentional `Save revision` action.
- Never let tutor output silently overwrite learner text.
- Comparison between revisions should show changed fields and timestamps.

### 14.3 Code editor

Required editor regions:

- file/language header;
- line-number gutter;
- learner source;
- Run and Submit actions with distinct meaning;
- output/diagnostic region;
- limits or runtime metadata where useful;
- visible save/run state.

### 14.4 Diagnostic categories

Render distinct visual and textual states for:

- passed;
- wrong answer;
- compile error;
- type-check error;
- runtime error;
- timeout;
- resource limit;
- cancelled;
- infrastructure failure.

Infrastructure failure must never visually imply learner failure.

### 14.5 Editor theme

The default editor can remain light to match the product. If a dark editor is introduced, it must be an intentional contained surface with its own syntax and contrast specification. Do not switch the entire workspace to dark solely because code is present.

---

## 15. Algorithm Visualization System

### 15.1 Purpose

The visualizer exists to help the learner predict, inspect, manipulate, and explain algorithm state. It is not a decorative animation player.

### 15.2 Renderer principles

- Begin with accessible 2D SVG or semantic HTML where possible.
- Canvas requires a parallel semantic representation.
- Every trace state has a deterministic text transcript.
- Use one renderer-neutral trace protocol.
- Unknown or invalid trace events fail safely.
- Arbitrary learner code that cannot produce a trustworthy trace uses the reviewed reference trace with explicit labeling.

### 15.3 Visual grammar

| Element | Treatment |
|---|---|
| Data cell | Cloud/tide rectangle, 1px border, mono value |
| Active cell | Jade border and labeled marker |
| Compared cell | Tide tint plus comparison label |
| Rejected/excluded region | Muted hatch or lowered emphasis plus text label |
| Pointer | Arrow plus short label such as `L`, `R`, `slow`, `fast` |
| Current expression | Mono text with operands and result |
| Valid transition | Jade connection/annotation |
| Incorrect prediction | Coral feedback only after commit, paired with explanation |
| Target | Sand surface with explicit `Target` label |
| Current trace step | Numbered jade node plus `Current` text |

The approved Pair Sum visual establishes the reference treatment:

- the visual stage uses a very quiet Tide Blue wash rather than a plain white box;
- array indices sit above the cells and values use the mono face;
- `L` is jade and `R` is coral in this specific trace, with visible letter labels so color is never the only distinction;
- the target sits in a Sand panel;
- an over-target result such as `12` uses coral to explain why the state must change;
- the learner chooses from large bordered answer rows before playback becomes available;
- the step timeline remains below the prediction action.

For other algorithms, assign pointer colors from the approved marine/semantic palette, preserve labels, and avoid implying correctness before commitment.

### 15.4 Prediction checkpoint

The prediction state must include:

1. Current data state.
2. Current indices/pointers.
3. Current expression or comparison.
4. One explicit question.
5. Mutually exclusive answers or a structured input.
6. `Commit prediction` action.
7. Playback controls unavailable until commitment when policy requires prediction.

Do not reveal the answer through color, selected-looking defaults, or an animation preview.

### 15.5 Playback controls

- Previous step
- Play/pause
- Next step
- Speed control where useful
- Step count and current step
- Reset
- Text view
- Reduced motion state

All controls must be keyboard operable and labeled.

### 15.6 Text-equivalent view

The Text View presents:

- step number;
- state before;
- event/action;
- state after;
- invariant status;
- explanation;
- current focus/pointer locations.

It is a first-class view, not hidden accessibility metadata.

### 15.7 Reduced motion

When reduced motion is active:

- transition directly between states or use a brief crossfade;
- never animate continuous pointer travel;
- keep the current and next state visually explicit;
- preserve the same evidence and controls.

---

## 16. Evidence, Readiness, Reviews, and Hints

### 16.1 Evidence checklist

Use a vertical checklist with clear status text:

- Concept check
- Pattern recognized
- Invariant explained
- Pseudocode draft
- Prediction
- Tests
- Visualization explain-back
- Optional transfer evidence

States:

- Complete
- Awaiting response
- Not started
- Needs revision
- Not required

Do not display readiness as an unexplained percentage.

### 16.2 Readiness gate

If external practice is locked, state:

- what evidence is still required;
- why the gate exists;
- whether practice-mode bypass is allowed;
- what bypass changes in the evidence record.

The button `View readiness rules` should open a readable policy explanation, not a legalistic system message.

### 16.3 Hint ladder

Hint progression:

1. Clarification
2. Example prompt
3. Invariant prompt
4. Pseudocode scaffold
5. Partial structure
6. Solution review only after the approved gate

The UI shows the current available tier and that hint use is recorded as assistance. It must not shame the learner.

### 16.4 Review queue

Review states:

- Due today: sand
- Upcoming: tide
- Overdue: coral, used sparingly
- Deferred: neutral with reason
- Completed: jade

Show estimated time, reason for review, and next useful action.

---

## 17. Roadmap Design Rules

### 17.1 Phase structure

The roadmap supports named phases such as:

- Foundations
- Core Patterns
- Trees and Graphs
- Interview Transfer

Phase names and lengths are product data. The design must support other validated plans without changing the visual grammar.

### 17.2 Prerequisite lines

- Use solid lines for required prerequisite flow.
- Use dotted lines for review/transfer relationships.
- Use labeled connections where the relationship is not obvious.
- Avoid line crossings where possible.
- On mobile, replace the wide graph with a nested ordered path and explicit prerequisite text.

### 17.3 Capacity

Display:

- planned minutes;
- available minutes;
- buffer minutes;
- review load;
- optional stretch work.

Do not fill all available capacity by default. Buffer is a visible part of the plan.

### 17.4 Plan provenance

Show:

- baseline scheduler type;
- whether AI sequencing/explanation was used;
- validation policy version;
- plan version;
- acceptance date;
- reason/change history.

The deterministic validator is the authority. AI is described as sequencing or explanation assistance.

---

## 18. Content and Voice

### 18.1 Voice attributes

- Calm
- Direct
- Respectful
- Precise
- Encouraging without hype
- Honest about evidence and uncertainty

### 18.2 Preferred language

Use:

- `Your next useful step is ready.`
- `Why this next?`
- `Think about which pointer can reduce the sum.`
- `Hints are recorded as assistance.`
- `Completed evidence stays. Only future work is rescheduled.`
- `Learner-confirmed external practice`
- `You can resume from this step.`

Avoid:

- `Crush your goals!`
- `You're falling behind.`
- `Mastered` when the evidence policy does not support it.
- `Verified on LeetCode`.
- `AI-powered` as a primary product claim.
- `Easy`, `obvious`, or language that trivializes learner difficulty.

### 18.3 Labels

- Use sentence case.
- Prefer verbs for actions: `Continue session`, `Commit prediction`, `Preview a replan`.
- Prefer nouns for destinations: `Roadmap`, `Practice Journal`, `Progress`.
- Keep button labels stable across pages.

---

## 19. Motion

### 19.1 Motion principles

Motion explains causality or preserves orientation. It does not decorate completion.

### 19.2 Durations

| Token | Duration | Usage |
|---|---:|---|
| `motion-micro` | `80ms` | Pressed/hover feedback |
| `motion-short` | `160ms` | Menus, tooltips, selection |
| `motion-medium` | `240ms` | Panel transitions, step state change |
| `motion-trace` | `320ms` | Algorithm-state transition when motion is enabled |
| `motion-long` | `480ms` | Rare page-level orientation transition |

### 19.3 Easing

- Enter: ease-out.
- Exit: ease-in.
- Move/reorder: ease-in-out.
- Algorithm state: consistent ease-in-out with no overshoot or bounce.

### 19.4 Prohibited motion

- continuous logo animation;
- background parallax in the application;
- confetti for normal completion;
- bouncing calls to action;
- animated charts that replay every page load;
- state changes that depend on motion alone.

---

## 20. Accessibility Requirements

Target WCAG 2.2 AA for the complete learner journey.

### 20.1 Keyboard

- Every interactive control is reachable and operable by keyboard.
- Focus order follows visual and task order.
- Skip links reach primary content and major workspace panes.
- The visualizer supports step navigation and prediction without a pointer device.
- Resizable panes offer keyboard-accessible alternatives or preset sizes.

### 20.2 Screen readers

- One `h1` per page and logical heading levels.
- Regions have meaningful names.
- Status updates use appropriate live-region behavior.
- Charts and visualizations expose summaries and structured text states.
- Icon-only buttons have accessible names.
- Locked states explain the requirement, not only `disabled`.

### 20.3 Color and contrast

- Test all specified pairings rather than assuming token names guarantee contrast.
- Do not rely on jade/coral alone for correct/incorrect.
- Links are distinguishable without color alone.
- Focus indicators meet graphical contrast requirements.

### 20.4 Zoom and reflow

- Support `200%` browser zoom without loss of functionality.
- Critical content must reflow at narrow widths.
- Avoid fixed-height lesson or evidence panels that clip content.
- Code and trace tables may scroll within a labeled region when reflow is impractical.

### 20.5 Cognitive accessibility

- One primary action per major region.
- Explain locked steps and validation failures in plain language.
- Preserve user work.
- Avoid surprise navigation.
- Allow sessions to pause and resume.
- Provide reduced motion and text view in the same context as the visualization.

---

## 21. Responsive Behavior

### 21.1 Top-level pages

**Desktop (`lg+`)**

- The page's approved rail remains visible: light on Home, deep ocean on Roadmap.
- Main content uses 12 columns.
- Supporting panels sit beside primary content.

**Tablet (`md`)**

- Rail collapses to icons or moves into a sheet.
- Two-column regions become 7/5 or stacked depending on content priority.
- Page actions remain visible in a compact header.

**Mobile (`xs–sm`)**

- Single-column layout.
- Primary action remains near the relevant content, not fixed over it.
- Tables become labeled lists.
- Roadmap becomes an ordered prerequisite path.
- Learning Signals remain five separate sections.

### 21.2 Guided workspace

**Desktop (`xl+`)**

- Three panes plus bottom dock.

**Compact desktop/tablet landscape (`md–lg`)**

- Lesson pane becomes a collapsible drawer.
- Evidence pane becomes a persistent tab or right sheet.
- Center task stays primary.

**Mobile portrait**

- Use one task surface at a time.
- A compact sticky step header exposes Learn, Plan, Predict, Code, Visualize, Explain.
- Context and evidence open as labeled sheets.
- Pseudocode/code/tests/trace remain sibling tabs.
- Preserve drafts when switching views.

### 21.3 Minimum target widths

Design and verify at:

- `320px`
- `768px`
- `1024px`
- `1440px`
- `1536px` and wider

---

## 22. Data Visualization and Progress Reporting

### 22.1 General rules

- Every chart starts with a learner question or decision it supports.
- Always include units, time range, source/evidence type, and `as of` time.
- Use direct labels where possible.
- Keep series counts low.
- Pair color with line style, symbol, label, or pattern.
- Avoid 3D charts, gauges, and decorative donuts.

### 22.2 Appropriate forms

| Need | Preferred form |
|---|---|
| Consistency | Small calendar/day strip |
| Review workload | Count plus ordered list by due window |
| Mastery history | Evidence timeline or concept trend |
| Plan adherence | Planned vs completed by due window |
| External practice | Labeled journal count and timeline |
| Roadmap prerequisites | Node path/graph on desktop, ordered nested list on mobile |

### 22.3 Misleading forms to avoid

- combined mastery + activity score;
- externally verified-looking solved count;
- giant progress ring without criteria;
- speed ranking that rewards rushing;
- streak visualization that obscures pause or grace policies.

---

## 23. Design Tokens and Implementation Contract

When implementation begins, tokens should be represented once and consumed through semantic aliases.

Minimum token groups:

- primitive color;
- semantic color;
- typography family, size, weight, line height, tracking;
- spacing;
- radius;
- border width;
- elevation;
- motion duration and easing;
- layout widths and breakpoints;
- z-index layers.

Suggested z-index order:

| Layer | Purpose |
|---:|---|
| `0` | Page content |
| `10` | Sticky panel/header |
| `20` | Dropdown/popover |
| `30` | Navigation sheet |
| `40` | Modal backdrop |
| `50` | Modal/dialog |
| `60` | Toast/live announcement |

Raw hex values and arbitrary spacing must not be scattered through components. Exceptions require a documented reason.

---

## 24. Design Implementation Prerequisites

This section is the design gate for future UI implementation. A prerequisite is not complete merely because it is described. Asset creation, responsive approval, and validation evidence remain separate deliverables.

### 24.1 Gate status

`DESIGN SPECIFICATION READY — PRODUCTION ASSET AND VALIDATION PREREQUISITES OPEN`

The approved brand direction is fixed. The table distinguishes documentary decisions from assets and verification still to be produced. These items are sequenced in Section 24.3; runtime checks and token implementation are completed during the relevant authorized build slice, not demanded as completed code before coding begins.

### 24.2 Required prerequisites

| ID | Prerequisite | Priority | Current status | Completion evidence |
|---|---|---|---|---|
| D-01 | Three approved reference mockups preserved under stable names | Critical | Complete | Artifact paths and SHA-256 values in Section 1.5 |
| D-02 | Visual-authority rule established | Critical | Complete | Mockups govern aesthetics; this document governs behavior and accessibility |
| D-03 | Canonical logo direction selected | Critical | Complete | First-mockup cove-and-angle-brackets mark; later generated marks rejected |
| D-04 | Production logo asset set | Critical | Open | Human-reviewed SVG; light/dark/monochrome lockups; favicon exports at 16/24/32px; visual comparison against Learner Home reference |
| D-05 | Typography roles and scale | Critical | Proposed reproduction specification | Candidate font roles and sizes documented; actual appearance still requires specimen comparison |
| D-06 | Production font delivery | Critical | Open | License/provenance recorded; self-hosted WOFF2 subsets; preload and fallback behavior verified; no layout-breaking font swap |
| D-07 | Color primitives and semantic roles | Critical | Complete as specification | Home/Journey/workspace/current/external/error/review roles documented |
| D-08 | Color and contrast validation | Critical | Open | Measured WCAG 2.2 AA matrix for all text, controls, focus rings, visualizer states, and disabled states; approved accessibility corrections remain visually faithful |
| D-09 | Canonical icon system | Critical | Proposed reproduction specification | Lucide selected as an implementation candidate; compare actual icon glyphs and weight with the references |
| D-10 | Coastal illustration asset set | High | Open | Morning Cove and Deep Cove exported as optimized responsive assets and compared with their reference mockups |
| D-11 | Desktop shell measurements | Critical | Approximate reference specification | Reference widths documented; rendered overlay comparison remains required |
| D-12 | Responsive screen approval | Critical | Open | Approved 320px, 768px, and 1024px mockups for Home, Workspace, and Roadmap; overflow and pane-collapse decisions recorded |
| D-13 | Core component state matrix | Critical | Complete as specification | Default, hover, focus, pressed, selected, disabled, loading, success, and error requirements documented |
| D-14 | Design-token source | Critical | Open for implementation | One generated token source representing the primitives and aliases in this document; no raw scattered values |
| D-15 | Visualization visual grammar | Critical | Complete as specification | Pair Sum treatment, pointer labels, prediction gate, target, result, timeline, text view, and reduced motion documented |
| D-16 | Trace and visualization fixtures | Critical | Open | Deterministic array/two-pointer trace fixtures with matching visual snapshots and text transcripts |
| D-17 | Code/pseudocode editor behavior | Critical | Complete as specification | Structured pseudocode, revision, language, diagnostic, run, and submit behaviors documented |
| D-18 | Content terminology and state labels | High | Complete as specification | Learner-confirmed, internally observed, validated, locked, ready, review due, and infrastructure failure language fixed |
| D-19 | Unmocked page validation | High | Open | Wireframes/mockups approved for onboarding, Learn Library, Practice Handoff, Journal, Progress, Settings, authentication, and privileged operations before those pages are built |
| D-20 | Accessibility interaction prototypes | Critical | Open | Keyboard order, focus movement, screen-reader names, live updates, zoom/reflow, reduced motion, and text-equivalent visualizer manually reviewed |
| D-21 | Design QA baseline | Critical | Open | Screenshot baselines for approved desktop and responsive states plus a page-by-page review checklist |

### 24.3 Prerequisite execution order

| Stage | Required work | Exit condition |
|---|---|---|
| Design asset preparation | D-04 logo recreation; D-05/D-06 font specimens and licensing; D-09 icon specimens; D-10 coastal artwork | Reference comparisons establish faithful production assets, with the first Home logo preserved |
| Screen detailing | D-12 responsive compositions; D-13 actual state sheets; D-19 page-specific layouts for the next page being built | Layout, reading order, controls, and state behavior are specified for the scoped page |
| Authorized UI foundation | D-14 shared tokens and font loading; implement components with D-08 contrast checks | Reusable components match the approved appearance and have measured usable states |
| Learning visualizer slice | D-16 deterministic trace/text fixtures; implement D-15 grammar and prediction behavior | One original learning problem has matching trace, text, and rendered states |
| Acceptance of each page | D-20 keyboard/reflow/screen-reader checks; D-21 screenshot comparison | Visual fidelity and interaction evidence pass for that page |

The applicable architecture and implementation phase gates remain unchanged. This document does not authorize application code. Requiring runtime evidence before implementation would be circular; it is instead required before accepting the implemented slice. Unrelated future pages do not block the next approved page.

### 24.4 Fidelity review method

For each implemented reference page:

1. Render at the approved `1536 × 1024` reference viewport.
2. Compare side-by-side with the stable mockup artifact.
3. Check shell mode, logo, type hierarchy, panel boundaries, color roles, icon weight, illustration placement, and primary-action treatment.
4. Overlay screenshots when practical to find alignment drift.
5. Record intentional accessibility differences.
6. Verify responsive states separately rather than scaling the desktop composition.
7. Accept the page only when both visual fidelity and accessibility checks pass.

### 24.5 Brand invariants that cannot be negotiated during implementation

- The first-mockup cove-and-angle-brackets logo is used everywhere.
- Home retains the light Quiet Home shell.
- Roadmap retains the deep-ocean Journey shell.
- The Guided Problem Workspace retains its rail-free focused composition.
- Current Blue remains distinct from Jade completion and External Blue.
- The Pair Sum visualizer preserves the prediction-first, text-equivalent interaction model.
- Coastal imagery remains quiet, flat, and product-specific.
- Progress dimensions remain separate.
- External practice remains visibly learner-confirmed.
- No generic purple-gradient, glass, card-grid, or gamified replacement is acceptable.

---

## 25. Design Review Checklist

Before a page or component is accepted, verify:

### Brand and hierarchy

- [ ] Canonical cove-and-angle-brackets logo is used correctly.
- [ ] Page uses the correct shell variant.
- [ ] One clear `h1` exists.
- [ ] One primary action is visually dominant.
- [ ] Color follows semantic rules.
- [ ] Panel nesting and rounding are restrained.

### Product integrity

- [ ] Evidence is not replaced by confidence, XP, or a blended score.
- [ ] External practice is labeled learner-confirmed where applicable.
- [ ] AI assistance is not presented as policy authority.
- [ ] Locked steps explain why they are locked.
- [ ] Missed work is handled without punishment language.
- [ ] All six languages are represented honestly where language availability matters.

### Interaction

- [ ] Default, hover, focus, active, disabled, loading, and error states exist as needed.
- [ ] Keyboard interaction follows task order.
- [ ] Loading preserves layout and communicates progress.
- [ ] Empty and error states offer a useful next action.
- [ ] Autosave and intentional revision save are not confused.

### Visualization

- [ ] Prediction precedes playback where required.
- [ ] The visual state has a useful text equivalent.
- [ ] Reduced-motion behavior exists.
- [ ] Pointer, state, comparison, and transition are labeled.
- [ ] Color is not the sole state signal.

### Responsive and accessible

- [ ] Verified at `320`, `768`, `1024`, and `1440px` widths.
- [ ] Verified at `200%` zoom.
- [ ] Text contrast and non-text contrast are measured.
- [ ] Focus is visible.
- [ ] Screen-reader structure and status announcements are tested.
- [ ] Touch targets meet the minimum size.

---

## 26. Reference Screen Blueprints

These blueprints translate the approved mockups into stable composition rules.

### 26.1 Learner Home blueprint

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Light Home navigation │ Utility bar: search · timezone · alerts · profile │
│                        ├───────────────────────────────────────────────────┤
│ Today                  │ Greeting                          Week N of N      │
│ Roadmap                ├───────────────────────────────────────────────────┤
│ Learn                  │ Continue Learning + algorithm preview             │
│ Practice Journal       ├───────────────────────────┬───────────────────────┤
│ Progress               │ Today's Plan              │ Review Queue          │
│                        ├───────────────────────────┴───────────────────────┤
│ Settings               │ Five separate Learning Signals                    │
└────────────────────────────────────────────────────────────────────────────┘
```

### 26.2 Guided Problem Workspace blueprint

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Logo · breadcrumb                         timer · saved · exit/resume       │
├────────────────────────────────────────────────────────────────────────────┤
│ Learn ─ Plan ─ Predict ─ Code ─ Visualize ─ Explain                        │
├──────────────────┬─────────────────────────────────┬───────────────────────┤
│ Lesson/context   │ Current task / active visualizer│ Session evidence      │
│ Invariant        │ Prediction and playback         │ Readiness + tutor     │
│ Prerequisites    │                                 │                       │
│ Bounded hints    │                                 │                       │
│                  ├─────────────────────────────────┴───────────────────────┤
│ Lesson continues │ Pseudocode · Code · Tests · Trace transcript             │
└────────────────────────────────────────────────────────────────────────────┘
```

### 26.3 Roadmap blueprint

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Deep-ocean navigation │ Title · plan version · history · adjust plan       │
│                        ├───────────────────────────────────────────────────┤
│                        │ Validated capacity/review/buffer strip             │
│                        ├────────────────────────────────┬──────────────────┤
│                        │ Prerequisite phase roadmap     │ Plan Health      │
│                        │                                │ Reviews          │
│                        ├────────────────────────────────┤ Safe Replan      │
│                        │ This Week + capacity + buffer  │ Provenance       │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 27. Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-17 | Adopt the final three DSA mockups as the approved visual direction | They represent the actual guided DSA product rather than the rejected market-strategy concept |
| 2026-09-17 | Use the first DSA mockup's cove-and-angle-brackets logo as the canonical mark | It combines the product name, coding, and the cove metaphor in one memorable symbol |
| 2026-09-17 | Preserve the light Home shell and deep-ocean Journey shell | These are intentional approved modes, not an inconsistency to flatten |
| 2026-09-17 | Remove the side rail in the Guided Problem Workspace | Protects space and focus for prediction, code, visualization, and evidence |
| 2026-09-17 | Specify Instrument Sans, Fraunces, and JetBrains Mono as reproduction candidates | Preserves interface, reflective, and technical roles; exact visual matching still requires font specimens |
| 2026-09-17 | Keep the canonical theme light-first | Matches the approved mockups and prevents an unvalidated automatic dark-mode inversion |
| 2026-09-17 | Keep progress dimensions separate | Preserves AlgoCove's product rule that activity, mastery, external practice, reviews, and consistency are not interchangeable |
| 2026-09-17 | Make visualization prediction-first with a text-equivalent state | Aligns the UI with active learning and accessibility requirements |
| 2026-09-17 | Preserve Current Blue for roadmap/today and Deep Ocean for workspace commits | Matches the approved mockups while keeping Jade for completion and top-level primary actions |
| 2026-09-17 | Preserve immutable mockups in the local AlgoCove design-artifact store | Prevents future implementation from relying on temporary generated-image paths or prose alone |

---

## 28. Governance

### 28.1 Source-of-truth rule

Read this document before making any visual or UI decision. A new component or page should first reuse an existing token, pattern, or blueprint.

### 28.2 Changes requiring explicit design approval

- Logo geometry or lockup changes.
- New brand colors or typography.
- Dark theme.
- New navigation model.
- Changes to the learning-step sequence.
- A new readiness or progress visualization.
- New gamification mechanics.
- 3D visualization.
- Any UI implying automatic external-provider verification.

### 28.3 Extension process

For a new pattern:

1. State the user need and affected journey.
2. Identify why existing patterns cannot solve it.
3. Define states, accessibility behavior, and responsive behavior.
4. Test it alongside the three reference screen families.
5. Add the approved rule to this document before broad reuse.

### 28.4 Current boundary

This design plan is detailed enough to guide future UI implementation, but it does not claim that components, contrast measurements, responsive behavior, keyboard behavior, or runtime states have been implemented or validated. Those require later implementation and verification under the approved architecture and phase gates.
