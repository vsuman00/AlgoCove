"use client";

import {
  createContext,
  useCallback,
  Fragment,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";

type SessionSnapshot = {
  readonly status: "loading" | "signed-out" | "ready" | "unavailable";
  readonly userId: string | null;
  readonly roles: readonly string[];
};
const AppSession = createContext<(SessionSnapshot & { reload: () => void }) | null>(null);
export function useAppSession(): (SessionSnapshot & { reload: () => void }) | null {
  return useContext(AppSession);
}

/** Share the server-owned session across page data and both navigation menus. */
export function StaffNavigationProvider({ children }: { children: ReactNode }): ReactElement {
  const [session, setSession] = useState<SessionSnapshot>({
    status: "loading",
    userId: null,
    roles: [],
  });
  const [revision, setRevision] = useState(0);
  const request = useRef<Promise<SessionSnapshot> | null>(null);
  useEffect(() => {
    let active = true;
    // ponytail: reuse this read during Strict Mode effect replay; never cache it across accounts.
    request.current ??= fetch("/api/auth/session", {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    })
      .then(async (response): Promise<SessionSnapshot> => {
        if (response.status === 401) return { status: "signed-out", userId: null, roles: [] };
        if (!response.ok) throw new Error("session_unavailable");
        const body = (await response.json()) as {
          authenticated?: boolean;
          user?: { id?: unknown; roles?: unknown };
        };
        if (!body.authenticated) return { status: "signed-out", userId: null, roles: [] };
        if (typeof body.user?.id !== "string") throw new Error("session_invalid");
        return {
          status: "ready",
          userId: body.user.id,
          roles: Array.isArray(body.user.roles)
            ? body.user.roles.filter((role): role is string => typeof role === "string")
            : [],
        };
      })
      .catch(() => ({ status: "unavailable", userId: null, roles: [] }));
    void request.current.then((value) => {
      if (active) setSession(value);
    });
    return () => {
      active = false;
    };
  }, [revision]);
  const reload = useCallback(() => {
    request.current = null;
    setSession((current) => ({ status: "loading", userId: current.userId, roles: [] }));
    setRevision((value) => value + 1);
  }, []);
  return (
    <AppSession.Provider value={{ ...session, reload }}>
      {/* Private component state belongs to one account, including after an account switch. */}
      <Fragment key={session.userId ?? "anonymous"}>{children}</Fragment>
    </AppSession.Provider>
  );
}

/** Visibility follows server-owned roles. Commands still authorize on the server. */
export default function StaffNavigation({ active }: { active: string }): ReactElement | null {
  const roles = useAppSession()?.roles ?? [];
  const content = roles.some((role) =>
    ["author", "technical_reviewer", "pedagogical_reviewer", "publisher", "evaluator"].includes(
      role,
    ),
  );
  const operator = roles.includes("operator");
  if (!content && !operator) return null;
  return (
    <nav className="ac-staff-navigation" aria-label="Staff navigation">
      <p className="ac-eyebrow">Operations</p>
      {content && (
        <a
          className="ac-nav-item"
          aria-current={active === "Content" ? "page" : undefined}
          href="/admin/content"
        >
          Content
        </a>
      )}
      {operator && (
        <a
          className="ac-nav-item"
          aria-current={active === "Runtimes" ? "page" : undefined}
          href="/execution-readiness"
        >
          Runtimes
        </a>
      )}
    </nav>
  );
}
