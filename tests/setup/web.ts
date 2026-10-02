/**
 * jsdom test setup for React component tests.
 *
 * Adds jest-dom matchers and unmounts rendered trees after each case so tests
 * cannot observe each other's DOM.
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import type * as ClerkAdapterModule from "../../apps/web/src/auth/clerk-adapter";
import { afterEach, vi } from "vitest";

// Route unit tests own their persistence seam. The release composition never
// chooses this store when PostgreSQL is missing; it returns unavailable.
vi.mock("../../apps/web/src/auth/clerk-adapter", async (original) => {
  const identityModule = await original<typeof ClerkAdapterModule>();
  const store = identityModule.createInMemoryClerkIdentityStore();
  const adapter = identityModule.createClerkIdentityAdapter({ store });
  return {
    ...identityModule,
    getClerkIdentityStore: () => store,
    getClerkIdentityAdapter: () => adapter,
  };
});

afterEach(() => {
  cleanup();
});
