import { describe, expect, it } from "vitest";
import { ALL_ROLES, ROLES } from "@algocove/domain";
import { requireHostedPrivilegedSession } from "../../../apps/web/src/auth/privileged-session";

const hosted = { DEPLOYMENT_ENVIRONMENT: "staging" };
describe("hosted privileged session admission", () => {
  it("allows ordinary learners without imposing staff MFA", () => {
    expect(() => requireHostedPrivilegedSession([ROLES.learner], null, hosted)).not.toThrow();
  });
  it.each(ALL_ROLES.filter((role) => role !== ROLES.learner))(
    "requires both verified factors for %s, including mixed learner/staff grants",
    (role) => {
      expect(() =>
        requireHostedPrivilegedSession([ROLES.learner, role], [0, -1], hosted),
      ).toThrow();
      expect(() => requireHostedPrivilegedSession([role], [0, 0], hosted)).not.toThrow();
    },
  );
  it.each([
    null,
    undefined,
    [],
    [0],
    [0, 0, 0],
    [0, -1],
    [-1, 0],
    [0, 5],
    [5, 0],
    [0, Infinity],
    ["0", 0],
    { fva: [0, 0] },
  ])("rejects absent, stale, malformed or unenrolled factor evidence %j", (age) => {
    expect(() => requireHostedPrivilegedSession([ROLES.operator], age, hosted)).toThrow();
  });
  it("cannot bypass staff MFA by labelling a Vercel runtime local", () => {
    expect(() =>
      requireHostedPrivilegedSession([ROLES.publisher], null, {
        VERCEL: "1",
        DEPLOYMENT_ENVIRONMENT: "local",
      }),
    ).toThrow();
  });
  it("preserves explicit local fixture execution", () => {
    expect(() =>
      requireHostedPrivilegedSession([ROLES.operator], null, { DEPLOYMENT_ENVIRONMENT: "local" }),
    ).not.toThrow();
  });
});
