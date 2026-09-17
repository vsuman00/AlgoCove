import {
  hasPermission,
  validateContentSeparation,
  type ContentAssignment,
  type LearnerId,
  type Permission,
} from "@algocove/domain";
import { authorizationError } from "./errors.ts";
import { requireOwnership, type RequestContext } from "./request-context.ts";

export function requirePermission(context: RequestContext, permission: Permission): void {
  if (!hasPermission(context.actor.roles, permission)) {
    throw authorizationError("This operation requires a permission the actor does not hold.");
  }
}

/** Owner access is explicit; privileged access must carry a capability. */
export function requireOwnerOrPermission(
  context: RequestContext,
  ownerId: LearnerId,
  permission: Permission,
): void {
  if (ownerId === context.actor.userId) return;
  requirePermission(context, permission);
}

export function requireContentSeparation(assignments: readonly ContentAssignment[]): void {
  const result = validateContentSeparation(assignments);
  if (!result.ok) {
    throw authorizationError(result.error.message);
  }
}

export { requireOwnership };
