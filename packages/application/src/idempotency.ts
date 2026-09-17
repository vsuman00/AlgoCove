import type { ContentChecksum } from "@algocove/domain";
import { conflictError } from "./errors.ts";

export type IdempotencyResponse = {
  readonly status: number;
  readonly body: Readonly<Record<string, unknown>>;
};

export type IdempotencyClaimInput = {
  readonly scope: string;
  readonly key: string;
  readonly requestHash: ContentChecksum;
};

export type IdempotencyClaimResult =
  | { readonly kind: "claimed" }
  | { readonly kind: "replay"; readonly response: IdempotencyResponse }
  | { readonly kind: "in_progress" }
  | { readonly kind: "conflict" };

export type IdempotencyRepository = {
  claim(input: IdempotencyClaimInput): Promise<IdempotencyClaimResult>;
  complete(
    input: IdempotencyClaimInput & { readonly response: IdempotencyResponse },
  ): Promise<void>;
  fail(input: IdempotencyClaimInput): Promise<void>;
};

export type IdempotentResult = IdempotencyResponse & { readonly replayed: boolean };

/** Execute a mutating effect once per scope/key/hash and safely replay success. */
export async function executeIdempotently(
  repository: IdempotencyRepository,
  input: IdempotencyClaimInput,
  effect: () => Promise<IdempotencyResponse>,
): Promise<IdempotentResult> {
  const claim = await repository.claim(input);
  if (claim.kind === "replay") return { ...claim.response, replayed: true };
  if (claim.kind === "conflict") {
    throw conflictError("The idempotency key was used for a different request.");
  }
  if (claim.kind === "in_progress") {
    throw conflictError("The request for this idempotency key is already in progress.");
  }

  try {
    const response = await effect();
    await repository.complete({ ...input, response });
    return { ...response, replayed: false };
  } catch (error) {
    try {
      await repository.fail(input);
    } catch {
      // Preserve the effect failure. A repair/retry worker can inspect the claim.
    }
    throw error;
  }
}
