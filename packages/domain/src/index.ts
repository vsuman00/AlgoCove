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
  hasPermission,
  permissionsForRoles,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  validateContentSeparation,
} from "./authorization.ts";

export type { ContentAssignment, Permission, SeparationFailure } from "./authorization.ts";

export { parseLearnerProfileInput, SUPPORTED_LEARNER_LANGUAGES } from "./learner-profile.ts";

export type {
  AccessibilitySettings,
  LearnerLanguage,
  LearnerProfile,
  LearnerProfileFailure,
  LearnerProfileInput,
} from "./learner-profile.ts";

export {
  CURRICULUM_EDGE_KINDS,
  isPublishedCurriculumGraphImmutable,
  publishCurriculumGraph,
  validateCurriculumGraph,
} from "./curriculum.ts";

export {
  canUseForNewWork,
  contentVersionChecksum,
  createProblemDraft,
  publishProblemContent,
  recordContentReview,
  recordContentValidation,
  renderableContentPayload,
  retireProblemContent,
  validateContentProvenance,
} from "./content.ts";

export type {
  ContentFailure,
  ContentFailureCode,
  ContentId,
  ContentProvenance,
  ContentReview,
  ContentStatus,
  ContentValidation,
  ContentVersionId,
  ProblemContentVersion,
  ProblemId,
  ProblemVersionId,
  ReviewDecision,
  ReviewKind,
  RetirementReason,
} from "./content.ts";

export type {
  ConceptId,
  CurriculumConcept,
  CurriculumEdge,
  CurriculumEdgeKind,
  CurriculumFailure,
  CurriculumFailureCode,
  CurriculumGraphInput,
  CurriculumGraphVersion,
  CurriculumNode,
  CurriculumVersionId,
} from "./curriculum.ts";
