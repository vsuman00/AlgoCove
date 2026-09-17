/**
 * Value primitives shared by every AlgoCove module.
 *
 * Design rules this file follows:
 *
 * 1. No I/O, no framework, and no third-party dependency. The domain package is
 *    the innermost layer, so anything imported here becomes part of every
 *    module's contract.
 * 2. Validation returns `Result` values instead of throwing. Application code
 *    converts a failed result into a stable error envelope; the domain never
 *    decides transport behavior.
 * 3. Server-controlled time is represented as an immutable UTC instant. Only an
 *    injected clock may create one, so a browser cannot influence stored time.
 */

/** A `Result` is either a success value or a typed failure reason. */
export type Result<TValue, TFailure> =
  { readonly ok: true; readonly value: TValue } | { readonly ok: false; readonly error: TFailure };

export function ok<TValue>(value: TValue): Result<TValue, never> {
  return { ok: true, value };
}

export function err<TFailure>(error: TFailure): Result<never, TFailure> {
  return { ok: false, error };
}

export function isOk<TValue, TFailure>(
  result: Result<TValue, TFailure>,
): result is { readonly ok: true; readonly value: TValue } {
  return result.ok;
}

export function isErr<TValue, TFailure>(
  result: Result<TValue, TFailure>,
): result is { readonly ok: false; readonly error: TFailure } {
  return !result.ok;
}

/** Exhaustiveness helper: a compile error appears if a variant is unhandled. */
export function assertNever(value: never, context: string): never {
  throw new Error(`Unhandled variant in ${context}: ${JSON.stringify(value)}`);
}

declare const brand: unique symbol;

/**
 * Nominal typing so identifiers of different kinds cannot be mixed up. The
 * brand has no runtime representation: values stay plain strings.
 */
export type Branded<TValue, TLabel extends string> = TValue & {
  readonly [brand]: TLabel;
};

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

/**
 * Stable identifier kinds. Each kind owns a prefix so a value recorded in a
 * log, an outbox row, or a URL can be identified without guessing.
 */
export const ID_KINDS = {
  learner: "usr",
  session: "ses",
  attempt: "att",
  contentVersion: "cnt",
  problemVersion: "prb",
  codeRun: "run",
  tutorTurn: "trn",
  request: "req",
  event: "evt",
} as const;

export type IdKind = keyof typeof ID_KINDS;
export type IdPrefix = (typeof ID_KINDS)[IdKind];

const ID_ENTROPY_PATTERN = /^[0-9a-hjkmnp-tv-z]{16,52}$/;
const ID_PATTERN = /^[a-z]{3}_[0-9a-hjkmnp-tv-z]{16,52}$/;

export type OpaqueId<TKind extends IdKind> = Branded<string, `OpaqueId:${TKind}`>;
export type LearnerId = OpaqueId<"learner">;

export type IdParseFailure = {
  readonly code: "invalid_id";
  readonly kind: IdKind;
  readonly message: string;
};

/**
 * Format an identifier from caller-supplied entropy.
 *
 * Entropy is injected rather than generated here so the domain stays free of
 * platform APIs and tests remain deterministic.
 */
export function formatId<TKind extends IdKind>(
  kind: TKind,
  entropy: string,
): Result<OpaqueId<TKind>, IdParseFailure> {
  const normalized = entropy.toLowerCase();
  if (!ID_ENTROPY_PATTERN.test(normalized)) {
    return err({
      code: "invalid_id",
      kind,
      message:
        "Identifier entropy must be 16 to 52 lowercase characters drawn from an unambiguous alphabet.",
    });
  }
  return ok(`${ID_KINDS[kind]}_${normalized}` as OpaqueId<TKind>);
}

/** Validate an identifier that arrived across a trust boundary. */
export function parseId<TKind extends IdKind>(
  kind: TKind,
  candidate: unknown,
): Result<OpaqueId<TKind>, IdParseFailure> {
  const prefix = ID_KINDS[kind];
  if (typeof candidate !== "string" || !ID_PATTERN.test(candidate)) {
    return err({
      code: "invalid_id",
      kind,
      message: `Expected an opaque ${kind} identifier such as ${prefix}_<entropy>.`,
    });
  }
  if (!candidate.startsWith(`${prefix}_`)) {
    return err({
      code: "invalid_id",
      kind,
      message: `Identifier does not belong to the ${kind} kind.`,
    });
  }
  return ok(candidate as OpaqueId<TKind>);
}

/** True when the candidate is a well-formed identifier of the given kind. */
export function isId<TKind extends IdKind>(kind: TKind, candidate: unknown): boolean {
  return parseId(kind, candidate).ok;
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

/** An absolute UTC instant. Always serialized with millisecond precision. */
export type Instant = Branded<string, "Instant">;

export type InstantFailure = {
  readonly code: "invalid_instant";
  readonly message: string;
};

const ISO_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;

/** Maximum representable instant, so absurd inputs fail deterministically. */
export const INSTANT_MAX_EPOCH_MS = 8_640_000_000_000_000;

export function instantFromEpochMs(epochMs: number): Result<Instant, InstantFailure> {
  if (!Number.isInteger(epochMs) || epochMs < 0 || epochMs > INSTANT_MAX_EPOCH_MS) {
    return err({
      code: "invalid_instant",
      message: "Instant must be an integer number of milliseconds within the supported range.",
    });
  }
  return ok(new Date(epochMs).toISOString() as Instant);
}

/**
 * Parse an ISO-8601 instant and normalize it to UTC with milliseconds.
 *
 * Offsets are accepted because external systems send them, but the stored value
 * is always UTC so comparisons and ordering stay unambiguous.
 */
export function parseInstant(candidate: unknown): Result<Instant, InstantFailure> {
  if (candidate instanceof Date) {
    if (Number.isNaN(candidate.getTime())) {
      return err({ code: "invalid_instant", message: "Date value is invalid." });
    }
    return instantFromEpochMs(candidate.getTime());
  }
  if (typeof candidate !== "string") {
    return err({
      code: "invalid_instant",
      message: "Instant must be an ISO-8601 timestamp with an explicit UTC offset.",
    });
  }
  const match = ISO_INSTANT_PATTERN.exec(candidate);
  if (match === null) {
    return err({
      code: "invalid_instant",
      message: "Instant must be an ISO-8601 timestamp with an explicit UTC offset.",
    });
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const milliseconds = Number((match[7] ?? "").padEnd(3, "0") || "0");
  const offset = match[8] ?? "";
  const offsetHour = offset === "Z" ? 0 : Number(offset.slice(1, 3));
  const offsetMinute = offset === "Z" ? 0 : Number(offset.slice(4, 6));
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (
    year === 0 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > (daysInMonth ?? 0) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return err({ code: "invalid_instant", message: "Instant is not a valid calendar time." });
  }
  const epochMs = Date.parse(candidate);
  if (Number.isNaN(epochMs)) {
    return err({ code: "invalid_instant", message: "Instant is not a valid calendar time." });
  }
  const offsetSign = offset === "Z" ? 1 : offset.startsWith("+") ? 1 : -1;
  const localTime = new Date(epochMs + offsetSign * (offsetHour * 60 + offsetMinute) * 60_000);
  if (
    localTime.getUTCFullYear() !== year ||
    localTime.getUTCMonth() + 1 !== month ||
    localTime.getUTCDate() !== day ||
    localTime.getUTCHours() !== hour ||
    localTime.getUTCMinutes() !== minute ||
    localTime.getUTCSeconds() !== second ||
    localTime.getUTCMilliseconds() !== milliseconds
  ) {
    return err({ code: "invalid_instant", message: "Instant is not a valid calendar time." });
  }
  return instantFromEpochMs(epochMs);
}

export function instantToEpochMs(instant: Instant): number {
  return Date.parse(instant);
}

/** Compare two instants: negative when `left` is earlier than `right`. */
export function compareInstants(left: Instant, right: Instant): number {
  return instantToEpochMs(left) - instantToEpochMs(right);
}

export function isBefore(left: Instant, right: Instant): boolean {
  return compareInstants(left, right) < 0;
}

export function isAtOrAfter(left: Instant, right: Instant): boolean {
  return compareInstants(left, right) >= 0;
}

// ---------------------------------------------------------------------------
// Durations
// ---------------------------------------------------------------------------

/** A non-negative span of time in whole milliseconds. */
export type Duration = Branded<number, "Duration">;

export type DurationFailure = {
  readonly code: "invalid_duration";
  readonly message: string;
};

export const DURATION_MAX_MS = 365 * 24 * 60 * 60 * 1000;

export function durationFromMs(milliseconds: number): Result<Duration, DurationFailure> {
  if (!Number.isInteger(milliseconds) || milliseconds < 0 || milliseconds > DURATION_MAX_MS) {
    return err({
      code: "invalid_duration",
      message: "Duration must be a non-negative integer number of milliseconds within one year.",
    });
  }
  return ok(milliseconds as Duration);
}

export function durationFromSeconds(seconds: number): Result<Duration, DurationFailure> {
  if (!Number.isInteger(seconds) || seconds < 0) {
    return err({
      code: "invalid_duration",
      message: "Duration must be a non-negative integer number of seconds.",
    });
  }
  return durationFromMs(seconds * 1000);
}

export function durationFromMinutes(minutes: number): Result<Duration, DurationFailure> {
  if (!Number.isInteger(minutes) || minutes < 0) {
    return err({
      code: "invalid_duration",
      message: "Duration must be a non-negative integer number of minutes.",
    });
  }
  return durationFromSeconds(minutes * 60);
}

export function durationToMs(duration: Duration): number {
  return duration;
}

export function durationToSeconds(duration: Duration): number {
  return duration / 1000;
}

export function addDurations(left: Duration, right: Duration): Result<Duration, DurationFailure> {
  return durationFromMs(left + right);
}

export function addDurationToInstant(
  instant: Instant,
  duration: Duration,
): Result<Instant, InstantFailure> {
  return instantFromEpochMs(instantToEpochMs(instant) + duration);
}

/** Smallest declared session length the roadmap planner may schedule. */
export const MINIMUM_SESSION_MINUTES = 10;

/** Largest declared session length a learner may configure in the pilot. */
export const MAXIMUM_SESSION_MINUTES = 240;
// ---------------------------------------------------------------------------
// Time zones
// ---------------------------------------------------------------------------

/**
 * A learner time zone. Stored values are IANA identifiers so due windows can be
 * recalculated after daylight-saving transitions instead of drifting.
 */
export type TimeZoneId = Branded<string, "TimeZoneId">;

export type TimeZoneFailure = {
  readonly code: "invalid_timezone";
  readonly message: string;
};

const TIME_ZONE_SHAPE = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){1,2}$/;

function isSupportedTimeZone(candidate: string): boolean {
  try {
    // Throws a RangeError when the identifier is unknown to the runtime database.
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return true;
  } catch {
    return false;
  }
}

export function parseTimeZone(candidate: unknown): Result<TimeZoneId, TimeZoneFailure> {
  if (candidate === "UTC") {
    return ok("UTC" as TimeZoneId);
  }
  if (typeof candidate !== "string" || !TIME_ZONE_SHAPE.test(candidate)) {
    return err({
      code: "invalid_timezone",
      message: "Time zone must be a region identifier such as Europe/Berlin, or UTC.",
    });
  }
  if (!isSupportedTimeZone(candidate)) {
    return err({
      code: "invalid_timezone",
      message: "Time zone is not present in the runtime time zone database.",
    });
  }
  return ok(candidate as TimeZoneId);
}

// ---------------------------------------------------------------------------
// Versioned policy and content identity
// ---------------------------------------------------------------------------

/**
 * Version of a deterministic policy (hint ladder, mastery banding, planning).
 * Evidence and projections record the policy version that produced them, so a
 * later change never rewrites history.
 */
export type PolicyVersion = Branded<number, "PolicyVersion">;

export type PolicyVersionFailure = {
  readonly code: "invalid_policy_version";
  readonly message: string;
};

export function policyVersion(candidate: number): Result<PolicyVersion, PolicyVersionFailure> {
  if (!Number.isInteger(candidate) || candidate < 1 || candidate > 10_000) {
    return err({
      code: "invalid_policy_version",
      message: "Policy version must be a positive integer no greater than 10000.",
    });
  }
  return ok(candidate as PolicyVersion);
}

/** A checksum over immutable content or a migration body. */
export type ContentChecksum = Branded<string, "ContentChecksum">;

const CHECKSUM_PATTERN = /^sha256:[0-9a-f]{64}$/;

export type ChecksumFailure = {
  readonly code: "invalid_checksum";
  readonly message: string;
};

export function parseContentChecksum(candidate: unknown): Result<ContentChecksum, ChecksumFailure> {
  if (typeof candidate !== "string" || !CHECKSUM_PATTERN.test(candidate)) {
    return err({
      code: "invalid_checksum",
      message: "Checksum must be recorded as sha256:<64 lowercase hexadecimal characters>.",
    });
  }
  return ok(candidate as ContentChecksum);
}

// ---------------------------------------------------------------------------
// Bounded numeric values
// ---------------------------------------------------------------------------

/** A bounded integer used for capacity, workload, and limit contracts. */
export type BoundedInt<TLabel extends string> = Branded<number, `BoundedInt:${TLabel}`>;

export type BoundedIntFailure = {
  readonly code: "out_of_range";
  readonly message: string;
};

export function boundedInt<TLabel extends string>(
  label: TLabel,
  bounds: { readonly min: number; readonly max: number },
  candidate: number,
): Result<BoundedInt<TLabel>, BoundedIntFailure> {
  if (!Number.isInteger(candidate)) {
    return err({ code: "out_of_range", message: `${label} must be an integer.` });
  }
  if (candidate < bounds.min || candidate > bounds.max) {
    return err({
      code: "out_of_range",
      message: `${label} must be between ${bounds.min} and ${bounds.max}.`,
    });
  }
  return ok(candidate as BoundedInt<TLabel>);
}

// ---------------------------------------------------------------------------
// Text hygiene
// ---------------------------------------------------------------------------

/**
 * Normalize learner-authored text that is stored verbatim but must not carry
 * invisible control characters into logs, exports, or rendered prose.
 */
export function normalizeLearnerText(candidate: string): string {
  return candidate
    .replace(/\r\n?/g, "\n")
    .split("")
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return !(
        codePoint <= 0x08 ||
        codePoint === 0x0b ||
        codePoint === 0x0c ||
        (codePoint >= 0x0e && codePoint <= 0x1f) ||
        codePoint === 0x7f
      );
    })
    .join("")
    .trim();
}

/** Count Unicode code points, so a limit is never accidentally byte-based. */
export function textLength(candidate: string): number {
  return [...candidate].length;
}
