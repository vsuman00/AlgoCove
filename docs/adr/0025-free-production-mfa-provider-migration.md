# ADR-0025: Plan a free production MFA provider migration

## Status

Proposed. The owner requested this migration plan on 2026-10-10. Provider replacement, provisioning and authentication cutover have not been implemented or approved by this record. Clerk remains the active staging identity provider.

## Date

2026-10-10

## Context

AlgoCove requires a hard $0 budget, India-focused access, verified hosted sessions, recent privileged MFA, immediate database role removal and safe account linking. Clerk is already integrated. Its MFA is free in development but requires a paid plan in production, which conflicts with the budget. Existing synthetic staging qualification does not authorize a real learner pilot. [Clerk authentication options](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options#multi-factor-authentication).

This changes the identity-provider proposal within [ADR-0010](0010-deployment-neutral-single-region-first.md); it preserves the Vercel web and Neon application-data boundaries. The existing [identity evidence](../evidence/identity.md) remains historical evidence for Clerk, not proof of Supabase behavior.

## Decision

Recommend a qualification spike for **Supabase Auth on the Free plan**, using TOTP and a specific Singapore project region (`ap-southeast-1`). Keep application records, roles, migrations and pgvector in the existing Neon database. Supabase would store authentication records in its own managed project; this is an additional identity data store, not a migration of AlgoCove's application database. Singapore aligns with existing Vercel/Neon locations; it is not India-only residency or proof of legal compliance. [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa/totp), [regions](https://supabase.com/docs/guides/platform/regions).

Basic MFA is included in Free, with 50,000 monthly active users and two active projects. Free projects can pause after a week of inactivity and have no included automatic backups, PITR or uptime SLA. Do not use paid phone MFA, custom domains, upgrades or trial credits. Verify the connected organization's free-project allowance before provisioning. Fail at limits rather than automatically enabling spending. [Pricing](https://supabase.com/pricing).

Recommend Google/GitHub OAuth as the initial first factor to avoid an unqualified email-delivery dependency. These are platform login identities, not external coding-account links. Supabase's default SMTP is restricted to team addresses and currently two messages per hour; it is not production mail. Email/password signup, recovery and magic links require a separately qualified $0 SMTP arrangement and an owned sender domain where required. Do not disable email ownership verification to make a free email flow appear functional. [SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp).

## Security and data boundaries

- Introduce a provider-neutral verified-session boundary. Routes consume the verified subject, stable session ID and factor evidence; they do not consume provider metadata as application roles. Use a server-selected provider, never a request header or automatic fallback.
- Create a request-scoped SSR client with PKCE and explicitly allowed callback destinations. Validate signature, issuer, audience, expiry, subject and session ID before trusting claims. Anonymous and service-role tokens cannot authenticate a learner. Apply `private, no-store` on authentication and refreshed-cookie responses; never share a user client between Vercel requests. [SSR guidance](https://supabase.com/docs/guides/auth/server-side/advanced-guide), [JWT claims](https://supabase.com/docs/guides/auth/jwt-fields).
- Require verified `aal2` plus recent first-factor and TOTP evidence for staff. Translate verified `amr` timestamps into the existing five-minute policy; JWT issuance or refresh time cannot substitute for factor verification time. Missing, malformed, future, stale or unenrolled evidence fails closed. Require recent first-factor reauthentication for privacy export/deletion. Qualification must prove actual provider refresh/reverification behavior, not only decoded fixtures.
- Free does not provide the paid maximum-lifetime/inactivity session controls. Implement application session lifetime/revocation policy in Neon using a stable verified session ID and server timestamps. Provider logout can leave a previously issued JWT valid until expiry. Qualify a narrow authenticated session-liveness RPC in the identity project that checks only the caller's verified subject/session against `auth.sessions`, returns a boolean and grants no table access. Check live session state for sensitive operations; provider/database failures deny access. Reject this design if it cannot work safely on Free. Do not put Supabase service-role or database-owner credentials in the normal web environment. [Session controls and revocation](https://supabase.com/docs/guides/auth/sessions).
- Keep application roles in Neon and read active grants on every request. Factor enrollment does not create a staff grant. Suspension/deletion tombstones deny all identities and active sessions for the learner.
- Preserve existing internal learner IDs. Expand `platform.identity_account`'s Clerk-only provider constraint additively, then attach a verified Supabase subject to the existing learner in one transaction. Never recompute an existing learner ID from the replacement subject, merge by matching email, copy roles from provider claims or treat LeetCode/other coding profiles as identity proof.
- Existing accounts require fresh ownership proof of both provider identities, a short-lived single-use server-bound linking challenge and an audit event. If proof is unavailable, use a reviewed recovery path; do not silently relink. New users receive only learner privileges. Test subject conflicts and simultaneous linking attempts.
- Qualify recovery separately from TOTP enrollment. Do not assume backup-code feature parity. Require an independently enrolled backup factor and a named, audited recovery procedure that revokes affected sessions and never bypasses staff MFA. Lost-factor recovery and factor removal must pass before staff cutover.

## Migration sequence

| Slice | Work and validation | Completion gate |
| --- | --- | --- |
| MIG-1: Provider qualification | After provider selection, inspect free capacity; provision one synthetic Singapore identity project without paid add-ons. Verify OAuth first factor, real TOTP enrollment/challenge, wrong/stale codes, factor removal/recovery and live session-liveness checks using disposable accounts. Inspect factor timestamps across token refresh. | Actual Free-plan evidence supports recent MFA, bounded sessions and revocation; otherwise stop and revise the provider proposal. |
| MIG-2: Identity boundary | Refactor Clerk-specific route/UI imports behind verified-session and authentication UI adapters; keep Clerk selected. Add only the required additive mapping/session-policy migration and least-privilege functions. | Existing Clerk and ownership tests pass; missing/wrong provider configuration fails closed; migration retry and old-app schema compatibility pass. |
| MIG-3: Supabase integration | Add pinned SSR/client SDKs, OAuth callback, MFA enrollment/challenge, reauthentication, sign-out and recovery UI. Bind only project URL/publishable key and normal web runtime credentials; administrative synthetic provisioning remains operator-side. | Unit/contract tests reject invalid issuer/audience, replayed callback/state, forged roles, cross-origin writes and stale MFA. No secret/session leakage in assets or refreshed responses. |
| MIG-4: Hosted rehearsal | Select Supabase on a dedicated synthetic Preview; run two-account authorization, privileged MFA success/denial, same-session role removal, backend/local logout, expiry, privacy and linking/deletion tests. Repeat rollback with unchanged Neon learner IDs and deletion tombstones. | Exact-SHA CI and complete real hosted identity evidence; compatible rollback artifact/configuration identified. |
| MIG-5: Controlled cutover | A named owner reviews provider/security/recovery evidence and selects the cutover configuration. Expire old application sessions; require new sign-in/MFA. Link only verified accounts, monitor payload-free auth errors and retain the prior compatible artifact. | No mixed-provider fallback, loss of learner ownership or resurrection of deleted accounts. Retire Clerk only after the rollback/linking window closes. |

Rollback restores the approved provider configuration and compatible application artifact while retaining additive mappings and revocation/deletion records. Never erase new mappings, undo deletion state, or reactivate a session revoked during migration. If new-provider-only users cannot use the prior provider, pause their access and use a forward fix rather than inventing an identity link.

## Alternatives considered

- **Clerk paid MFA:** does not satisfy the $0 constraint. Keep Clerk development only for current synthetic staging.
- **Managed Neon Auth:** attractive because data is already on Neon, but its official capability matrix currently lists managed MFA as unavailable. Do not select a roadmap capability as working production MFA. [Neon capability matrix](https://github.com/neondatabase/agent-skills/blob/main/skills/neon-auth/SKILL.md).
- **Self-hosted identity:** avoids a provider MFA subscription but requires a qualified host, backup and operational ownership. No free always-on host is available; adding this service would not close that gap.
- **Application-owned TOTP beside Clerk:** would introduce seed storage, recovery, verification and session-binding responsibility. Prefer qualification of a managed Free TOTP provider before building an independent authentication system.

## Consequences

The proposal can remove the production MFA subscription requirement without rewriting the learning database. It adds another managed data boundary, identity SDK/UI work, verified account linking and explicit session/recovery controls. The additional identity store needs its own recovery and deletion-replay evidence. Free-tier identity backups, email delivery and inactivity behavior require qualification; free MFA alone does not make the full pilot ready. Hosted execution/workers, durable deletion recovery, curriculum rights, SLOs and the named readiness decision remain independent Phase 12 requirements.

## Verification

Planning is complete; MIG-1 through MIG-5 are not implemented. Check current pricing and feature behavior again before provisioning. Keep the [pilot readiness decision](../evidence/pilot-readiness.md) NOT READY until the original non-waivable gates pass. Record each slice's implementation, hosted validation, deferments and owner decisions separately.
