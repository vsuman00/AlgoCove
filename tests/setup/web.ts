/**
 * jsdom test setup for React component tests.
 *
 * Adds jest-dom matchers and unmounts rendered trees after each case so tests
 * cannot observe each other's DOM.
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
