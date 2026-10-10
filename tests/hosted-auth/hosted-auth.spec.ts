import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { clerk, clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";
import { createPool } from "../../packages/db/src/connection.ts";
import { learnerIdForSubject } from "../../packages/db/src/identity-repository.ts";
import type { createClerkClient as ClerkFactory } from "../../apps/web/node_modules/@clerk/nextjs/server";

const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { createClerkClient } = require("@clerk/nextjs/server") as {
  createClerkClient: typeof ClerkFactory;
};
const provider = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

test.beforeAll(async () => {
  await clerkSetup();
});

test("real email-code sign-in, application session and sign-out", async ({ page, baseURL }) => {
  const email = `algocove-${randomBytes(8).toString("hex")}+clerk_test@example.com`;
  const password = `Test!${randomBytes(24).toString("hex")}`;
  const user = await provider.users.createUser({
    emailAddress: [email],
    username: `algocove_${randomBytes(8).toString("hex")}`,
    password,
  });
  try {
    await setupClerkTestingToken({ page });
    const bypass = process.env.HOSTED_AUTH_PROTECTION_BYPASS;
    if (bypass) await page.goto(`${baseURL}/?_vercel_share=${encodeURIComponent(bypass)}`);
    await page.goto("/");
    await clerk.signIn({
      page,
      signInParams: { strategy: "email_code", identifier: email },
    });
    await page.reload();
    await clerk.loaded({ page });
    const session = await page.evaluate(async () => {
      const response = await fetch("/api/auth/session");
      return { status: response.status, body: await response.json() };
    });
    if (session.status !== 200) {
      const diagnostic = await page.evaluate(async () => {
        const client = (
          window as unknown as {
            Clerk: { session: { getToken(): Promise<string | null> } | null; user: unknown };
          }
        ).Clerk;
        const token = await client.session?.getToken();
        const response = await fetch("/api/auth/session", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        return {
          providerSession: Boolean(client.session),
          providerUser: Boolean(client.user),
          providerToken: Boolean(token),
          bearerStatus: response.status,
        };
      });
      console.log(JSON.stringify({ authenticationDiagnostic: diagnostic }));
    }
    expect(session.status).toBe(200);
    expect(session.body.authenticated).toBe(true);
    expect(session.body.user.roles).toEqual(["learner"]);
    await clerk.signOut({ page });
    const signedOut = await page.evaluate(async () => {
      const response = await fetch("/api/auth/session");
      return { status: response.status, body: await response.json() };
    });
    expect(signedOut.status).toBe(401);
    expect(signedOut.body.authenticated).toBe(false);
  } finally {
    // Only the provider account created in this test is eligible for cleanup.
    await provider.users.deleteUser(user.id);
    const pool = createPool({
      connectionString: process.env.DATABASE_TEST_OPERATOR_URL!,
      applicationName: "algocove-hosted-auth-fixture-cleanup",
      maxConnections: 1,
      statementTimeoutMs: 5000,
    });
    pool.on("error", () => undefined);
    try {
      await pool.query(
        `DELETE FROM platform.learner WHERE learner_id=$1
         AND EXISTS (SELECT 1 FROM platform.identity_account
           WHERE learner_id=$1 AND provider='clerk' AND provider_subject=$2)`,
        [learnerIdForSubject(`clerk:${user.id}`), `clerk:${user.id}`],
      );
    } finally {
      await pool.end();
    }
  }
});
