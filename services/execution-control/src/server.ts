import { err } from "@algocove/domain";
import { requireInternalAuthentication, type InternalAuthenticator } from "./auth.ts";
import type { ExecutionControl } from "./lifecycle.ts";
import { controlFailure } from "./types.ts";
import type {
  ControlResult,
  ExecutionControlRequest,
  ExecutionControlResponse,
  InternalOperation,
  InternalPrincipal,
} from "./types.ts";

const ALLOWED_PRINCIPALS: Readonly<
  Record<InternalOperation["kind"], readonly InternalPrincipal[]>
> = {
  admit: ["application-relay"],
  cancel: ["application-relay"],
  lease_next: ["execution-worker"],
  mark_running: ["execution-worker"],
  heartbeat: ["execution-worker"],
  worker_lost: ["execution-worker"],
  record_result: ["execution-worker"],
  confirm_teardown: ["execution-worker"],
  teardown_failed: ["execution-worker"],
  reconcile: ["execution-operator"],
};

export type ExecutionControlServer = {
  readonly handle: (
    request: ExecutionControlRequest,
  ) => Promise<ControlResult<ExecutionControlResponse>>;
};

export function createExecutionControlServer(
  control: ExecutionControl,
  authenticator: InternalAuthenticator,
): ExecutionControlServer {
  return {
    async handle(request): Promise<ControlResult<ExecutionControlResponse>> {
      if (request.source === "browser") {
        return err(controlFailure("browser_forbidden", "Execution control is internal-only."));
      }
      const authenticated = requireInternalAuthentication(
        authenticator,
        request.principal,
        request.token,
      );
      if (!authenticated.ok) return authenticated;
      if (!ALLOWED_PRINCIPALS[request.operation.kind].includes(request.principal)) {
        return err(
          controlFailure(
            "operation_forbidden",
            "Internal principal is not allowed for this operation.",
          ),
        );
      }
      return dispatch(control, request.operation);
    },
  };
}

function dispatch(
  control: ExecutionControl,
  operation: InternalOperation,
): ControlResult<ExecutionControlResponse> {
  switch (operation.kind) {
    case "admit":
      return control.admit(operation);
    case "lease_next":
      return control.leaseNext(operation);
    case "mark_running":
      return control.markRunning(operation);
    case "heartbeat":
      return control.heartbeat(operation);
    case "worker_lost":
      return control.workerLost(operation);
    case "record_result":
      return control.recordResult(operation);
    case "confirm_teardown":
      return control.confirmTeardown(operation);
    case "teardown_failed":
      return control.teardownFailed(operation);
    case "cancel":
      return control.cancel(operation);
    case "reconcile":
      return control.reconcile(operation.now);
  }
}
