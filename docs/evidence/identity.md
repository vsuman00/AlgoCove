# Hosted identity qualification

Phase 12 Task 55a is **partial**. Clerk supplies verified cookie/session identity; PostgreSQL supplies AlgoCove roles on every authenticated request. Provider metadata never grants application privileges. Ownership, same-origin commands and sensitive privacy reverification retain their existing tests.

## Privileged session admission

Hosted authenticated request contexts require both of Clerk's verified factor ages to be finite, nonnegative and less than five minutes when the database grants any staff role. Missing, malformed, unenrolled (`-1`) or stale factors return HTTP 403 before a privileged use case receives its context. Mixed learner/staff grants receive the same protection. Learner-only requests do not require staff MFA; isolated local fixtures preserve their local scope. Vercel cannot opt into a local admission marker.

This explicitly inspects the verified `factorVerificationAge` because Clerk's reverification helper can downgrade a second-factor request for an unenrolled account. Staff must enable MFA through account security settings and sign in with both factors again. No factor ages or role claims are accepted from browser headers or public metadata.

Verification: policy tests cover every privileged role and missing/stale/malformed factor evidence. Request-composition tests reject forged headers/metadata, admit valid MFA and reject a revoked database role on the next request despite the same provider session. These injected tests are engineering evidence; real hosted enrollment, MFA, sign-in/out/revocation, account linking and provider lifecycle qualification remain open.

Sources: [Clerk auth object](https://clerk.com/docs/reference/backend/types/auth-object), [Clerk reverification caveats](https://clerk.com/docs/guides/secure/reverification).

## Actual merged-main hosted checks

The expanded harness verifies development email-code sign-in/out, backend session revocation (bounded 75-second application rejection), same-origin reauthenticated export, cross-origin rejection, two-account export isolation, actual unenrolled staff denial and role removal in an existing session. It uses temporary provider accounts and exact-subject database cleanup. [Exact deployment and limitations](phases/phase12-evidence.md#merged-main-release-and-free-hosted-assurance).

Positive TOTP enrollment is still provider-blocked: the configured development instance reports the feature disabled despite the owner's dashboard confirmation. The real client enrollment/second-factor test remains failing rather than silently downgraded or skipped. Current-factor success does not prove stale-factor reverification, account linking, invalid callbacks or ownership of all resource types; those remain qualification work.
