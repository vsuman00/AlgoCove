# Hosted identity qualification

Phase 12 Task 55a is **partial**. Clerk supplies verified cookie/session identity; PostgreSQL supplies AlgoCove roles on every authenticated request. Provider metadata never grants application privileges. Ownership, same-origin commands and sensitive privacy reverification retain their existing tests.

## Privileged session admission

Hosted authenticated request contexts require both of Clerk's verified factor ages to be finite, nonnegative and less than five minutes when the database grants any staff role. Missing, malformed, unenrolled (`-1`) or stale factors return HTTP 403 before a privileged use case receives its context. Mixed learner/staff grants receive the same protection. Learner-only requests do not require staff MFA; isolated local fixtures preserve their local scope. Vercel cannot opt into a local admission marker.

This explicitly inspects the verified `factorVerificationAge` because Clerk's reverification helper can downgrade a second-factor request for an unenrolled account. Staff must enable MFA through account security settings and sign in with both factors again. No factor ages or role claims are accepted from browser headers or public metadata.

Verification: policy tests cover every privileged role and missing/stale/malformed factor evidence. Request-composition tests reject forged headers/metadata, admit valid MFA and reject a revoked database role on the next request despite the same provider session. These injected tests are engineering evidence; real hosted enrollment, MFA, sign-in/out/revocation, account linking and provider lifecycle qualification remain open.

Sources: [Clerk auth object](https://clerk.com/docs/reference/backend/types/auth-object), [Clerk reverification caveats](https://clerk.com/docs/guides/secure/reverification).
