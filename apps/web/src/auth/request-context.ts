import { randomBytes } from "node:crypto";
import {
  createRequestContext,
  createSystemClock,
  type Actor,
  type IdGenerator,
  type RequestContext,
} from "@algocove/application";
import { formatId } from "@algocove/domain";

const randomIds: IdGenerator = {
  generate<TKind extends Parameters<typeof formatId>[0]>(kind: TKind) {
    const result = formatId(kind, randomBytes(20).toString("hex"));
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  },
};

export function createWebRequestContext(actor: Actor, traceId?: string): RequestContext {
  return createRequestContext({
    actor,
    clock: createSystemClock(),
    ids: randomIds,
    serviceName: process.env.SERVICE_NAME ?? "algocove-web",
    ...(traceId === undefined ? {} : { traceId }),
  });
}
