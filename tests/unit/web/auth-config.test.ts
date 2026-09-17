import { afterEach, describe, expect, it, vi } from "vitest";
import { isClerkConfigured } from "../../../apps/web/src/auth/clerk-config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Clerk runtime configuration", () => {
  it("requires non-empty publishable and secret keys", () => {
    expect(
      isClerkConfigured({
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fixture",
        CLERK_SECRET_KEY: "sk_test_fixture",
      }),
    ).toBe(true);
    expect(
      isClerkConfigured({
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
        CLERK_SECRET_KEY: "sk_test_fixture",
      }),
    ).toBe(false);
    expect(
      isClerkConfigured({
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fixture",
        CLERK_SECRET_KEY: "",
      }),
    ).toBe(false);
  });

  it("reads process environment values without exposing them", () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_fixture");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture");

    expect(isClerkConfigured()).toBe(true);
  });
});
