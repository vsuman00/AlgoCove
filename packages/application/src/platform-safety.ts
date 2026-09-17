/** JSON-compatible value after sensitive fields and unbounded content are removed. */
export type SafePayload = Readonly<Record<string, unknown>>;

const SENSITIVE_KEY =
  /(source|code|pseudocode|prompt|token|secret|password|cookie|authorization|private[_-]?key|raw[_-]?body|model[_-]?output)/i;
const SENSITIVE_VALUE =
  /(bearer\s+[a-z0-9._-]+|postgres(?:ql)?:\/\/|-----begin\s+(?:rsa|openssh|private)|sk-[a-z0-9_-]{8,})/i;
const MAX_DEPTH = 5;
const MAX_KEYS = 64;
const MAX_ITEMS = 64;
const MAX_STRING_LENGTH = 1_000;

function sanitize(value: unknown, key: string | undefined, depth: number): unknown {
  if (key !== undefined && SENSITIVE_KEY.test(key)) return "[redacted]";
  if (depth > MAX_DEPTH) return "[truncated]";
  if (typeof value === "string") {
    if (SENSITIVE_VALUE.test(value)) return "[redacted]";
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH - 1)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return Number.isFinite(value) ? value : "[invalid-number]";
  }
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ITEMS).map((item) => sanitize(item, undefined, depth + 1));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value).slice(0, MAX_KEYS);
    return Object.fromEntries(
      entries.map(([entryKey, entryValue]) => [
        entryKey,
        sanitize(entryValue, entryKey, depth + 1),
      ]),
    );
  }
  return "[unsupported]";
}

/**
 * Produce a bounded object suitable for audit/outbox persistence. The function
 * is intentionally conservative: source material and secret-shaped values are
 * redacted even when a caller accidentally includes them under a new field.
 */
export function redactPayload(value: unknown): SafePayload {
  const sanitized = sanitize(value, undefined, 0);
  if (typeof sanitized !== "object" || sanitized === null || Array.isArray(sanitized)) {
    return { value: sanitized };
  }
  return sanitized as SafePayload;
}
