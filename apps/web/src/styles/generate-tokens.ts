/**
 * Generate the CSS custom properties from `tokens.ts`.
 *
 * Usage:
 *   node apps/web/src/styles/generate-tokens.ts          # write the stylesheet
 *   node apps/web/src/styles/generate-tokens.ts --check  # fail when it drifted
 *
 * The generated file is committed so a reviewer can read the CSS that ships, and
 * the check mode is wired into `pnpm verify`, so editing the stylesheet by hand
 * fails the build instead of drifting from the approved tokens.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BREAKPOINTS,
  ELEVATION,
  FOCUS_RING,
  FONT_FAMILIES,
  LINE_LENGTH,
  MISSING_DESIGN_ASSETS,
  PRIMITIVE_COLORS,
  RADII,
  SEMANTIC_COLOR_ALIASES,
  SHELL_MEASUREMENTS,
  SHELLS,
  SPACING,
  TYPE_SCALE,
} from "./tokens.ts";

const HEADER = `/*
 * Generated file. Do not edit by hand.
 *
 * Source of truth: apps/web/src/styles/tokens.ts (approved in DESIGN.md).
 * Regenerate with: pnpm tokens:build
 * Verify with:     pnpm tokens:check
 */`;

function kebab(value: string): string {
  return value.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
}

function declarationLines(): string[] {
  const lines: string[] = [];

  lines.push("  /* Brand, neutral, and supporting primitives */");
  for (const [name, value] of Object.entries(PRIMITIVE_COLORS)) {
    lines.push(`  --color-${name}: ${value};`);
  }

  lines.push("");
  lines.push("  /* Semantic aliases: components consume these names */");
  for (const [name, primitive] of Object.entries(SEMANTIC_COLOR_ALIASES)) {
    lines.push(`  --${name}: var(--color-${primitive});`);
  }

  lines.push("");
  lines.push("  /* Spacing: 4px base unit */");
  for (const [name, value] of Object.entries(SPACING)) {
    lines.push(`  --${name}: ${value};`);
  }

  lines.push("");
  lines.push("  /* Radius hierarchy */");
  for (const [name, value] of Object.entries(RADII)) {
    lines.push(`  --${name}: ${value};`);
  }

  lines.push("");
  lines.push("  /* Elevation: flat by default */");
  for (const [name, value] of Object.entries(ELEVATION)) {
    lines.push(`  --${name}: ${value};`);
  }

  lines.push("");
  lines.push("  /* Typography */");
  for (const [name, value] of Object.entries(FONT_FAMILIES)) {
    lines.push(`  --font-${name}: ${value};`);
  }
  for (const [name, scale] of Object.entries(TYPE_SCALE)) {
    lines.push(`  --text-${name}-size: ${scale.desktop};`);
    lines.push(`  --text-${name}-size-mobile: ${scale.mobile};`);
    lines.push(`  --text-${name}-line-height: ${scale.lineHeight};`);
    lines.push(`  --text-${name}-weight: ${scale.weight};`);
    lines.push(`  --text-${name}-family: var(--font-${scale.family});`);
  }
  for (const [name, value] of Object.entries(LINE_LENGTH)) {
    lines.push(`  --measure-${name}: ${value};`);
  }

  lines.push("");
  lines.push("  /* Layout */");
  for (const [name, value] of Object.entries(BREAKPOINTS)) {
    lines.push(`  --breakpoint-${name}: ${value};`);
  }
  for (const [name, value] of Object.entries(SHELL_MEASUREMENTS)) {
    lines.push(`  --shell-${kebab(name)}: ${value};`);
  }
  lines.push(`  --focus-ring: ${FOCUS_RING.width} solid ${FOCUS_RING.color};`);
  lines.push(`  --focus-ring-offset: ${FOCUS_RING.offset};`);

  lines.push("");
  lines.push("  /* Approved shell families, selected by [data-shell] on the shell root */");
  for (const [shellName, shell] of Object.entries(SHELLS)) {
    lines.push(`  --shell-${shellName}-rail-width: ${shell.railWidth};`);
    lines.push(`  --shell-${shellName}-rail-collapsed-width: ${shell.railCollapsedWidth};`);
    lines.push(`  --shell-${shellName}-rail-surface: var(--color-${shell.railSurface});`);
    lines.push(`  --shell-${shellName}-rail-border: var(--color-${shell.railBorder});`);
    lines.push(`  --shell-${shellName}-selected-surface: var(--color-${shell.selectedSurface});`);
    lines.push(`  --shell-${shellName}-selected-text: var(--color-${shell.selectedText});`);
    lines.push(
      `  --shell-${shellName}-selected-indicator: var(--color-${shell.selectedIndicator});`,
    );
  }

  return lines;
}

function stylesheet(): string {
  const missingAssets = MISSING_DESIGN_ASSETS.map((entry) => entry.asset).join("; ");
  const lines = [
    HEADER,
    `/* Tracked missing approved assets: ${missingAssets} */`,
    ":root {",
    ...declarationLines(),
    "}",
    "",
  ];
  lines.push("@media (max-width: 767px) {");
  lines.push("  :root {");
  for (const [name, scale] of Object.entries(TYPE_SCALE)) {
    lines.push(`    --text-${name}-size: ${scale.mobile};`);
  }
  lines.push("  }");
  lines.push("}", "");
  return lines.join("\n");
}

const directory = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(directory, "tokens.css");

async function main(): Promise<void> {
  const expected = stylesheet();
  const checkOnly = process.argv.includes("--check");

  if (checkOnly) {
    const actual = await readFile(outputPath, "utf8").catch(() => null);
    if (actual !== expected) {
      throw new Error(
        `Generated token stylesheet is out of date: ${outputPath}. Run pnpm tokens:build.`,
      );
    }
    return;
  }

  await writeFile(outputPath, expected, "utf8");
}

await main();
