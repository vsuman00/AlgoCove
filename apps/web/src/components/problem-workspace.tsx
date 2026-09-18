"use client";

import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import type { ProblemLanguage } from "@algocove/domain";
import TraceRenderer from "./trace-renderer";

const LANGUAGES: readonly { readonly value: ProblemLanguage; readonly label: string }[] = [
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "c", label: "C" },
];

const PSEUDOCODE_FIELDS = [
  ["inputs", "Inputs"],
  ["state", "State"],
  ["initialization", "Initialization"],
  ["invariant", "Invariant"],
  ["loop", "Loop"],
  ["termination", "Termination"],
  ["output", "Output"],
  ["complexity", "Complexity"],
] as const;

const STARTERS: Record<ProblemLanguage, string> = {
  python:
    "def max_area(heights):\n    left, right = 0, len(heights) - 1\n    best = 0\n    # move the shorter boundary\n    return best",
  javascript:
    "function maxArea(heights) {\n  let left = 0;\n  let right = heights.length - 1;\n  let best = 0;\n  return best;\n}",
  typescript:
    "function maxArea(heights: number[]): number {\n  let left = 0;\n  let right = heights.length - 1;\n  let best = 0;\n  return best;\n}",
  java: "static int maxArea(int[] heights) {\n    int left = 0, right = heights.length - 1;\n    int best = 0;\n    return best;\n}",
  cpp: "int maxArea(const vector<int>& heights) {\n  int left = 0, right = heights.size() - 1;\n  int best = 0;\n  return best;\n}",
  c: "int max_area(const int heights[], int length) {\n  int left = 0, right = length - 1;\n  int best = 0;\n  return best;\n}",
};

const REFERENCE_TRACE = {
  schemaVersion: 1,
  traceId: "arrays-two-pointer-reference",
  version: 1,
  provenance: "authored_reference",
  structure: "array_two_pointer",
  initialValues: [1, 8, 6, 2, 5, 4, 8, 3, 7],
  events: [
    { kind: "compare", left: 0, right: 8 },
    { kind: "mark_answer", left: 1, right: 8 },
    { kind: "move_left" },
    { kind: "compare", left: 1, right: 8 },
    { kind: "mark_answer", left: 1, right: 8 },
    { kind: "move_right" },
    { kind: "complete" },
  ],
} as const;

const RECOVERY_KEY = "algocove:workspace-recovery:arrays-two-pointer";

type PseudocodeState = Record<(typeof PSEUDOCODE_FIELDS)[number][0], string>;
type RecoverySnapshot = { readonly source: string; readonly pseudocode: PseudocodeState };
type RemoteWorkspace = {
  readonly language: ProblemLanguage;
  readonly attemptId: string;
  readonly sourceDraftId: string;
  readonly sourceVersion: number;
  readonly pseudocodeId: string;
  readonly pseudocodeVersion: number;
  readonly firstHintId: string;
  readonly lastSource: string;
  readonly lastPseudocode: PseudocodeState;
};
type WorkspaceState = {
  readonly language: ProblemLanguage;
  readonly source: string;
  readonly pseudocode: PseudocodeState;
};
type RecoveryState = "local" | "saving" | "saved" | "server_pending" | "sign_in";
type SessionState = "checking" | "signed_out" | "authenticated";
type ExecutionTerminalCategory =
  | "pass"
  | "wrong_answer"
  | "compile_error"
  | "type_error"
  | "runtime_error"
  | "limits"
  | "cancelled"
  | "infrastructure_error";
type ExecutionClassification =
  "success" | "learner_failure" | "infrastructure_failure" | "control_plane";
type ExecutionState =
  | { readonly kind: "idle" }
  | { readonly kind: "requesting" }
  | { readonly kind: "queued"; readonly runId: string }
  | { readonly kind: "cancelling"; readonly runId: string }
  | {
      readonly kind: "completed";
      readonly runId: string;
      readonly terminalCategory: ExecutionTerminalCategory;
      readonly classification: ExecutionClassification;
      readonly passed: boolean;
    }
  | { readonly kind: "unavailable" };

const EMPTY_PSEUDOCODE: PseudocodeState = {
  inputs: "",
  state: "",
  initialization: "",
  invariant: "",
  loop: "",
  termination: "",
  output: "",
  complexity: "",
};

export default function ProblemWorkspace({
  executionEnabled,
  problemId = "arrays-two-pointer",
}: {
  readonly executionEnabled: boolean;
  readonly problemId?: string;
}): ReactElement {
  const [workspace, setWorkspace] = useState<WorkspaceState>({
    language: "python",
    source: STARTERS.python,
    pseudocode: EMPTY_PSEUDOCODE,
  });
  const [saveState, setSaveState] = useState<RecoveryState>("local");
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [learnerId, setLearnerId] = useState<string | null>(null);
  const [hintState, setHintState] = useState("No hint revealed. Start with your invariant.");
  const [executionState, setExecutionState] = useState<ExecutionState>({ kind: "idle" });
  const remoteWorkspace = useRef<RemoteWorkspace | null>(null);
  const syncQueue = useRef<Promise<void>>(Promise.resolve());
  const latestSync = useRef(0);
  const { language, source, pseudocode } = workspace;

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          if (!cancelled) {
            setSessionState("signed_out");
            setSaveState("sign_in");
          }
          return;
        }
        const body = (await response.json()) as {
          readonly authenticated?: boolean;
          readonly user?: { readonly id?: string };
        };
        const authenticated = body.authenticated === true && typeof body.user?.id === "string";
        if (cancelled) return;
        if (!authenticated) {
          setSessionState("signed_out");
          setSaveState("sign_in");
          return;
        }
        const nextLearnerId = body.user.id;
        setLearnerId(nextLearnerId);
        setSessionState("authenticated");
        const recovery = readRecovery(nextLearnerId, "python");
        if (recovery !== null) setWorkspace({ language: "python", ...recovery });
      })
      .catch(() => {
        if (!cancelled) {
          setSessionState("signed_out");
          setSaveState("sign_in");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (sessionState !== "authenticated" || learnerId === null) return;
    let cancelled = false;
    void fetch("/api/practice/workspace", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId, language }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("workspace_sync_unavailable");
        const body = (await response.json()) as {
          readonly sourceDraft?: {
            readonly draftId?: string;
            readonly version?: number;
            readonly currentRevision?: number;
            readonly currentText?: string;
          };
          readonly pseudocode?: {
            readonly pseudocodeId?: string;
            readonly version?: number;
            readonly current?: PseudocodeState;
          };
          readonly activeRun?: {
            readonly runId?: unknown;
            readonly status?: unknown;
            readonly result?: {
              readonly resultId?: unknown;
              readonly terminalCategory?: unknown;
              readonly classification?: unknown;
              readonly passed?: unknown;
            } | null;
          } | null;
          readonly attempt?: { readonly attemptId?: string };
          readonly starterTemplate?: string;
          readonly firstHintId?: string;
        };
        const sourceDraft = body.sourceDraft;
        const pseudocodeArtifact = body.pseudocode;
        if (
          typeof sourceDraft?.draftId !== "string" ||
          typeof sourceDraft.version !== "number" ||
          typeof sourceDraft.currentRevision !== "number" ||
          typeof sourceDraft.currentText !== "string" ||
          typeof pseudocodeArtifact?.pseudocodeId !== "string" ||
          typeof pseudocodeArtifact.version !== "number" ||
          pseudocodeArtifact.current === undefined ||
          typeof body.attempt?.attemptId !== "string" ||
          typeof body.starterTemplate !== "string" ||
          typeof body.firstHintId !== "string"
        ) {
          throw new Error("workspace_sync_contract_invalid");
        }
        if (cancelled) return;
        remoteWorkspace.current = {
          language,
          attemptId: body.attempt.attemptId,
          sourceDraftId: sourceDraft.draftId,
          sourceVersion: sourceDraft.version,
          pseudocodeId: pseudocodeArtifact.pseudocodeId,
          pseudocodeVersion: pseudocodeArtifact.version,
          firstHintId: body.firstHintId,
          lastSource: sourceDraft.currentText,
          lastPseudocode: { ...EMPTY_PSEUDOCODE, ...pseudocodeArtifact.current },
        };
        setWorkspace({
          language,
          source:
            sourceDraft.currentRevision === 0 ? body.starterTemplate : sourceDraft.currentText,
          pseudocode: { ...EMPTY_PSEUDOCODE, ...pseudocodeArtifact.current },
        });
        const recoveredExecution = executionStateFromRemote(body.activeRun);
        setExecutionState(recoveredExecution ?? { kind: "idle" });
        setSaveState("saved");
      })
      .catch(() => {
        if (!cancelled && remoteWorkspace.current?.language === language) {
          remoteWorkspace.current = null;
          setSaveState("server_pending");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [language, learnerId, problemId, sessionState]);

  useEffect(() => {
    if (sessionState !== "authenticated" || learnerId === null) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(
        recoveryKey(learnerId, language),
        JSON.stringify({ source, pseudocode }),
      );
      const remote = remoteWorkspace.current;
      if (remote === null || remote.language !== language) {
        setSaveState("saved");
        return;
      }

      const sourceChanged = source !== remote.lastSource;
      const pseudocodeChanged = !samePseudocode(pseudocode, remote.lastPseudocode);
      if (!sourceChanged && !pseudocodeChanged) {
        setSaveState("saved");
        return;
      }
      setSaveState("saving");
      const syncId = latestSync.current + 1;
      latestSync.current = syncId;
      syncQueue.current = syncQueue.current
        .catch(() => undefined)
        .then(async () => {
          const currentRemote = remoteWorkspace.current;
          if (currentRemote === null || currentRemote.language !== language) return;
          try {
            const next = await syncRemoteDrafts({
              remote: currentRemote,
              source,
              pseudocode,
            });
            remoteWorkspace.current = next;
            if (syncId === latestSync.current) setSaveState("saved");
          } catch {
            if (syncId === latestSync.current) setSaveState("server_pending");
          }
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [language, learnerId, pseudocode, sessionState, source]);

  const queuedRunId = executionState.kind === "queued" ? executionState.runId : null;

  useEffect(() => {
    if (queuedRunId === null) return;
    let cancelled = false;
    let timer: number | undefined;

    const poll = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/practice/runs/${encodeURIComponent(queuedRunId)}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) throw new Error("execution_status_failed");
        const body = (await response.json()) as {
          readonly status?: unknown;
          readonly result?: {
            readonly resultId?: unknown;
            readonly terminalCategory?: unknown;
            readonly classification?: unknown;
            readonly passed?: unknown;
          } | null;
        };
        if (body.status === "queued") {
          if (!cancelled) timer = window.setTimeout(() => void poll(), 500);
          return;
        }
        if (body.status !== "completed" || !isExecutionResult(body.result)) {
          throw new Error("execution_status_contract_invalid");
        }
        if (!cancelled) {
          setExecutionState({
            kind: "completed",
            runId: queuedRunId,
            terminalCategory: body.result.terminalCategory,
            classification: body.result.classification,
            passed: body.result.passed,
          });
        }
      } catch {
        if (!cancelled) setExecutionState({ kind: "unavailable" });
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [queuedRunId]);

  const saveLabel = useMemo(
    () =>
      saveState === "saving"
        ? "Saving local recovery…"
        : saveState === "saved"
          ? "Local recovery saved"
          : saveState === "server_pending"
            ? "Local recovery saved · server sync pending"
            : saveState === "sign_in"
              ? "Sign in for private recovery"
              : sessionState === "checking"
                ? "Checking private recovery…"
                : "Local recovery ready",
    [saveState, sessionState],
  );
  const executionLabel =
    executionState.kind === "requesting"
      ? "Requesting trusted execution…"
      : executionState.kind === "queued"
        ? "Execution queued · awaiting trusted result"
        : executionState.kind === "cancelling"
          ? "Cancellation requested · awaiting trusted result"
          : executionState.kind === "completed"
            ? `Execution complete · ${executionCategoryLabel(executionState.terminalCategory)}`
            : executionState.kind === "unavailable"
              ? "Execution unavailable · no result was simulated"
              : null;

  const updatePseudocode = (field: keyof PseudocodeState, value: string): void => {
    setSaveState("saving");
    setWorkspace((current) => ({
      ...current,
      pseudocode: { ...current.pseudocode, [field]: value },
    }));
  };

  const updateSource = (value: string): void => {
    setSaveState("saving");
    setExecutionState({ kind: "idle" });
    setWorkspace((current) => ({ ...current, source: value }));
  };

  const changeLanguage = (nextLanguage: ProblemLanguage): void => {
    setSaveState(sessionState === "authenticated" ? "saving" : "sign_in");
    setExecutionState({ kind: "idle" });
    setWorkspace({
      language: nextLanguage,
      source: STARTERS[nextLanguage],
      pseudocode: EMPTY_PSEUDOCODE,
      ...(learnerId === null ? {} : (readRecovery(learnerId, nextLanguage) ?? {})),
    });
  };

  return (
    <main className="ac-workspace" id="main-content" tabIndex={-1}>
      <header className="ac-workspace__hero">
        <div>
          <p className="ac-eyebrow">Guided practice · arrays and pointers</p>
          <h1>Container with most water</h1>
          <p>
            Build the invariant first, inspect the reviewed trace, then validate your own solution
            when the execution gate is available.
          </p>
        </div>
        <aside className="ac-workspace__status" aria-label="Workspace status">
          <strong>Practice attempt</strong>
          <span>Private recovery · {saveLabel}</span>
          <span>Run results are never simulated in the browser.</span>
          {executionLabel !== null ? <span role="status">{executionLabel}</span> : null}
        </aside>
      </header>

      <ol className="ac-workspace__path" aria-label="Guided problem path">
        {[
          ["1", "Understand", true],
          ["2", "Pseudocode", true],
          ["3", "Trace", true],
          ["4", "Implement", true],
          ["5", "Validate", false],
        ].map(([step, label, complete]) => (
          <li className={complete ? "is-complete" : "is-current"} key={label as string}>
            <span>{step}</span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>

      <div className="ac-workspace__grid">
        <section className="ac-panel ac-workspace__panel" aria-labelledby="prompt-title">
          <p className="ac-eyebrow">Problem</p>
          <h2 id="prompt-title">Choose two lines that hold the most water.</h2>
          <p>
            Given an array of heights, return the maximum area formed by two vertical lines and the
            x-axis. The container must keep its sides in the original order.
          </p>
          <dl className="ac-workspace__facts">
            <div>
              <dt>Input</dt>
              <dd>Positive integer heights</dd>
            </div>
            <div>
              <dt>Output</dt>
              <dd>Maximum contained area</dd>
            </div>
            <div>
              <dt>Target</dt>
              <dd>O(n) time · O(1) space</dd>
            </div>
          </dl>
        </section>

        <section className="ac-panel ac-workspace__panel" aria-labelledby="pseudocode-title">
          <div className="ac-panel-heading">
            <div>
              <p className="ac-eyebrow">Structured reasoning</p>
              <h2 id="pseudocode-title">Pseudocode checkpoint</h2>
            </div>
            <span className="ac-status-pill is-now">Draft</span>
          </div>
          <p className="ac-workspace__muted">
            Each field is saved as a bounded current snapshot. Explicit revisions and readiness
            checks happen at the trusted application boundary.
          </p>
          <div className="ac-workspace__fields">
            {PSEUDOCODE_FIELDS.map(([field, label]) => (
              <label key={field}>
                <span>{label}</span>
                <textarea
                  aria-label={label}
                  value={pseudocode[field]}
                  onChange={(event) => updatePseudocode(field, event.target.value)}
                  rows={2}
                />
              </label>
            ))}
          </div>
        </section>

        <section
          className="ac-panel ac-workspace__panel ac-workspace__panel--wide"
          aria-labelledby="trace-workspace-title"
        >
          <p className="ac-eyebrow">Visual reasoning</p>
          <h2 id="trace-workspace-title">Step through the reviewed trace</h2>
          <TraceRenderer trace={REFERENCE_TRACE} />
        </section>

        <section className="ac-panel ac-workspace__panel" aria-labelledby="editor-title">
          <div className="ac-panel-heading">
            <div>
              <p className="ac-eyebrow">Implementation</p>
              <h2 id="editor-title">Write your solution</h2>
            </div>
            <label className="ac-workspace__language">
              <span className="ac-sr-only">Language</span>
              <select
                aria-label="Implementation language"
                value={language}
                onChange={(event) => changeLanguage(event.target.value as ProblemLanguage)}
              >
                {LANGUAGES.map((candidate) => (
                  <option key={candidate.value} value={candidate.value}>
                    {candidate.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <textarea
            aria-label={`${LANGUAGES.find((candidate) => candidate.value === language)?.label ?? "Code"} source`}
            className="ac-workspace__editor"
            spellCheck={false}
            value={source}
            onChange={(event) => updateSource(event.target.value)}
            rows={14}
          />
          <div className="ac-button-row">
            <button
              className="ac-button ac-button--primary"
              disabled={!executionEnabled || executionState.kind === "requesting"}
              onClick={() =>
                void requestExecution(
                  remoteWorkspace.current,
                  sessionState,
                  "run",
                  source,
                  setExecutionState,
                )
              }
              type="button"
            >
              Run checks
            </button>
            <button
              className="ac-button ac-button--secondary"
              disabled={!executionEnabled || executionState.kind === "requesting"}
              onClick={() =>
                void requestExecution(
                  remoteWorkspace.current,
                  sessionState,
                  "submit",
                  source,
                  setExecutionState,
                )
              }
              type="button"
            >
              Submit attempt
            </button>
          </div>
          {executionState.kind === "queued" || executionState.kind === "cancelling" ? (
            <button
              className="ac-small-button"
              disabled={executionState.kind === "cancelling"}
              onClick={() =>
                void requestExecutionCancellation(
                  executionState.runId,
                  sessionState,
                  setExecutionState,
                )
              }
              type="button"
            >
              Cancel execution
            </button>
          ) : null}
          {!executionEnabled ? (
            <p className="ac-note ac-note--info" role="status">
              {
                "Execution is unavailable: the security-owner sandbox gate is still open. No result is being simulated."
              }
            </p>
          ) : null}
        </section>

        <aside className="ac-panel ac-workspace__panel" aria-labelledby="hint-title">
          <p className="ac-eyebrow">Deterministic coaching</p>
          <h2 id="hint-title">Need a nudge?</h2>
          <p>{hintState}</p>
          <button
            className="ac-small-button ac-small-button--filled"
            onClick={() => void requestHint(remoteWorkspace.current, sessionState, setHintState)}
            type="button"
          >
            Request clarification hint
          </button>
          <p className="ac-workspace__muted">
            The authored hint endpoint must persist exposure before revealing the next tier. This
            workspace does not preload locked hint content or invent a server acknowledgement.
          </p>
        </aside>
      </div>
    </main>
  );
}

async function syncRemoteDrafts(input: {
  readonly remote: RemoteWorkspace;
  readonly source: string;
  readonly pseudocode: PseudocodeState;
}): Promise<RemoteWorkspace> {
  let sourceVersion = input.remote.sourceVersion;
  let pseudocodeVersion = input.remote.pseudocodeVersion;
  if (input.source !== input.remote.lastSource) {
    const response = await fetch(`/api/practice/drafts/${input.remote.sourceDraftId}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: sourceVersion, text: input.source }),
    });
    if (!response.ok) throw new Error("source_sync_failed");
    const body = (await response.json()) as { readonly draft?: { readonly version?: number } };
    if (typeof body.draft?.version !== "number") throw new Error("source_sync_contract_invalid");
    sourceVersion = body.draft.version;
  }
  if (!samePseudocode(input.pseudocode, input.remote.lastPseudocode)) {
    const response = await fetch(`/api/practice/pseudocode/${input.remote.pseudocodeId}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: pseudocodeVersion, fields: input.pseudocode }),
    });
    if (!response.ok) throw new Error("pseudocode_sync_failed");
    const body = (await response.json()) as {
      readonly artifact?: { readonly version?: number };
    };
    if (typeof body.artifact?.version !== "number") {
      throw new Error("pseudocode_sync_contract_invalid");
    }
    pseudocodeVersion = body.artifact.version;
  }
  return {
    ...input.remote,
    sourceVersion,
    pseudocodeVersion,
    lastSource: input.source,
    lastPseudocode: input.pseudocode,
  };
}

async function requestHint(
  remote: RemoteWorkspace | null,
  sessionState: SessionState,
  setHintState: (value: string) => void,
): Promise<void> {
  const pendingMessage =
    "Hint request is pending. The authored hint body will appear only after the authenticated exposure endpoint acknowledges it.";
  if (sessionState !== "authenticated" || remote === null) {
    setHintState(pendingMessage);
    return;
  }
  try {
    const response = await fetch("/api/practice/hints", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attemptId: remote.attemptId,
        hintId: remote.firstHintId,
        requestedTier: 1,
        idempotencyKey: `workspace-hint-${remote.attemptId}-${remote.language}`,
      }),
    });
    if (!response.ok) throw new Error("hint_request_failed");
    const body = (await response.json()) as {
      readonly hint?: { readonly body?: string };
    };
    if (typeof body.hint?.body !== "string") throw new Error("hint_contract_invalid");
    setHintState(body.hint.body);
  } catch {
    setHintState(pendingMessage);
  }
}

async function requestExecution(
  remote: RemoteWorkspace | null,
  sessionState: SessionState,
  mode: "run" | "submit",
  source: string,
  setExecutionState: (state: ExecutionState) => void,
): Promise<void> {
  if (sessionState !== "authenticated" || remote === null) {
    setExecutionState({ kind: "unavailable" });
    return;
  }
  setExecutionState({ kind: "requesting" });
  try {
    const response = await fetch("/api/practice/runs", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId: remote.attemptId, mode, source }),
    });
    if (!response.ok) throw new Error("execution_request_failed");
    const body = (await response.json()) as { readonly status?: unknown; readonly runId?: unknown };
    if (body.status !== "queued" || typeof body.runId !== "string") {
      throw new Error("execution_request_contract_invalid");
    }
    setExecutionState({ kind: "queued", runId: body.runId });
  } catch {
    setExecutionState({ kind: "unavailable" });
  }
}

async function requestExecutionCancellation(
  runId: string,
  sessionState: SessionState,
  setExecutionState: (state: ExecutionState) => void,
): Promise<void> {
  if (sessionState !== "authenticated") {
    setExecutionState({ kind: "unavailable" });
    return;
  }
  setExecutionState({ kind: "cancelling", runId });
  try {
    const response = await fetch(`/api/practice/runs/${encodeURIComponent(runId)}/cancel`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error("execution_cancel_failed");
    const body = (await response.json()) as { readonly status?: unknown; readonly runId?: unknown };
    if (body.status !== "cancellation_requested" || body.runId !== runId) {
      throw new Error("execution_cancel_contract_invalid");
    }
    setExecutionState({ kind: "queued", runId });
  } catch {
    setExecutionState({ kind: "unavailable" });
  }
}

function isExecutionResult(
  value:
    | {
        readonly resultId?: unknown;
        readonly terminalCategory?: unknown;
        readonly classification?: unknown;
        readonly passed?: unknown;
      }
    | null
    | undefined,
): value is {
  readonly resultId: string;
  readonly terminalCategory: ExecutionTerminalCategory;
  readonly classification: ExecutionClassification;
  readonly passed: boolean;
} {
  return (
    value !== null &&
    value !== undefined &&
    typeof value.resultId === "string" &&
    isExecutionTerminalCategory(value.terminalCategory) &&
    isExecutionClassification(value.classification) &&
    typeof value.passed === "boolean"
  );
}

function executionStateFromRemote(
  value:
    | {
        readonly runId?: unknown;
        readonly status?: unknown;
        readonly result?: {
          readonly resultId?: unknown;
          readonly terminalCategory?: unknown;
          readonly classification?: unknown;
          readonly passed?: unknown;
        } | null;
      }
    | null
    | undefined,
): ExecutionState | null {
  if (value === null || value === undefined || typeof value.runId !== "string") return null;
  if (value.status === "queued") return { kind: "queued", runId: value.runId };
  if (value.status !== "completed" || !isExecutionResult(value.result)) return null;
  return {
    kind: "completed",
    runId: value.runId,
    terminalCategory: value.result.terminalCategory,
    classification: value.result.classification,
    passed: value.result.passed,
  };
}

function isExecutionTerminalCategory(value: unknown): value is ExecutionTerminalCategory {
  return (
    value === "pass" ||
    value === "wrong_answer" ||
    value === "compile_error" ||
    value === "type_error" ||
    value === "runtime_error" ||
    value === "limits" ||
    value === "cancelled" ||
    value === "infrastructure_error"
  );
}

function isExecutionClassification(value: unknown): value is ExecutionClassification {
  return (
    value === "success" ||
    value === "learner_failure" ||
    value === "infrastructure_failure" ||
    value === "control_plane"
  );
}

function executionCategoryLabel(category: ExecutionTerminalCategory): string {
  switch (category) {
    case "pass":
      return "Passed";
    case "wrong_answer":
      return "Wrong answer";
    case "compile_error":
      return "Compile error";
    case "type_error":
      return "Type error";
    case "runtime_error":
      return "Runtime error";
    case "limits":
      return "Resource limit";
    case "cancelled":
      return "Cancelled";
    case "infrastructure_error":
      return "Infrastructure failure";
  }
}

function samePseudocode(left: PseudocodeState, right: PseudocodeState): boolean {
  return PSEUDOCODE_FIELDS.every(([field]) => left[field] === right[field]);
}

function readRecovery(learnerId: string, language: ProblemLanguage): RecoverySnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(recoveryKey(learnerId, language));
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<RecoverySnapshot>;
    return typeof parsed.source === "string" &&
      parsed.pseudocode !== null &&
      typeof parsed.pseudocode === "object"
      ? { source: parsed.source, pseudocode: { ...EMPTY_PSEUDOCODE, ...parsed.pseudocode } }
      : null;
  } catch {
    window.localStorage.removeItem(recoveryKey(learnerId, language));
    return null;
  }
}

function recoveryKey(learnerId: string, language: ProblemLanguage): string {
  return `${RECOVERY_KEY}:${encodeURIComponent(learnerId)}:${language}`;
}
