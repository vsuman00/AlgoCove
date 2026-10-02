"use client";

import { useEffect, useState, type ReactElement } from "react";

/** Visibility follows server-owned roles. Commands still authorize on the server. */
export default function StaffNavigation({ active }: { active: string }): ReactElement | null {
  const [roles, setRoles] = useState<readonly string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const session = (await response.json()) as {
          authenticated?: boolean;
          user?: { roles?: unknown };
        };
        if (
          !controller.signal.aborted &&
          session.authenticated &&
          Array.isArray(session.user?.roles)
        ) {
          setRoles(session.user.roles.filter((role): role is string => typeof role === "string"));
        }
      })
      .catch(() => {
        /* An unavailable identity service cannot reveal staff navigation. */
      });
    return () => controller.abort();
  }, []);
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
