import { randomBytes } from "node:crypto";
import {
  createRequestContext,
  TRACE_ID_PATTERN,
  createSystemClock,
  type Actor,
  type IdGenerator,
  type RequestContext,
} from "@algocove/application";
import { formatId } from "@algocove/domain";
import { getClerkIdentityAdapter } from "./clerk-adapter";
import { isClerkConfigured } from "./clerk-config";
import { auth } from "./clerk-server";
import { rememberTelemetryContext } from "../operations/telemetry";
import { requireHostedPrivilegedSession } from "./privileged-session";

const randomIds: IdGenerator = {
  generate<TKind extends Parameters<typeof formatId>[0]>(kind: TKind) {
    const result = formatId(kind, randomBytes(20).toString("hex"));
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  },
};

const requestTraces = new WeakMap<Request, string>();
/** Reuse correlation across safe logs and responses, including failures before authentication. */
export function webTraceId(request: Request): string {
  const existing = requestTraces.get(request);
  if (existing !== undefined) return existing;
  const supplied = request.headers.get("x-trace-id");
  const trace =
    supplied !== null &&
    TRACE_ID_PATTERN.test(supplied) &&
    /^(?:req|trace|request)[_-][0-9a-hjkmnp-tv-z]{8,64}$/.test(supplied)
      ? supplied
      : randomIds.generate("request");
  requestTraces.set(request, trace);
  return trace;
}

export function createWebRequestContext(actor: Actor, traceId?: string): RequestContext {
  return createRequestContext({
    actor,
    clock: createSystemClock(),
    ids: randomIds,
    serviceName: process.env.SERVICE_NAME ?? "algocove-web",
    ...(traceId === undefined ? {} : { traceId }),
  });
}

export async function authenticatedWebRequestContext(
  request: Request,
  options: { allowDeletionPending?: boolean } = {},
): Promise<RequestContext> {
  const clerkAuth = isClerkConfigured()
    ? await auth()
    : { isAuthenticated: false, userId: null, sessionId: null };
  const actor = await getClerkIdentityAdapter().authenticate({
    isAuthenticated: clerkAuth.isAuthenticated,
    userId: clerkAuth.userId,
    sessionId: clerkAuth.sessionId,
    allowDeletionPending: options.allowDeletionPending === true,
  });
  requireHostedPrivilegedSession(
    actor.roles,
    "factorVerificationAge" in clerkAuth ? clerkAuth.factorVerificationAge : null,
  );
  const context = createWebRequestContext(actor, webTraceId(request));
  rememberTelemetryContext(request, context);
  return context;
}
