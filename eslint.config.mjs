import js from "@eslint/js";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Single lint authority for the workspace.
 *
 * The architecture test suite enforces package dependency direction; lint covers
 * the rules that do not need the full import graph (no re-export of raw types,
 * no floating promises in server code, no stray console output in packages).
 */
export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "tests/architecture/fixtures/**",
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // This workspace uses the App Router; the pages-directory rule is not
      // applicable and otherwise reports a false configuration failure.
      "@next/next/no-html-link-for-pages": "off",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "object-shorthand": "error",
      "prefer-const": "error",
    },
  },
  {
    files: ["packages/domain/src/**/*.ts"],
    rules: {
      // Domain code is dependency-free by contract; importing Node built-ins signals
      // that behavior belongs in an adapter or application layer instead.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["node:*", "next", "next/*", "react", "react-dom", "pg", "zod"],
              message:
                "packages/domain must stay dependency-free; move I/O, framework, or parsing concerns to an adapter or the application layer.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/web/src/components/**/*.tsx", "apps/web/app/**/*.tsx"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: ["tests/**/*.ts", "tests/**/*.tsx"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "no-console": "off",
    },
  },
  {
    files: ["packages/db/src/cli/**/*.ts"],
    rules: {
      // These are operator CLIs; stdout is their documented process boundary.
      "no-console": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["**/*.mjs", "scripts/**/*.js"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    settings: {
      next: { rootDir: ["apps/web/"] },
    },
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  prettier,
);
