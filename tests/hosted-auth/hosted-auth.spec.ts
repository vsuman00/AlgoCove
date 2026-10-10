import { createHmac, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { clerk, clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createPool } from "../../packages/db/src/connection.ts";
import { learnerIdForSubject } from "../../packages/db/src/identity-repository.ts";
import type { createClerkClient as ClerkFactory } from "../../apps/web/node_modules/@clerk/nextjs/server";

const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { createClerkClient } = require("@clerk/nextjs/server") as {
  createClerkClient: typeof ClerkFactory;
};
const provider = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

function fixturePool() {
  const pool = createPool({
    connectionString: process.env.DATABASE_TEST_OPERATOR_URL!,
    applicationName: "algocove-hosted-auth-fixtures",
    maxConnections: 1,
    statementTimeoutMs: 5000,
  });
  pool.on("error", () => undefined);
  return pool;
}

async function openDeployment(page: Page, baseURL: string) {
  await setupClerkTestingToken({ page });
  const bypass = process.env.HOSTED_AUTH_PROTECTION_BYPASS;
  if (bypass) await page.goto(`${baseURL}/?_vercel_share=${encodeURIComponent(bypass)}`);
  await page.goto("/");
  // An expired deployment access link must not hang while waiting for Clerk on Vercel's login page.
  expect(new URL(page.url()).origin).toBe(baseURL);
  await clerk.loaded({ page });
}

async function status(page: Page, path: string) {
  return page.evaluate(async (url) => (await fetch(url)).status, path);
}

async function cleanup(userId: string) {
  const pool = fixturePool();
  try {
    await provider.users.deleteUser(userId);
  } finally {
    try {
      await pool.query(
        `DELETE FROM platform.learner WHERE learner_id=$1
         AND EXISTS (SELECT 1 FROM platform.identity_account
           WHERE learner_id=$1 AND provider='clerk' AND provider_subject=$2)`,
        [learnerIdForSubject(`clerk:${userId}`), `clerk:${userId}`],
      );
    } finally {
      await pool.end();
    }
  }
}

// RFC 6238's SHA-1, six-digit, 30-second profile used by Clerk.
function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret].map((c) => alphabet.indexOf(c).toString(2).padStart(5, "0")).join("");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => Number.parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hash = createHmac("sha1", key).update(counter).digest();
  return ((hash.readUInt32BE(hash[19]! & 15) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

test.beforeAll(async () => {
  await clerkSetup();
});

test("real sign-in, privacy origin, unenrolled MFA, role removal and revocation", async ({
  page,
  baseURL,
  browser,
}) => {
  test.setTimeout(180_000);
  const email = `algocove-${randomBytes(8).toString("hex")}+clerk_test@example.com`;
  const password = `Test!${randomBytes(24).toString("hex")}`;
  const user = await provider.users.createUser({
    emailAddress: [email],
    username: `algocove_${randomBytes(8).toString("hex")}`,
    password,
  });
  try {
    await openDeployment(page, baseURL!);
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
    const privacy = await page.evaluate(async () => {
      const response = await fetch("/api/privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export", learnerId: "usr_untrusted_target" }),
      });
      return {
        status: response.status,
        cache: response.headers.get("cache-control"),
        body: await response.json(),
      };
    });
    expect(privacy.status).toBe(200);
    expect(privacy.cache).toBe("no-store");
    expect(privacy.body.account).toBe(session.body.user.id);
    const otherEmail = `algocove-${randomBytes(8).toString("hex")}+clerk_test@example.com`;
    const other = await provider.users.createUser({
      emailAddress: [otherEmail],
      username: `algocove_${randomBytes(8).toString("hex")}`,
      password: `Test!${randomBytes(24).toString("hex")}`,
    });
    const otherContext = await browser.newContext();
    try {
      const otherPage = await otherContext.newPage();
      await openDeployment(otherPage, baseURL!);
      await clerk.signIn({
        page: otherPage,
        signInParams: { strategy: "email_code", identifier: otherEmail },
      });
      await otherPage.reload();
      await clerk.loaded({ page: otherPage });
      const otherExport = await otherPage.evaluate(async (target) => {
        const response = await fetch("/api/privacy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "export", learnerId: target }),
        });
        return { status: response.status, body: await response.json() };
      }, session.body.user.id);
      expect(otherExport.status).toBe(200);
      expect(otherExport.body.account).toBe(learnerIdForSubject(`clerk:${other.id}`));
      expect(JSON.stringify(otherExport.body)).not.toContain(session.body.user.id);
      expect(JSON.stringify(privacy.body)).not.toContain(learnerIdForSubject(`clerk:${other.id}`));
    } finally {
      await otherContext.close();
      await cleanup(other.id);
    }
    // APIRequestContext can send an Origin that browser JavaScript cannot forge.
    const crossOrigin = await page.request.post(`${baseURL}/api/privacy`, {
      headers: { Origin: "https://unrelated.example" },
      data: { action: "export" },
    });
    expect(crossOrigin.status()).toBe(400);
    const pool = fixturePool();
    const providerSession = await page.evaluate(
      () => (window as unknown as { Clerk: { session: { id: string } } }).Clerk.session.id,
    );
    try {
      await pool.query("INSERT INTO platform.role_grant(learner_id,role) VALUES($1,'operator')", [
        session.body.user.id,
      ]);
      expect(await status(page, "/api/admin/operations")).toBe(403);
      expect(await status(page, "/api/review")).toBe(403);
      await pool.query(
        "UPDATE platform.role_grant SET revoked_at=clock_timestamp() WHERE learner_id=$1 AND role='operator'",
        [session.body.user.id],
      );
      expect(await status(page, "/api/review")).toBe(200);
      expect(await status(page, "/api/admin/operations")).toBe(403);
      expect(
        await page.evaluate(
          () => (window as unknown as { Clerk: { session: { id: string } } }).Clerk.session.id,
        ),
      ).toBe(providerSession);
    } finally {
      await pool.end();
    }
    await clerk.signOut({ page });
    const signedOut = await page.evaluate(async () => {
      const response = await fetch("/api/auth/session");
      return { status: response.status, body: await response.json() };
    });
    expect(signedOut.status).toBe(401);
    expect(signedOut.body.authenticated).toBe(false);
    await clerk.signIn({ page, signInParams: { strategy: "email_code", identifier: email } });
    const revokedId = await page.evaluate(
      () => (window as unknown as { Clerk: { session: { id: string } } }).Clerk.session.id,
    );
    await provider.sessions.revokeSession(revokedId);
    expect((await provider.sessions.getSession(revokedId)).status).toBe("revoked");
    // Existing short-lived JWTs may survive until refresh; require bounded rejection.
    await expect
      .poll(() => status(page, "/api/auth/session"), { timeout: 75_000, intervals: [1000, 5000] })
      .toBe(401);
  } finally {
    await cleanup(user.id);
  }
});

test("real TOTP permits operator access and role removal denies the active session", async ({
  page,
  baseURL,
}) => {
  const email = `algocove-${randomBytes(8).toString("hex")}+clerk_test@example.com`;
  const user = await provider.users.createUser({
    emailAddress: [email],
    username: `algocove_${randomBytes(8).toString("hex")}`,
    password: `Test!${randomBytes(24).toString("hex")}`,
  });
  try {
    await openDeployment(page, baseURL!);
    await clerk.signIn({ page, signInParams: { strategy: "email_code", identifier: email } });
    const secret = await page.evaluate(async () => {
      const user = (
        window as unknown as {
          Clerk: {
            user: {
              createTOTP(): Promise<{ secret: string }>;
            };
          };
        }
      ).Clerk.user;
      return (await user.createTOTP()).secret;
    });
    await page.evaluate(async (code) => {
      await (
        window as unknown as {
          Clerk: {
            user: {
              verifyTOTP(params: { code: string }): Promise<unknown>;
            };
          };
        }
      ).Clerk.user.verifyTOTP({ code });
    }, totp(secret));
    expect((await provider.users.getUser(user.id)).totpEnabled).toBe(true);
    await clerk.signOut({ page });
    const firstFactor = await page.evaluate(async (identifier) => {
      const signIn = (
        window as unknown as {
          Clerk: {
            client: {
              signIn: {
                create(params: { identifier: string }): Promise<{
                  supportedFirstFactors: { strategy: string; emailAddressId?: string }[];
                }>;
                prepareFirstFactor(params: {
                  strategy: "email_code";
                  emailAddressId: string;
                }): Promise<unknown>;
                attemptFirstFactor(params: {
                  strategy: "email_code";
                  code: string;
                }): Promise<{ status: string }>;
              };
            };
          };
        }
      ).Clerk.client.signIn;
      const result = await signIn.create({ identifier });
      const emailFactor = result.supportedFirstFactors.find((f) => f.strategy === "email_code");
      if (!emailFactor?.emailAddressId) throw Error("Email factor unavailable");
      await signIn.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId: emailFactor.emailAddressId,
      });
      return (await signIn.attemptFirstFactor({ strategy: "email_code", code: "424242" })).status;
    }, email);
    expect(firstFactor).toBe("needs_second_factor");
    expect(await status(page, "/api/admin/operations")).toBe(401);
    const completed = await page.evaluate(async (code) => {
      const client = (
        window as unknown as {
          Clerk: {
            client: {
              signIn: {
                attemptSecondFactor(params: {
                  strategy: "totp";
                  code: string;
                }): Promise<{ status: string; createdSessionId: string }>;
              };
            };
            setActive(params: { session: string }): Promise<unknown>;
          };
        }
      ).Clerk;
      const result = await client.client.signIn.attemptSecondFactor({ strategy: "totp", code });
      if (result.status === "complete")
        await client.setActive({ session: result.createdSessionId });
      return result.status;
    }, totp(secret));
    expect(completed).toBe("complete");
    await page.reload();
    await clerk.loaded({ page });
    expect(await status(page, "/api/auth/session")).toBe(200);
    const pool = fixturePool();
    try {
      await pool.query("INSERT INTO platform.role_grant(learner_id,role) VALUES($1,'operator')", [
        learnerIdForSubject(`clerk:${user.id}`),
      ]);
      expect(await status(page, "/api/admin/operations")).toBe(200);
      await pool.query(
        "UPDATE platform.role_grant SET revoked_at=clock_timestamp() WHERE learner_id=$1 AND role='operator'",
        [learnerIdForSubject(`clerk:${user.id}`)],
      );
      expect(await status(page, "/api/admin/operations")).toBe(403);
    } finally {
      await pool.end();
    }
  } finally {
    await cleanup(user.id);
  }
});

test("deployed learner pages pass bounded accessibility and mobile reflow checks", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(120_000);
  await openDeployment(page, baseURL!);
  for (const path of ["/", "/learn", "/sheets", "/review"]) {
    await page.goto(path);
    await clerk.loaded({ page });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations.map((v) => ({ id: v.id, impact: v.impact }))).toEqual([]);
    await page.setViewportSize({ width: 320, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
});
