import { err, ok, type LearnerId, type Result } from "./primitives.ts";
import { isContentRole, ROLES, type Role } from "./roles.ts";

/** Stable capabilities used by application use cases and audit policy. */
export const PERMISSIONS = {
  profileRead: "profile.read",
  profileWrite: "profile.write",
  contentAuthor: "content.author",
  contentTechnicalReview: "content.technical_review",
  contentPedagogicalReview: "content.pedagogical_review",
  contentPublish: "content.publish",
  contentEvaluate: "content.evaluate",
  operationsManage: "operations.manage",
  privacyManage: "privacy.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * The complete role matrix is owned by the domain. Provider metadata and
 * browser payloads never participate in this mapping.
 */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  [ROLES.learner]: [PERMISSIONS.profileRead, PERMISSIONS.profileWrite],
  [ROLES.author]: [PERMISSIONS.contentAuthor],
  [ROLES.technicalReviewer]: [PERMISSIONS.contentTechnicalReview],
  [ROLES.pedagogicalReviewer]: [PERMISSIONS.contentPedagogicalReview],
  [ROLES.publisher]: [PERMISSIONS.contentPublish],
  [ROLES.evaluator]: [PERMISSIONS.contentEvaluate],
  [ROLES.operator]: [PERMISSIONS.operationsManage],
  [ROLES.privacyAdministrator]: [PERMISSIONS.privacyManage],
};

export function permissionsForRoles(roles: readonly Role[]): readonly Permission[] {
  return [...new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role]))];
}

export function hasPermission(roles: readonly Role[], permission: Permission): boolean {
  return permissionsForRoles(roles).includes(permission);
}

export type ContentAssignment = {
  readonly actorId: LearnerId;
  readonly role: Role;
};

export type SeparationFailure = {
  readonly code: "separation_of_duties_violation";
  readonly message: string;
  readonly actorId: LearnerId;
};

/**
 * Content authoring, technical review, pedagogical review, and publication
 * must be assigned to different internal identities. An exception is a future
 * explicit, audited policy decision; this pure rule never infers one.
 */
export function validateContentSeparation(
  assignments: readonly ContentAssignment[],
): Result<undefined, SeparationFailure> {
  const contentActors = new Map<LearnerId, Role>();
  for (const assignment of assignments) {
    if (!isContentRole(assignment.role)) continue;
    const previousRole = contentActors.get(assignment.actorId);
    if (previousRole !== undefined && previousRole !== assignment.role) {
      return err({
        code: "separation_of_duties_violation",
        message: "Content authoring and review responsibilities require separate identities.",
        actorId: assignment.actorId,
      });
    }
    contentActors.set(assignment.actorId, assignment.role);
  }
  return ok(undefined);
}
