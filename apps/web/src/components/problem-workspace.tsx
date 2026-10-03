"use client";

import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import type { ProblemLanguage, PseudocodeFields } from "@algocove/domain";
import TraceWorkspace from "./trace-workspace";
import { useAppSession } from "./staff-navigation";

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

const RECOVERY_KEY = "algocove:workspace-recovery:arrays-two-pointer";

type PseudocodeState = PseudocodeFields;
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
type SessionState = "checking" | "signed_out" | "authenticated" | "unavailable";
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
  | { readonly kind: "queued"; readonly runId: string; readonly sourceAtRun: string | null }
  | { readonly kind: "cancelling"; readonly runId: string }
  | { readonly kind: "suspended"; readonly runId: string; readonly sourceAtRun: string | null }
  | {
      readonly kind: "completed";
      readonly runId: string;
      readonly terminalCategory: ExecutionTerminalCategory;
      readonly classification: ExecutionClassification;
      readonly passed: boolean;
      readonly sourceAtRun: string | null;
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
  initialLanguage = "python",
}: {
  readonly executionEnabled: boolean;
  readonly problemId?: string;
  readonly initialLanguage?: keyof typeof STARTERS;
}): ReactElement {
  const appSession = useAppSession();
  const [workspace, setWorkspace] = useState<WorkspaceState>({
    language: initialLanguage,
    source: STARTERS[initialLanguage],
    pseudocode: EMPTY_PSEUDOCODE,
  });
  const [saveState, setSaveState] = useState<RecoveryState>("local");
  const [sessionRefresh, setSessionRefresh] = useState(0);
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [workspaceStatus, setWorkspaceStatus] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );
  const [learnerId, setLearnerId] = useState<string | null>(null);
  const [hintState, setHintState] = useState("No hint revealed. Start with your invariant.");
  const [hintTier, setHintTier] = useState(1);
  const [confidence, setConfidence] = useState("");
  const [revisionState, setRevisionState] = useState("No explicit reasoning revision saved.");
  const [submitted, setSubmitted] = useState(false);
  const [restart, setRestart] = useState(0);
  const [executionState, setExecutionState] = useState<ExecutionState>({ kind: "idle" });
  const remoteWorkspace = useRef<RemoteWorkspace | null>(null);
  const syncQueue = useRef<Promise<void>>(Promise.resolve());
  const latestSync = useRef(0);
  const pendingRestart = useRef(false);
  const recoveredLearner = useRef<string | null>(null);
  const { language, source, pseudocode } = workspace;

  useEffect(() => {
    let cancelled = false;
    const sessionRead =
      appSession === null
        ? fetch("/api/auth/session", { cache: "no-store", signal: AbortSignal.timeout(10_000) })
        : appSession.status === "loading"
          ? null
          : Promise.resolve(
              Response.json(
                { authenticated: appSession.status === "ready", user: { id: appSession.userId } },
                {
                  status:
                    appSession.status === "unavailable"
                      ? 503
                      : appSession.status === "signed-out"
                        ? 401
                        : 200,
                },
              ),
            );
    if (sessionRead === null) return;
    void sessionRead
      .then(async (response) => {
        if (!response.ok) {
          if (!cancelled) {
            setSessionState(response.status === 401 ? "signed_out" : "unavailable");
            setSaveState(response.status === 401 ? "sign_in" : "server_pending");
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
        if (recoveredLearner.current !== nextLearnerId) {
          recoveredLearner.current = nextLearnerId;
          setWorkspace((current) => {
            const recovery = readRecovery(nextLearnerId, current.language);
            return recovery === null ? current : { language: current.language, ...recovery };
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSessionState("unavailable");
          setSaveState("server_pending");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sessionRefresh, appSession]);

  useEffect(() => {
    if (sessionState !== "authenticated" || learnerId === null) return;
    let cancelled = false;
    remoteWorkspace.current = null;
    void fetch("/api/practice/workspace", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId, language, restart: pendingRestart.current }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("workspace_sync_unavailable");
        pendingRestart.current = false;
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
            readonly savedRevision?: number;
          };
          readonly activeRun?: {
            readonly matchesCurrentDraft?: boolean;
            readonly runId?: unknown;
            readonly status?: unknown;
            readonly result?: {
              readonly resultId?: unknown;
              readonly terminalCategory?: unknown;
              readonly classification?: unknown;
              readonly passed?: unknown;
            } | null;
          } | null;
          readonly attempt?: { readonly attemptId?: string; readonly status?: string };
          readonly highestHintTier?: number;
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
        setSubmitted(body.attempt.status === "submitted");
        setHintTier(Math.min(5, (body.highestHintTier ?? 0) + 1));
        setRevisionState(
          pseudocodeArtifact.savedRevision
            ? `Reasoning revision ${pseudocodeArtifact.savedRevision} saved.`
            : "No explicit reasoning revision saved.",
        );
        const serverWorkspace: WorkspaceState = {
          language,
          source:
            sourceDraft.currentRevision === 0 ? body.starterTemplate : sourceDraft.currentText,
          pseudocode: { ...EMPTY_PSEUDOCODE, ...pseudocodeArtifact.current },
        };
        const recovery = readRecovery(learnerId, language);
        const hasUnsyncedRecovery =
          recovery !== null &&
          (recovery.source !== serverWorkspace.source ||
            !samePseudocode(recovery.pseudocode, serverWorkspace.pseudocode));
        setWorkspace(hasUnsyncedRecovery ? { language, ...recovery } : serverWorkspace);
        const recoveredExecution = executionStateFromRemote(body.activeRun, serverWorkspace.source);
        setExecutionState(recoveredExecution ?? { kind: "idle" });
        setSaveState(hasUnsyncedRecovery ? "saving" : "saved");
        setWorkspaceStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          remoteWorkspace.current = null;
          // ponytail: only the recovery writer may claim that a local edit was saved.
          setWorkspaceStatus("unavailable");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [language, learnerId, problemId, sessionState, restart]);

  async function executeWorkspace(mode: "run" | "submit"): Promise<void> {
    setExecutionState({ kind: "requesting" });
    try {
      await syncQueue.current;
      const remote = remoteWorkspace.current;
      if (remote === null) throw new Error("workspace unavailable");
      const synced = await syncRemoteDrafts({ remote, source, pseudocode });
      remoteWorkspace.current = synced;
      await requestExecution(synced, sessionState, mode, source, (state) => {
        setExecutionState(state);
        if (mode === "submit" && state.kind === "queued") setSubmitted(true);
      });
    } catch {
      setExecutionState({ kind: "unavailable" });
    }
  }

  useEffect(() => {
    if (sessionState !== "authenticated" || learnerId === null) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(
        recoveryKey(learnerId, language),
        JSON.stringify({ source, pseudocode }),
      );
      const remote = remoteWorkspace.current;
      if (remote === null || remote.language !== language) {
        setSaveState("server_pending");
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
  const queuedSource = executionState.kind === "queued" ? executionState.sourceAtRun : null;

  useEffect(() => {
    if (queuedRunId === null) return;
    let cancelled = false;
    let timer: number | undefined;
    const startedAt = Date.now();

    const poll = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/practice/runs/${encodeURIComponent(queuedRunId)}`, {
          credentials: "include",
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
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
          if (!cancelled) {
            const elapsed = Date.now() - startedAt;
            if (elapsed >= 120_000) {
              setExecutionState({
                kind: "suspended",
                runId: queuedRunId,
                sourceAtRun: queuedSource,
              });
            } else timer = window.setTimeout(() => void poll(), elapsed < 10_000 ? 500 : 5_000);
          }
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
            sourceAtRun: queuedSource,
          });
        }
      } catch {
        if (!cancelled)
          setExecutionState({ kind: "suspended", runId: queuedRunId, sourceAtRun: queuedSource });
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [queuedRunId, queuedSource]);

  const saveLabel = useMemo(
    () =>
      sessionState === "unavailable"
        ? "Account service unavailable. Retry to recover your private workspace."
        : saveState === "saving"
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
            ? `Execution complete · ${executionState.sourceAtRun === source ? "" : "Previous source · "}${executionCategoryLabel(executionState.terminalCategory)}`
            : executionState.kind === "suspended"
              ? "Result status unavailable. Your run is preserved; retry its status or cancel it."
              : executionState.kind === "unavailable"
                ? "Execution unavailable · please try again"
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
    setExecutionState((current) => (current.kind === "unavailable" ? { kind: "idle" } : current));
    setWorkspace((current) => ({ ...current, source: value }));
  };

  const changeLanguage = (nextLanguage: ProblemLanguage): void => {
    setWorkspaceStatus("loading");
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
            with checked execution results.
          </p>
        </div>
        <aside className="ac-workspace__status" aria-label="Workspace status">
          <strong>Practice attempt</strong>
          <span>Private recovery · {saveLabel}</span>
          <span>Run or submit your code to see checked results.</span>
          {sessionState === "unavailable" && (
            <button
              type="button"
              className="ac-small-button"
              onClick={() => {
                setSessionState("checking");
                if (appSession !== null) appSession.reload();
                else setSessionRefresh((value) => value + 1);
              }}
            >
              Retry account connection
            </button>
          )}
          {sessionState === "authenticated" && workspaceStatus === "loading" && (
            <span role="status">Connecting your private workspace…</span>
          )}
          {sessionState === "authenticated" && workspaceStatus === "unavailable" && (
            <>
              <span role="status">Workspace connection unavailable. Local edits are retained.</span>
              <button
                className="ac-small-button"
                type="button"
                onClick={() => {
                  setWorkspaceStatus("loading");
                  setRestart((value) => value + 1);
                }}
              >
                Retry workspace connection
              </button>
            </>
          )}
          {executionLabel !== null ? <span role="status">{executionLabel}</span> : null}
        </aside>
      </header>

      <ol className="ac-workspace__path" aria-label="Guided problem path">
        {[
          ["1", "Understand"],
          ["2", "Pseudocode"],
          ["3", "Trace"],
          ["4", "Implement"],
          ["5", "Validate"],
        ].map(([step, label]) => (
          <li key={label}>
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
          <button
            className="ac-small-button"
            type="button"
            onClick={() => {
              syncQueue.current = syncQueue.current
                .catch(() => undefined)
                .then(async () => {
                  const remote = remoteWorkspace.current;
                  if (remote === null || sessionState !== "authenticated") {
                    setRevisionState("Sign in to save a reasoning revision.");
                    return;
                  }
                  try {
                    const synced = await syncRemoteDrafts({ remote, source, pseudocode });
                    const response = await fetch(
                      `/api/practice/pseudocode/${synced.pseudocodeId}`,
                      {
                        method: "PUT",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          expectedVersion: synced.pseudocodeVersion,
                          saveRevision: true,
                        }),
                      },
                    );
                    if (!response.ok) throw new Error("revision unavailable");
                    const body = (await response.json()) as {
                      artifact: { version: number; savedRevision: number };
                    };
                    remoteWorkspace.current = {
                      ...synced,
                      pseudocodeVersion: body.artifact.version,
                    };
                    setRevisionState(`Reasoning revision ${body.artifact.savedRevision} saved.`);
                    const checked = await fetch("/api/mastery/explanation", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        pseudocodeId: synced.pseudocodeId,
                        revision: body.artifact.savedRevision,
                        confidence: confidence || null,
                      }),
                    }).catch(() => null);
                    if (checked === null || !checked.ok) {
                      setRevisionState(
                        `Revision ${body.artifact.savedRevision} saved. Structured check unavailable; save another revision to retry.`,
                      );
                      return;
                    }
                    const result = (await checked.json().catch(() => null)) as {
                      correct: boolean;
                      status: string;
                    } | null;
                    if (result === null) {
                      setRevisionState(
                        `Revision ${body.artifact.savedRevision} saved. Structured check receipt unavailable.`,
                      );
                      return;
                    }
                    setRevisionState(
                      `Revision ${body.artifact.savedRevision} saved. ${result.correct ? "Reviewed structured checks passed." : "Review your structured answers."} ${result.status === "projection_pending" ? "Progress update pending." : "Check recorded."} Free-form reasoning remains advisory.`,
                    );
                  } catch {
                    setRevisionState(
                      "Revision could not be saved. Your current draft is retained.",
                    );
                  }
                });
            }}
          >
            Save and check reasoning revision
          </button>
          <label>
            Confidence before checking (optional, self-reported)
            <select value={confidence} onChange={(event) => setConfidence(event.target.value)}>
              <option value="">Prefer not to say</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <p role="status">{revisionState}</p>
          <button
            className="ac-small-button"
            type="button"
            onClick={() => {
              const remote = remoteWorkspace.current;
              if (remote === null) {
                setRevisionState("Sign in to check reasoning readiness.");
                return;
              }
              void syncQueue.current.then(async () => {
                const current = remoteWorkspace.current;
                if (current === null) return;
                try {
                  const response = await fetch(`/api/practice/pseudocode/${current.pseudocodeId}`, {
                    cache: "no-store",
                  });
                  if (!response.ok) throw new Error("readiness unavailable");
                  const body = (await response.json()) as {
                    readiness: { status: string; missing: string[] } | null;
                  };
                  setRevisionState(
                    body.readiness === null
                      ? "Save a reasoning revision before checking readiness."
                      : body.readiness.status === "ready"
                        ? "Reasoning checkpoint ready: authored checks and a verified passing submission. Free-form reasoning remains advisory."
                        : `Reasoning checkpoint pending: ${body.readiness.missing.join(", ")}.`,
                  );
                } catch {
                  setRevisionState("Readiness is unavailable. No readiness claim was recorded.");
                }
              });
            }}
          >
            Check reasoning readiness
          </button>
          <p className="ac-workspace__muted">
            Your reasoning is saved privately as you work. Save a revision when you are ready to
            check your answers.
          </p>
          <div className="ac-workspace__fields">
            {[
              {
                id: "area",
                label: "Area checkpoint",
                options: [
                  ["minimum_times_width", "Smaller height × distance"],
                  ["maximum_times_width", "Larger height × distance"],
                  ["sum", "Sum of the two heights"],
                ],
              },
              {
                id: "boundary",
                label: "Boundary checkpoint",
                options: [
                  ["shorter", "Move the shorter boundary"],
                  ["taller", "Move the taller boundary"],
                  ["both", "Always move both boundaries"],
                ],
              },
            ].map((question) => (
              <label key={question.id}>
                <span>{question.label}</span>
                <select
                  aria-label={question.label}
                  value={pseudocode.structuredAnswers?.[question.id] ?? ""}
                  onChange={(event) =>
                    setWorkspace((current) => ({
                      ...current,
                      pseudocode: {
                        ...current.pseudocode,
                        structuredAnswers: {
                          ...current.pseudocode.structuredAnswers,
                          [question.id]: event.target.value,
                        },
                      },
                    }))
                  }
                >
                  <option value="">Choose an answer</option>
                  {question.options.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
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
          <TraceWorkspace
            key={language}
            getAttemptId={() => remoteWorkspace.current?.attemptId}
            onExposure={(tier) =>
              setHintTier((current) => Math.max(current, Math.min(5, tier + 1)))
            }
          />
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
              disabled={
                !executionEnabled ||
                sessionState !== "authenticated" ||
                workspaceStatus !== "ready" ||
                submitted ||
                executionState.kind === "requesting" ||
                executionState.kind === "queued" ||
                executionState.kind === "suspended" ||
                executionState.kind === "cancelling"
              }
              onClick={() => void executeWorkspace("run")}
              type="button"
            >
              Run checks
            </button>
            <button
              className="ac-button ac-button--secondary"
              disabled={
                !executionEnabled ||
                sessionState !== "authenticated" ||
                workspaceStatus !== "ready" ||
                submitted ||
                executionState.kind === "requesting" ||
                executionState.kind === "queued" ||
                executionState.kind === "suspended" ||
                executionState.kind === "cancelling"
              }
              onClick={() => void executeWorkspace("submit")}
              type="button"
            >
              Submit attempt
            </button>
          </div>
          {submitted ? (
            <button
              className="ac-small-button"
              type="button"
              disabled={
                executionState.kind === "queued" ||
                executionState.kind === "suspended" ||
                executionState.kind === "requesting" ||
                executionState.kind === "cancelling"
              }
              onClick={() => {
                setSubmitted(false);
                setExecutionState({ kind: "idle" });
                remoteWorkspace.current = null;
                pendingRestart.current = true;
                setWorkspaceStatus("loading");
                setRestart((value) => value + 1);
              }}
            >
              Start a new attempt
            </button>
          ) : null}
          {executionState.kind === "suspended" ? (
            <button
              className="ac-small-button"
              type="button"
              onClick={() =>
                setExecutionState({
                  kind: "queued",
                  runId: executionState.runId,
                  sourceAtRun: executionState.sourceAtRun,
                })
              }
            >
              Retry result status
            </button>
          ) : null}
          {executionState.kind === "queued" ||
          executionState.kind === "suspended" ||
          executionState.kind === "cancelling" ? (
            <button
              className="ac-small-button"
              disabled={executionState.kind === "cancelling"}
              onClick={() =>
                void requestExecutionCancellation(
                  executionState.runId,
                  sessionState,
                  setExecutionState,
                  executionState.kind === "suspended" ? executionState.sourceAtRun : queuedSource,
                )
              }
              type="button"
            >
              Cancel execution
            </button>
          ) : null}
          {!executionEnabled ? (
            <p className="ac-note ac-note--info" role="status">
              {"Execution is temporarily unavailable. Your work remains saved; try again later."}
            </p>
          ) : null}
        </section>

        <aside className="ac-panel ac-workspace__panel" aria-labelledby="hint-title">
          <p className="ac-eyebrow">Guidance</p>
          <h2 id="hint-title">Need a nudge?</h2>
          <p>{hintState}</p>
          <button
            className="ac-small-button ac-small-button--filled"
            onClick={() =>
              void requestHint(remoteWorkspace.current, sessionState, setHintState, hintTier, () =>
                setHintTier((tier) => Math.min(5, tier + 1)),
              )
            }
            type="button"
          >
            {hintTier === 1 ? "Request clarification hint" : `Request authored hint ${hintTier}`}
          </button>
          <p className="ac-workspace__muted">
            Hints reveal progressively more guidance. Each hint is recorded with your attempt so
            your progress reflects the help you used.
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
  tier = 1,
  acknowledged: () => void = () => {},
): Promise<void> {
  const pendingMessage = "Hint request is pending. Try again when your connection is available.";
  if (sessionState !== "authenticated" || remote === null) {
    setHintState("Sign in or reconnect your account to use hints.");
    return;
  }
  try {
    const response = await fetch("/api/practice/hints", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attemptId: remote.attemptId,
        hintId: tier === 1 ? remote.firstHintId : `hint-arrays-${tier}`,
        requestedTier: tier,
        idempotencyKey: `workspace-hint-${remote.attemptId}-${remote.language}-${tier}`,
      }),
    });
    if (!response.ok) throw new Error("hint_request_failed");
    const body = (await response.json()) as {
      readonly hint?: { readonly body?: string };
    };
    if (typeof body.hint?.body !== "string") throw new Error("hint_contract_invalid");
    setHintState(body.hint.body);
    acknowledged();
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
    setExecutionState({ kind: "queued", runId: body.runId, sourceAtRun: source });
  } catch {
    setExecutionState({ kind: "unavailable" });
  }
}

async function requestExecutionCancellation(
  runId: string,
  sessionState: SessionState,
  setExecutionState: (state: ExecutionState) => void,
  sourceAtRun: string | null,
): Promise<void> {
  if (sessionState !== "authenticated") {
    setExecutionState({ kind: "suspended", runId, sourceAtRun });
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
    setExecutionState({ kind: "queued", runId, sourceAtRun });
  } catch {
    setExecutionState({ kind: "suspended", runId, sourceAtRun });
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
        readonly matchesCurrentDraft?: boolean;
        readonly result?: {
          readonly resultId?: unknown;
          readonly terminalCategory?: unknown;
          readonly classification?: unknown;
          readonly passed?: unknown;
        } | null;
      }
    | null
    | undefined,
  source: string,
): ExecutionState | null {
  if (value === null || value === undefined || typeof value.runId !== "string") return null;
  const sourceAtRun = value.matchesCurrentDraft === true ? source : null;
  if (value.status === "queued") return { kind: "queued", runId: value.runId, sourceAtRun };
  if (value.status !== "completed" || !isExecutionResult(value.result)) return null;
  return {
    kind: "completed",
    runId: value.runId,
    terminalCategory: value.result.terminalCategory,
    classification: value.result.classification,
    passed: value.result.passed,
    sourceAtRun,
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
  return (
    PSEUDOCODE_FIELDS.every(([field]) => left[field] === right[field]) &&
    JSON.stringify(Object.entries(left.structuredAnswers ?? {}).sort()) ===
      JSON.stringify(Object.entries(right.structuredAnswers ?? {}).sort())
  );
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
