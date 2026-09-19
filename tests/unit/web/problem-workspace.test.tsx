import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProblemWorkspace from "../../../apps/web/src/components/problem-workspace";

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("Task 29 guided problem workspace", () => {
  it("keeps the critical path visible and fails closed when execution is unavailable", async () => {
    render(<ProblemWorkspace executionEnabled={false} />);

    expect(screen.getByRole("heading", { name: "Container with most water" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Pseudocode checkpoint" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Step through the reviewed trace" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Run checks" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit attempt" })).toBeDisabled();
    await waitFor(() => expect(screen.getByText(/Sign in for private recovery/)).toBeVisible());
  });

  it("keeps language source and authored hint controls explicit", () => {
    render(<ProblemWorkspace executionEnabled={false} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Implementation language" }), {
      target: { value: "typescript" },
    });
    expect(
      (screen.getByRole("textbox", { name: "TypeScript source" }) as HTMLTextAreaElement).value,
    ).toContain("number[]");

    fireEvent.click(screen.getByRole("button", { name: "Request clarification hint" }));
    expect(screen.getByText(/authenticated exposure endpoint acknowledges/i)).toBeVisible();
  });

  it("loads the private workspace and sends edited source to the durable route", async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/auth/session")) {
        return new Response(
          JSON.stringify({ authenticated: true, user: { id: "usr_workspace_fixture" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/practice/workspace")) {
        return new Response(
          JSON.stringify({
            attempt: { attemptId: "att_workspace_fixture" },
            firstHintId: "hint-arrays-1",
            sourceDraft: {
              draftId: "drf_workspace_fixture",
              version: 1,
              currentRevision: 1,
              currentText: "remote source",
            },
            starterTemplate: "starter source",
            pseudocode: {
              pseudocodeId: "psc_workspace_fixture",
              version: 1,
              current: {
                inputs: "remote inputs",
                state: "",
                initialization: "",
                invariant: "",
                loop: "",
                termination: "",
                output: "",
                complexity: "",
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/practice/hints")) {
        return new Response(JSON.stringify({ hint: { body: "Move the shorter boundary." } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ draft: { version: 2 }, artifact: { version: 2 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProblemWorkspace executionEnabled={false} />);
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Python source" })).toHaveValue("remote source"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Request clarification hint" }));
    await waitFor(() => expect(screen.getByText("Move the shorter boundary.")).toBeVisible());

    fireEvent.change(screen.getByRole("textbox", { name: "Python source" }), {
      target: { value: "remote source with a revision" },
    });
    await waitFor(
      () =>
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/practice/drafts/drf_workspace_fixture",
          expect.objectContaining({ method: "PUT" }),
        ),
      { timeout: 1_500 },
    );
  });

  it("preserves unsynced local recovery and queues it for durable sync", async () => {
    window.localStorage.setItem(
      "algocove:workspace-recovery:arrays-two-pointer:usr_workspace_recovery:python",
      JSON.stringify({
        source: "recovered source",
        pseudocode: {
          inputs: "recovered inputs",
          state: "",
          initialization: "",
          invariant: "",
          loop: "",
          termination: "",
          output: "",
          complexity: "",
        },
      }),
    );
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/auth/session")) {
        return new Response(
          JSON.stringify({ authenticated: true, user: { id: "usr_workspace_recovery" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/practice/workspace")) {
        return new Response(
          JSON.stringify({
            attempt: { attemptId: "att_workspace_recovery" },
            firstHintId: "hint-arrays-1",
            sourceDraft: {
              draftId: "drf_workspace_recovery",
              version: 1,
              currentRevision: 1,
              currentText: "remote source",
            },
            starterTemplate: "starter source",
            pseudocode: {
              pseudocodeId: "psc_workspace_recovery",
              version: 1,
              current: {
                inputs: "remote inputs",
                state: "",
                initialization: "",
                invariant: "",
                loop: "",
                termination: "",
                output: "",
                complexity: "",
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ draft: { version: 2 }, artifact: { version: 2 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProblemWorkspace executionEnabled={false} />);

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Python source" })).toHaveValue(
        "recovered source",
      ),
    );
    expect(screen.getByRole("textbox", { name: "Inputs" })).toHaveValue("recovered inputs");
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/practice/drafts/drf_workspace_recovery",
        expect.objectContaining({ method: "PUT" }),
      ),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/practice/pseudocode/psc_workspace_recovery",
        expect.objectContaining({ method: "PUT" }),
      ),
    );
  });

  it("sends Run through the authenticated execution boundary and shows queued state", async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/auth/session")) {
        return new Response(
          JSON.stringify({ authenticated: true, user: { id: "usr_execution_fixture" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/practice/workspace")) {
        return new Response(
          JSON.stringify({
            attempt: { attemptId: "att_execution_fixture" },
            firstHintId: "hint-arrays-1",
            sourceDraft: {
              draftId: "drf_execution_fixture",
              version: 1,
              currentRevision: 1,
              currentText: "remote source",
            },
            starterTemplate: "starter source",
            pseudocode: {
              pseudocodeId: "psc_execution_fixture",
              version: 1,
              current: {},
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/practice/runs")) {
        return new Response(JSON.stringify({ status: "queued", runId: "run_execution_fixture" }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/api/practice/runs/run_execution_fixture")) {
        return new Response(
          JSON.stringify({
            status: "completed",
            result: {
              resultId: "result_execution_fixture",
              terminalCategory: "pass",
              classification: "success",
              passed: true,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ draft: { version: 2 }, artifact: { version: 2 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProblemWorkspace executionEnabled />);
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Python source" })).toHaveValue("remote source"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Run checks" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/practice/runs",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toMatchObject({
      attemptId: "att_execution_fixture",
      mode: "run",
      source: "remote source",
    });
    await waitFor(() => expect(screen.getByText(/Execution complete · Passed/)).toBeVisible());
  });

  it("restores a committed terminal result from workspace bootstrap", async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/auth/session")) {
        return new Response(
          JSON.stringify({ authenticated: true, user: { id: "usr_resume_fixture" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/practice/workspace")) {
        return new Response(
          JSON.stringify({
            attempt: { attemptId: "att_resume_fixture" },
            firstHintId: "hint-arrays-1",
            activeRun: {
              runId: "run_resume_fixture",
              mode: "submit",
              status: "completed",
              result: {
                resultId: "result_resume_fixture",
                terminalCategory: "infrastructure_error",
                classification: "infrastructure_failure",
                passed: false,
              },
            },
            sourceDraft: {
              draftId: "drf_resume_fixture",
              version: 1,
              currentRevision: 1,
              currentText: "resumed source",
            },
            starterTemplate: "starter source",
            pseudocode: { pseudocodeId: "psc_resume_fixture", version: 1, current: {} },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ draft: { version: 2 }, artifact: { version: 2 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProblemWorkspace executionEnabled />);
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Python source" })).toHaveValue("resumed source"),
    );
    expect(screen.getByText(/Execution complete · Infrastructure failure/)).toBeVisible();
  });

  it("cancels a queued run and waits for the trusted cancelled result", async () => {
    let cancelled = false;
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/auth/session")) {
        return new Response(
          JSON.stringify({ authenticated: true, user: { id: "usr_cancel_fixture" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/practice/workspace")) {
        return new Response(
          JSON.stringify({
            attempt: { attemptId: "att_cancel_fixture" },
            firstHintId: "hint-arrays-1",
            sourceDraft: {
              draftId: "drf_cancel_fixture",
              version: 1,
              currentRevision: 1,
              currentText: "queued source",
            },
            starterTemplate: "starter source",
            pseudocode: { pseudocodeId: "psc_cancel_fixture", version: 1, current: {} },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/practice/runs")) {
        return new Response(JSON.stringify({ status: "queued", runId: "run_cancel_fixture" }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/api/practice/runs/run_cancel_fixture/cancel")) {
        cancelled = true;
        return new Response(
          JSON.stringify({ status: "cancellation_requested", runId: "run_cancel_fixture" }),
          { status: 202, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/practice/runs/run_cancel_fixture")) {
        return new Response(
          JSON.stringify(
            cancelled
              ? {
                  status: "completed",
                  result: {
                    resultId: "result_cancel_fixture",
                    terminalCategory: "cancelled",
                    classification: "control_plane",
                    passed: false,
                  },
                }
              : { status: "queued", result: null },
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ draft: { version: 2 }, artifact: { version: 2 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProblemWorkspace executionEnabled />);
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Python source" })).toHaveValue("queued source"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Run checks" }));
    await waitFor(() => expect(screen.getByText(/Execution queued/)).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Cancel execution" }));
    await waitFor(() => expect(screen.getByText(/Execution complete · Cancelled/)).toBeVisible(), {
      timeout: 2_000,
    });
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).endsWith("/api/practice/runs/run_cancel_fixture/cancel"),
      ),
    ).toBe(true);
  });

  it("serializes slow remote saves so newer edits use the latest version", async () => {
    let releaseFirstPut!: () => void;
    const firstPut = new Promise<void>((resolve) => {
      releaseFirstPut = resolve;
    });
    let draftPutCount = 0;
    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/auth/session")) {
          return new Response(
            JSON.stringify({ authenticated: true, user: { id: "usr_workspace_fixture" } }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.endsWith("/api/practice/workspace")) {
          return new Response(
            JSON.stringify({
              attempt: { attemptId: "att_workspace_fixture" },
              firstHintId: "hint-arrays-1",
              sourceDraft: {
                draftId: "drf_workspace_fixture",
                version: 1,
                currentRevision: 1,
                currentText: "remote source",
              },
              starterTemplate: "starter source",
              pseudocode: {
                pseudocodeId: "psc_workspace_fixture",
                version: 1,
                current: {
                  inputs: "",
                  state: "",
                  initialization: "",
                  invariant: "",
                  loop: "",
                  termination: "",
                  output: "",
                  complexity: "",
                },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (init?.method === "PUT" && url.includes("/api/practice/drafts/")) {
          draftPutCount += 1;
          if (draftPutCount === 1) await firstPut;
          return new Response(JSON.stringify({ draft: { version: draftPutCount + 1 } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ artifact: { version: 2 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProblemWorkspace executionEnabled={false} />);
    const source = await screen.findByRole("textbox", { name: "Python source" });
    await waitFor(() => expect(source).toHaveValue("remote source"));

    fireEvent.change(source, { target: { value: "first edit" } });
    await waitFor(() => expect(draftPutCount).toBe(1), { timeout: 1_500 });
    fireEvent.change(source, { target: { value: "second edit" } });
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(draftPutCount).toBe(1);

    releaseFirstPut();
    await waitFor(() => expect(draftPutCount).toBe(2), { timeout: 1_500 });
    expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toMatchObject({
      text: "second edit",
      expectedVersion: 2,
    });
  });
});
