import { expect, it } from "vitest";
import { safeReturnTo } from "../../../apps/web/src/auth/return-target";
it("retains bounded discovery and language context through authentication", () => {
  expect(safeReturnTo("/learn/stack-next-greater?language=java")).toBe(
    "/learn/stack-next-greater?language=java",
  );
  expect(safeReturnTo("/sheets/col_aaaaaaaaaaaaaaaa")).toBe("/sheets/col_aaaaaaaaaaaaaaaa");
});
it("rejects external, encoded, private and looping return targets", () => {
  for (const value of [
    "//evil.test",
    "https://evil.test",
    "/\\evil.test",
    "/learn/%2f%2fevil.test",
    "/sign-in",
    "/admin/content",
    "/learn?source=private-code",
    "/learn?language=c&language=java",
    "/learn\n",
  ])
    expect(safeReturnTo(value)).toBe("/learn");
});

it("preserves a validated onboarding continuation and sanitizes nested external returns", () => {
  expect(safeReturnTo("/onboarding?returnTo=%2Flearn%2Fmatching-readings%3Flanguage%3Djava")).toBe(
    "/onboarding?returnTo=%2Flearn%2Fmatching-readings%3Flanguage%3Djava",
  );
  expect(safeReturnTo("/learn/matching-readings?returnTo=https%3A%2F%2Fevil.test")).toBe(
    "/learn/matching-readings?returnTo=%2Flearn",
  );
});
