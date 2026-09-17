# Phase 1 design-token and page-shell checklist

**Status:** Phase 1 foundation evidence; full product screens remain later-phase work.  
**Source of truth:** [DESIGN.md](../../DESIGN.md) and the approved mockup registry in its Section 1.5.  
**Implementation source:** `apps/web/src/styles/tokens.ts` → generated `tokens.css` → Tailwind `@theme inline` aliases in `apps/web/app/globals.css`.

This checklist makes the three approved screen references traceable without pretending that future screens or unavailable production assets already exist.

## Shared implementation contract

| Contract | Evidence | Status |
| --- | --- | --- |
| Semantic color aliases | Generated CSS variables consumed through Tailwind `cove-*` utilities | Implemented |
| Typography roles | UI, display, and monospace font aliases plus semantic text utilities | Implemented |
| Spacing, radius, and focus tokens | Generated variables and Tailwind aliases; focus ring on interactive shell controls | Implemented |
| Reduced motion | `prefers-reduced-motion` resets page scroll behavior | Implemented |
| Asset provenance | Approved mockup paths and checksums remain in `DESIGN.md`; no raster asset is copied into production | Tracked |

## Approved screen references

| Reference | Phase 1 shell contract | Component/token checklist | Status |
| --- | --- | --- | --- |
| Learner Home | Quiet Home shell, light surface, canonical mark treatment, calm next action, semantic text hierarchy | `bg-cove-page`, `bg-cove-surface`, `bg-cove-action-primary`, `font-cove-display`, `text-cove-*`, focus ring, skip link | Implemented and browser-tested |
| Guided Problem Workspace | Focused shell boundary, deep-ocean treatment, step rail, panes, editor/visualizer surfaces | Deep shell surface aliases, workspace action aliases, code/editor tokens, keyboard pane contract | Token-ready; screen deferred to Phase 5 |
| DSA Roadmap | Deep Journey shell, prerequisite path, current-plan state, capacity and provenance labels | Deep shell surface aliases, current-plan semantic aliases, status labels/icons, responsive ordered path | Token-ready; screen deferred to Phase 7 |

## Explicitly open assets and evidence

- The logo, font specimens/licensing, Lucide comparison, and coastal illustrations remain open design prerequisites. The implementation uses the documented token and text fallbacks; it does not silently claim those production assets exist.
- Desktop, 768px, 1024px, and 1440px visual comparison against the approved mockups remains a visual-review task. Automated Phase 1 coverage proves the Home shell at 320px, keyboard navigation, reduced motion, and axe-detectable violations only.
- Workspace and Roadmap screenshot approval is intentionally deferred until their feature phases introduce real screens and data states.
