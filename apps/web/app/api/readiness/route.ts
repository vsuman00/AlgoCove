import { loadConfigFromProcess } from "@algocove/config";
import { probeDatabase } from "@algocove/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ReadinessPayload = {
  readonly ok: boolean;
  readonly status: "ready" | "not_ready";
  readonly checks: {
    readonly configuration: "ok" | "failed";
    readonly database: "ok" | "unconfigured" | "unreachable" | "schema_missing";
  };
};

function response(payload: ReadinessPayload, status: 200 | 503): NextResponse<ReadinessPayload> {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Readiness requires valid runtime configuration and a reachable migrated database. */
export async function GET(): Promise<NextResponse<ReadinessPayload>> {
  let config: ReturnType<typeof loadConfigFromProcess>;
  try {
    config = loadConfigFromProcess();
  } catch {
    return response(
      {
        ok: false,
        status: "not_ready",
        checks: { configuration: "failed", database: "unconfigured" },
      },
      503,
    );
  }

  if (config.database.runtimeUrl === null) {
    return response(
      {
        ok: false,
        status: "not_ready",
        checks: { configuration: "ok", database: "unconfigured" },
      },
      503,
    );
  }

  const database = await probeDatabase({
    connectionString: config.database.runtimeUrl.reveal(),
    applicationName: config.serviceName,
    maxConnections: 1,
    statementTimeoutMs: config.database.statementTimeoutMs,
  });

  if (!database.ok) {
    return response(
      {
        ok: false,
        status: "not_ready",
        checks: { configuration: "ok", database: database.reason },
      },
      503,
    );
  }

  return response(
    {
      ok: true,
      status: "ready",
      checks: { configuration: "ok", database: "ok" },
    },
    200,
  );
}
