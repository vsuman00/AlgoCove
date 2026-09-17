import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness is intentionally independent of configuration and external services. */
export function GET(): NextResponse {
  return NextResponse.json(
    { ok: true, status: "live", service: "algocove-web" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
