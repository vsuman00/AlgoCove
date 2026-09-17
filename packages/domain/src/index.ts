/**
 * Public surface of the domain package.
 *
 * Phase 1 provides the shared value primitives and the authorization role
 * vocabulary. Later phases add curriculum, content, practice, mastery, roadmap,
 * hint policy, and budget policies as sibling modules in this package.
 */
export {
  assertNever,
  boundedInt,
  compareInstants,
  durationFromMinutes,
  durationFromMs,
  durationFromSeconds,
  durationToMs,
  durationToSeconds,
  addDurationToInstant,
  addDurations,
  err,
  formatId,
  ID_KINDS,
  instantFromEpochMs,
  instantToEpochMs,
  INSTANT_MAX_EPOCH_MS,
  DURATION_MAX_MS,
  isAtOrAfter,
  isBefore,
  isErr,
  isId,
  isOk,
  MAXIMUM_SESSION_MINUTES,
  MINIMUM_SESSION_MINUTES,
  normalizeLearnerText,
  ok,
  parseContentChecksum,
  parseId,
  parseInstant,
  parseTimeZone,
  policyVersion,
  textLength,
} from "./primitives.ts";

export type {
  BoundedInt,
  BoundedIntFailure,
  Branded,
  ChecksumFailure,
  ContentChecksum,
  Duration,
  DurationFailure,
  IdKind,
  IdParseFailure,
  IdPrefix,
  LearnerId,
  Instant,
  InstantFailure,
  OpaqueId,
  PolicyVersion,
  PolicyVersionFailure,
  Result,
  TimeZoneFailure,
  TimeZoneId,
} from "./primitives.ts";

export {
  ALL_ROLES,
  isContentRole,
  isPrivilegedRole,
  parseRole,
  ROLES,
  SEPARATED_CONTENT_ROLES,
} from "./roles.ts";

export type { Role, RoleFailure } from "./roles.ts";

export {
  assertActiveSession,
  revokeSession,
  sessionStatus,
} from "./identity.ts";

export type {
  SessionFailure,
  SessionRecord,
  SessionStatus,
} from "./identity.ts";
