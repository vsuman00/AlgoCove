import { describe, expect, it } from "vitest";
import {
  hasPermission,
  PERMISSIONS,
  permissionsForRoles,
  ROLE_PERMISSIONS,
  ROLES,
  validateContentSeparation,
  formatId,
} from "@algocove/domain";
import { requireContentSeparation, requirePermission } from "@algocove/application";
import { createRequestContext, createFixedClock, createSequenceIdGenerator } from "@algocove/application";
import { parseInstant } from "@algocove/domain";

const learner = formatId("learner", "0000000000000001");
const otherLearner = formatId("learner", "0000000000000002");
const session = formatId("session", "0000000000000003");
const instant = parseInstant("2026-09-17T10:00:00.000Z");

if (!learner.ok || !otherLearner.ok || !session.ok || !instant.ok) {
  throw new Error("authorization fixtures are invalid");
}

describe("authorization contract", () => {
  it("covers every role with an explicit least-privilege permission set", () => {
    for (const role of Object.values(ROLES)) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
      expect(permissionsForRoles([role]).length).toBeGreaterThan(0);
    }
    expect(hasPermission([ROLES.learner], PERMISSIONS.profileWrite)).toBe(true);
    expect(hasPermission([ROLES.learner], PERMISSIONS.operationsManage)).toBe(false);
    expect(hasPermission([ROLES.author], PERMISSIONS.contentAuthor)).toBe(true);
    expect(hasPermission([ROLES.author], PERMISSIONS.contentPublish)).toBe(false);
    expect(hasPermission([ROLES.technicalReviewer], PERMISSIONS.contentTechnicalReview)).toBe(true);
    expect(hasPermission([ROLES.pedagogicalReviewer], PERMISSIONS.contentPedagogicalReview)).toBe(true);
    expect(hasPermission([ROLES.publisher], PERMISSIONS.contentPublish)).toBe(true);
    expect(hasPermission([ROLES.evaluator], PERMISSIONS.contentEvaluate)).toBe(true);
    expect(hasPermission([ROLES.operator], PERMISSIONS.operationsManage)).toBe(true);
    expect(hasPermission([ROLES.privacyAdministrator], PERMISSIONS.privacyManage)).toBe(true);
  });

  it("rejects an actor who spans separated content responsibilities", () => {
    const sameActor = [
      { actorId: learner.value, role: ROLES.author },
      { actorId: learner.value, role: ROLES.technicalReviewer },
    ] as const;
    expect(validateContentSeparation(sameActor)).toMatchObject({
      ok: false,
      error: { code: "separation_of_duties_violation", actorId: learner.value },
    });
    expect(validateContentSeparation([
      { actorId: learner.value, role: ROLES.author },
      { actorId: otherLearner.value, role: ROLES.technicalReviewer },
      { actorId: learner.value, role: ROLES.author },
    ])).toMatchObject({ ok: true });
  });

  it("enforces permissions at the application boundary", () => {
    const context = createRequestContext({
      actor: { userId: learner.value, sessionId: session.value, roles: [ROLES.learner], privileged: false },
      clock: createFixedClock(instant.value),
      ids: createSequenceIdGenerator(),
      serviceName: "algocove-web",
    });
    expect(() => requirePermission(context, PERMISSIONS.profileWrite)).not.toThrow();
    expect(() => requirePermission(context, PERMISSIONS.operationsManage)).toThrow("permission");
    expect(() => requireContentSeparation([
      { actorId: learner.value, role: ROLES.author },
      { actorId: learner.value, role: ROLES.publisher },
    ])).toThrow("separate identities");
  });
});
