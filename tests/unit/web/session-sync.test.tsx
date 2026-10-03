import PlanningPreferences from "../../../apps/web/src/components/planning-preferences";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import AuthControls from "../../../apps/web/src/components/auth-controls";
import {
  StaffNavigationProvider,
  useAppSession,
} from "../../../apps/web/src/components/staff-navigation";

const clerk = vi.hoisted(() => ({ isLoaded: false, user: null as { id: string } | null }));
vi.mock("../../../apps/web/node_modules/@clerk/nextjs", () => ({
  useUser: () => clerk,
  Show: ({ children }: { children: ReactNode }) => children,
  SignInButton: ({ children }: { children: ReactNode }) => children,
  SignUpButton: ({ children }: { children: ReactNode }) => children,
  UserButton: () => null,
}));
afterEach(() => vi.unstubAllGlobals());

function PrivatePage() {
  const session = useAppSession();
  const [draft, setDraft] = useState("");
  return (
    <>
      <p>
        {session?.status}:{session?.userId}
      </p>
      <button onClick={() => session?.reload()}>Refresh account</button>
      <input
        aria-label="Private draft"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    </>
  );
}
function App() {
  return (
    <StaffNavigationProvider>
      <AuthControls />
      <PrivatePage />
      <PlanningPreferences />
    </StaffNavigationProvider>
  );
}

it("refreshes an early signed-out read after Clerk loads and clears private state on account changes", async () => {
  clerk.isLoaded = false;
  clerk.user = null;
  let preferenceReads = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/planning/intent") {
        preferenceReads += 1;
        return Response.json({
          intent: null,
          collections: [],
          asOf: "2026-10-03T10:00:00Z",
          profile: {
            goal: "Learn patterns",
            targetRole: "Engineer",
            timezone: "UTC",
            dailyCapacityMinutes: 45,
            preferredLanguages: ["python"],
          },
        });
      }
      if (String(input) === "/api/planning/roadmap")
        return Response.json({ state: null, candidates: [], history: [], journal: [] });
      return clerk.user === null
        ? Response.json({ authenticated: false }, { status: 401 })
        : Response.json({ authenticated: true, user: { id: clerk.user.id, roles: ["learner"] } });
    }),
  );
  const view = render(<App />);
  await waitFor(() => expect(screen.getByText("signed-out:")).toBeVisible());
  clerk.isLoaded = true;
  clerk.user = { id: "usr_first" };
  view.rerender(<App />);
  await waitFor(() => expect(screen.getByText("ready:usr_first")).toBeVisible());
  fireEvent.change(screen.getByLabelText("Private draft"), {
    target: { value: "first account private edit" },
  });
  await waitFor(() =>
    expect(screen.getByLabelText("Goal", { exact: true })).toHaveValue("Learn patterns"),
  );
  fireEvent.change(screen.getByLabelText("Start day", { exact: true }), {
    target: { value: "2026-10-05" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Refresh account" }));
  await waitFor(() => expect(screen.getByText("ready:usr_first")).toBeVisible());
  expect(screen.getByLabelText("Start day", { exact: true })).toHaveValue("2026-10-05");
  expect(preferenceReads).toBe(1);
  clerk.user = { id: "usr_second" };
  view.rerender(<App />);
  await waitFor(() => expect(screen.getByText("ready:usr_second")).toBeVisible());
  expect(screen.getByLabelText("Private draft")).toHaveValue("");
  clerk.user = null;
  view.rerender(<App />);
  await waitFor(() => expect(screen.getByText("signed-out:")).toBeVisible());
});
