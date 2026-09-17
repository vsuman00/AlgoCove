import { err, ok, type Result } from "./primitives.ts";

/**
 * Authorization roles.
 *
 * Roles are loaded server-side from the session during request handling and can
 * never be supplied by the browser. Several roles are privileged: their actions
 * are audited, and content work requires separation of duties between authoring
 * and reviewing.
 */
export const ROLES = {
  learner: "learner",
  author: "author",
  technicalReviewer: "technical_reviewer",
  pedagogicalReviewer: "pedagogical_reviewer",
  publisher: "publisher",
  evaluator: "evaluator",
  operator: "operator",
  privacyAdministrator: "privacy_administrator",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: readonly Role[] = Object.values(ROLES);

export type RoleFailure = {
  readonly code: "invalid_role";
  readonly message: string;
};

export function parseRole(candidate: unknown): Result<Role, RoleFailure> {
  if (typeof candidate !== "string" || !(ALL_ROLES as readonly string[]).includes(candidate)) {
    return err({
      code: "invalid_role",
      message: "Role is not a recognized AlgoCove authorization role.",
    });
  }
  return ok(candidate as Role);
}

/**
 * Roles that require audit trails and explicit permission checks. Learner access
 * is the default, so anything beyond `learner` is privileged.
 */
export function isPrivilegedRole(role: Role): boolean {
  return role !== ROLES.learner;
}

/** True when the role may author or modify governed learning content. */
export function isContentRole(role: Role): boolean {
  return (
    role === ROLES.author ||
    role === ROLES.technicalReviewer ||
    role === ROLES.pedagogicalReviewer ||
    role === ROLES.publisher
  );
}

/**
 * Roles that must not be held by the same person for the same content version,
 * except under a recorded separation-of-duties exception.
 */
export const SEPARATED_CONTENT_ROLES = {
  author: ROLES.author,
  technicalReviewer: ROLES.technicalReviewer,
  pedagogicalReviewer: ROLES.pedagogicalReviewer,
  publisher: ROLES.publisher,
} as const;
