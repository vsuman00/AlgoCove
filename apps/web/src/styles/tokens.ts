/**
 * AlgoCove design tokens.
 *
 * This module is the single source of truth for the approved design system in
 * DESIGN.md. `tokens.css` is generated from it (`pnpm tokens:build`) and a test
 * fails when the two drift, so a value can never be edited in the stylesheet
 * without passing through this file.
 *
 * Two conventions matter:
 *
 * 1. Components consume *semantic* aliases (`bg-surface`, `action-primary`), not
 *    raw primitives. A stage that needs a primitive directly is a signal that a
 *    semantic alias is missing.
 * 2. Tokens carry the meaning stated in DESIGN.md section 5. Color is never used
 *    as decoration, and every semantic color also has a text or icon counterpart
 *    so state is never communicated by color alone.
 */

/** Brand primitives: deep ocean and jade. */
export const BRAND_COLORS = {
  "ocean-950": "#082F35",
  "ocean-900": "#0B3B42",
  "ocean-800": "#123F46",
  "ocean-700": "#18565D",
  "ocean-600": "#247079",
  "jade-800": "#0C5C4E",
  "jade-700": "#0F6F5E",
  "jade-600": "#147E69",
  "jade-500": "#1A8F78",
  "jade-400": "#42A991",
  "jade-200": "#A9DED2",
  "jade-100": "#DDF2ED",
  "jade-50": "#EEF8F5",
} as const;

/** Neutral and surface primitives. */
export const NEUTRAL_COLORS = {
  "cloud-0": "#FFFFFF",
  "cloud-25": "#FBFCFB",
  "cloud-50": "#F6F8F7",
  "cloud-100": "#EEF3F1",
  "slate-200": "#DCE6E3",
  "slate-300": "#C8D6D3",
  "slate-400": "#99ABA8",
  "slate-500": "#6E8280",
  "slate-600": "#536966",
  "ink-700": "#294146",
  "ink-800": "#1B3338",
  "ink-900": "#102A2E",
  "ink-950": "#081D21",
} as const;

/** Supporting and semantic primitives: tide, current, sand, coral, external blue. */
export const SUPPORTING_COLORS = {
  "tide-700": "#225E78",
  "tide-500": "#3C8FAD",
  "tide-200": "#B9DCE6",
  "tide-100": "#DCECEF",
  "tide-50": "#EFF7F8",
  "current-700": "#1F63AF",
  "current-600": "#2D7DD2",
  "current-100": "#DCEBFC",
  "current-50": "#EFF6FE",
  "sand-700": "#80551D",
  "sand-600": "#9A6A27",
  "sand-300": "#DFC99D",
  "sand-100": "#F1E7D5",
  "sand-50": "#F8F3E9",
  "coral-700": "#AE4037",
  "coral-600": "#C65349",
  "coral-500": "#D96B5F",
  "coral-100": "#F5D7D3",
  "coral-50": "#FBEDEC",
  "blue-600": "#276EA6",
  "blue-100": "#DDECF7",
} as const;

export const PRIMITIVE_COLORS = {
  ...BRAND_COLORS,
  ...NEUTRAL_COLORS,
  ...SUPPORTING_COLORS,
} as const;

export type PrimitiveColorToken = keyof typeof PRIMITIVE_COLORS;

/**
 * Semantic aliases. Components must use these names.
 * Aliases are expressed as primitive tokens so the indirection stays visible and
 * a palette change cannot bypass the semantic layer.
 */
export const SEMANTIC_COLOR_ALIASES = {
  "bg-page": "cloud-50",
  "bg-surface": "cloud-0",
  "bg-subtle": "cloud-100",
  "bg-nav": "ocean-900",
  "bg-selected": "jade-100",
  "bg-info": "tide-50",
  "bg-review": "sand-50",
  "bg-danger": "coral-50",
  "bg-current-plan": "current-50",
  "bg-external-practice": "blue-100",
  "text-primary": "ink-900",
  "text-body": "ink-700",
  "text-secondary": "slate-600",
  "text-disabled": "slate-400",
  "text-on-dark": "cloud-0",
  "text-link": "tide-700",
  "border-default": "slate-200",
  "border-strong": "slate-300",
  "action-primary": "jade-600",
  "action-primary-hover": "jade-700",
  "action-primary-pressed": "jade-800",
  "action-workspace": "ocean-800",
  "action-workspace-hover": "ocean-900",
  "action-workspace-pressed": "ocean-950",
  "state-success": "jade-500",
  "state-info": "tide-500",
  "state-review": "sand-700",
  "state-danger": "coral-500",
  "state-current-plan": "current-600",
  "state-external": "blue-600",
} as const;

export type SemanticColorToken = keyof typeof SEMANTIC_COLOR_ALIASES;

/** Resolve a semantic alias to its hex value. */
export function resolveSemanticColor(token: SemanticColorToken): string {
  return PRIMITIVE_COLORS[SEMANTIC_COLOR_ALIASES[token]];
}
// ---------------------------------------------------------------------------
// Spacing, shape, elevation
// ---------------------------------------------------------------------------

/** 4px base unit; off-scale values are not permitted. */
export const SPACING = {
  "space-0": "0",
  "space-1": "4px",
  "space-2": "8px",
  "space-3": "12px",
  "space-4": "16px",
  "space-5": "20px",
  "space-6": "24px",
  "space-8": "32px",
  "space-10": "40px",
  "space-12": "48px",
  "space-16": "64px",
} as const;

export type SpacingToken = keyof typeof SPACING;

export const RADII = {
  "radius-xs": "3px",
  "radius-sm": "6px",
  "radius-md": "8px",
  "radius-lg": "12px",
  "radius-pill": "999px",
} as const;

export type RadiusToken = keyof typeof RADII;

/**
 * Elevation. The product is predominantly flat; shadows are reserved for
 * floating surfaces and dialogs, and hierarchy must survive with them disabled.
 */
export const ELEVATION = {
  "shadow-none": "none",
  "shadow-float": "0 4px 12px rgba(8, 29, 33, 0.08)",
  "shadow-dialog": "0 16px 40px rgba(8, 29, 33, 0.16)",
} as const;

export type ElevationToken = keyof typeof ELEVATION;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

/**
 * Font families.
 *
 * The approved typefaces are Instrument Sans, Fraunces, and JetBrains Mono. The
 * font binaries are not part of this repository yet, so the stacks name the
 * approved family first and fall back to system faces. `MISSING_DESIGN_ASSETS`
 * records that gap explicitly instead of pretending the asset exists.
 */
export const FONT_FAMILIES = {
  ui: '"Instrument Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  display: '"Fraunces", ui-serif, Georgia, "Times New Roman", serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
} as const;

export type FontFamilyToken = keyof typeof FONT_FAMILIES;

/** Type scale: size, line height, weight per DESIGN.md section 6.3. */
export const TYPE_SCALE = {
  display: { desktop: "40px", mobile: "32px", lineHeight: "1.1", weight: 600, family: "display" },
  h1: { desktop: "34px", mobile: "28px", lineHeight: "1.15", weight: 700, family: "ui" },
  h2: { desktop: "26px", mobile: "23px", lineHeight: "1.2", weight: 700, family: "ui" },
  h3: { desktop: "20px", mobile: "19px", lineHeight: "1.25", weight: 600, family: "ui" },
  h4: { desktop: "17px", mobile: "17px", lineHeight: "1.3", weight: 600, family: "ui" },
  "body-lg": { desktop: "17px", mobile: "16px", lineHeight: "1.55", weight: 400, family: "ui" },
  body: { desktop: "15px", mobile: "15px", lineHeight: "1.5", weight: 400, family: "ui" },
  "body-sm": { desktop: "14px", mobile: "14px", lineHeight: "1.45", weight: 400, family: "ui" },
  label: { desktop: "13px", mobile: "13px", lineHeight: "1.3", weight: 600, family: "ui" },
  meta: { desktop: "12px", mobile: "12px", lineHeight: "1.35", weight: 500, family: "ui" },
  code: { desktop: "14px", mobile: "13px", lineHeight: "1.6", weight: 400, family: "mono" },
} as const;

export type TypeScaleToken = keyof typeof TYPE_SCALE;

/** Maximum prose line length, in `ch`, per DESIGN.md section 6.4. */
export const LINE_LENGTH = {
  lesson: "68ch",
  help: "55ch",
  dialog: "60ch",
} as const;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export const BREAKPOINTS = {
  xs: "320px",
  sm: "480px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;

export type BreakpointToken = keyof typeof BREAKPOINTS;

/**
 * Approved shell families. Two shells exist on purpose: the quiet light Home
 * rail and the deep-journey rail. They share geometry and interaction rules but
 * differ in surface, which is part of the approved aesthetics.
 */
export const SHELLS = {
  "quiet-home": {
    railWidth: "240px",
    railCollapsedWidth: "72px",
    railSurface: "cloud-0",
    railBorder: "slate-200",
    selectedSurface: "jade-100",
    selectedText: "ink-900",
    selectedIndicator: "jade-500",
    useFor: ["/"],
  },
  "deep-journey": {
    railWidth: "208px",
    railCollapsedWidth: "72px",
    railSurface: "ocean-900",
    railBorder: "ocean-800",
    selectedSurface: "ocean-700",
    selectedText: "cloud-0",
    selectedIndicator: "jade-400",
    useFor: ["/roadmap", "/learn", "/practice-journal", "/progress", "/settings"],
  },
} as const;

export type ShellName = keyof typeof SHELLS;

export const SHELL_MEASUREMENTS = {
  utilityBarHeight: "64px",
  workspaceTopBarHeight: "52px",
  workspaceStepRailWidth: "70px",
  pageGutterLg: "24px",
  pageGutterXl: "32px",
  contentMaxWidth: "1600px",
  focusRingWidth: "2px",
  focusRingOffset: "2px",
} as const;
/** Focus treatment: 2px ring with 2px offset, visible on every approved surface. */
export const FOCUS_RING = {
  width: SHELL_MEASUREMENTS.focusRingWidth,
  offset: SHELL_MEASUREMENTS.focusRingOffset,
  color: PRIMITIVE_COLORS["current-700"],
} as const;

// ---------------------------------------------------------------------------
// Missing approved assets
// ---------------------------------------------------------------------------

/**
 * Approved design assets that are not present in this repository.
 *
 * Task 6a requires missing assets to be tracked rather than silently substituted.
 * The accessibility test asserts this list is surfaced, and each entry states the
 * fallback in use so a reviewer can judge the gap.
 */
export const MISSING_DESIGN_ASSETS = [
  {
    asset: "Instrument Sans font files",
    approvedSource: "DESIGN.md section 6.1",
    fallbackInUse: "System sans-serif stack",
  },
  {
    asset: "Fraunces font files",
    approvedSource: "DESIGN.md section 6.1",
    fallbackInUse: "System serif stack, limited to the Home greeting",
  },
  {
    asset: "JetBrains Mono font files",
    approvedSource: "DESIGN.md section 6.1",
    fallbackInUse: "System monospace stack for code and trace values",
  },
  {
    asset: "Canonical cove logo, light and dark variants",
    approvedSource: "DESIGN.md sections 4.1 to 4.6",
    fallbackInUse: "Typographic wordmark; no substitute mark is drawn",
  },
  {
    asset: "Coastal illustration washes for both shells",
    approvedSource: "DESIGN.md sections 8.2 and 10.2",
    fallbackInUse: "Flat tinted surface without imagery",
  },
] as const;

export type MissingDesignAsset = (typeof MISSING_DESIGN_ASSETS)[number];
