/**
 * Secret handling for configuration.
 *
 * Secret values must be readable by adapters but must never appear in logs,
 * error envelopes, health output, or telemetry. Wrapping them makes accidental
 * disclosure require an explicit `.reveal()` call, which is easy to review and
 * easy to grep for during a security pass.
 */

const redactedKeys = new Set<string>();

export class SecretString {
  #value: string;

  constructor(value: string) {
    if (value.length === 0) {
      throw new Error("SecretString cannot be empty.");
    }
    this.#value = value;
    redactedKeys.add(this.#value);
  }

  /** Explicit accessor. Every call site is a deliberate disclosure decision. */
  reveal(): string {
    return this.#value;
  }

  toString(): string {
    return "[redacted]";
  }

  toJSON(): string {
    return "[redacted]";
  }
}

/**
 * Mask every secret that passed through configuration.
 *
 * Applied to log lines, error messages, and diagnostic strings so a secret that
 * leaks through an unexpected path is still removed before it is emitted.
 */
export function redactSecrets(text: string): string {
  let result = text;
  for (const value of redactedKeys) {
    if (value.length >= 8) {
      result = result.split(value).join("[redacted]");
    }
  }
  return result;
}

/** Reset tracked secrets. Test-only helper to keep cases independent. */
export function resetSecretRegistry(): void {
  redactedKeys.clear();
}
