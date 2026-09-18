"use client";

import { useEffect, useState, type ReactElement } from "react";
import { Icon } from "./algocove-icons";

type Profile = {
  goal: string;
  targetRole: string;
  dailyCapacityMinutes: number;
  horizonDays: number;
  preferredLanguages: string[];
};

type LoadState = "loading" | "signed-out" | "empty" | "ready" | "error";

const capabilities = [
  {
    eyebrow: "Account foundation",
    title: "Learner profile",
    description:
      "Save the goal, target role, schedule, accessibility preferences, and languages that later planning will use.",
    href: "/onboarding",
    action: "Open learner profile",
    icon: "target",
  },
  {
    eyebrow: "Governed content",
    title: "Content workflow",
    description:
      "Inspect the implemented author, review, validation, rights, source-link, and publication-gate model.",
    href: "/admin/content",
    action: "Open content operations",
    icon: "book",
  },
  {
    eyebrow: "Execution boundary",
    title: "Execution readiness",
    description:
      "Review the six code-backed language profiles and the security gate that still prevents learner execution.",
    href: "/execution-readiness",
    action: "Review runtime contracts",
    icon: "progress",
  },
] as const;

export default function HomeExperience(): ReactElement {
  const [state, setState] = useState<LoadState>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    void fetch("/api/onboarding", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          setState("signed-out");
          return;
        }
        if (!response.ok) {
          setState("error");
          return;
        }
        const body = (await response.json()) as { profile: Profile | null };
        setProfile(body.profile);
        setState(body.profile === null ? "empty" : "ready");
      })
      .catch(() => setState("error"));
  }, []);

  return (
    <main className="ac-home-main" id="main-content" tabIndex={-1}>
      <section className="ac-home-hero ac-home-hero--truthful" aria-labelledby="home-title">
        <div>
          <p className="ac-eyebrow">Implemented product surface</p>
          <h1 id="home-title">Build the foundation. Prove each gate.</h1>
          <p>
            AlgoCove currently exposes account setup, governed DSA content, six-language execution
            readiness, and the first Phase 5 learning kernel. Learner planning and problem solving
            are not presented before their complete paths exist.
          </p>
        </div>
        <div className="ac-phase-badge" aria-label="Current implementation phase">
          <span>Current scope</span>
          <strong>Phase 5 in progress</strong>
          <small>Sessions and attempts are syncing behind the learner workspace</small>
        </div>
      </section>

      <section className="ac-profile-strip" aria-labelledby="profile-status-title">
        <div className="ac-section-heading">
          <Icon name="target" size={24} />
          <div>
            <p className="ac-eyebrow">Your account</p>
            <h2 id="profile-status-title">
              {state === "ready"
                ? "Learner profile saved"
                : state === "signed-out"
                  ? "Sign in to use a private learner profile"
                  : state === "error"
                    ? "Profile service unavailable"
                    : state === "loading"
                      ? "Checking learner profile"
                      : "Learner profile not set up"}
            </h2>
          </div>
        </div>
        {state === "ready" && profile !== null ? (
          <div className="ac-profile-facts">
            <span>
              <b>Goal</b> {profile.goal}
            </span>
            <span>
              <b>Target</b> {profile.targetRole}
            </span>
            <span>
              <b>Capacity</b> {profile.dailyCapacityMinutes} min/day · {profile.horizonDays} days
            </span>
            <span>
              <b>Languages</b> {profile.preferredLanguages.join(", ")}
            </span>
          </div>
        ) : (
          <p className="ac-profile-message">
            {state === "error"
              ? "Refresh to retry. AlgoCove will not substitute invented learner data."
              : "No roadmap, activity, mastery, or review data is generated from a missing profile."}
          </p>
        )}
        <a
          className="ac-button ac-button--primary"
          href={state === "signed-out" ? "/sign-in" : "/onboarding"}
        >
          {state === "signed-out"
            ? "Sign in"
            : state === "ready"
              ? "Edit profile"
              : "Set up profile"}
          <Icon name="arrow" size={19} />
        </a>
      </section>

      <section className="ac-capabilities" aria-labelledby="available-title">
        <header>
          <p className="ac-eyebrow">Available now</p>
          <h2 id="available-title">Working surfaces backed by the repository</h2>
          <p>Every destination below has an implemented route and an explicit source of truth.</p>
        </header>
        <div className="ac-capability-grid">
          {capabilities.map((capability) => (
            <article className="ac-capability-card" key={capability.title}>
              <span className="ac-capability-icon">
                <Icon name={capability.icon} size={25} />
              </span>
              <p className="ac-eyebrow">{capability.eyebrow}</p>
              <h3>{capability.title}</h3>
              <p>{capability.description}</p>
              <a href={capability.href}>
                {capability.action} <Icon name="arrow" size={17} />
              </a>
            </article>
          ))}
        </div>
      </section>

      <aside className="ac-gate-note" aria-labelledby="not-yet-title">
        <Icon name="info" size={24} />
        <div>
          <p className="ac-eyebrow">Intentionally not shown</p>
          <h2 id="not-yet-title">No pretend learner workspace</h2>
          <p>
            Problem search, notifications, roadmaps, mastery, and review queues are absent because
            their end-to-end product routes are not implemented yet. The Phase 5 session and attempt
            kernel is syncing behind the scenes; the learner workspace stays hidden until that path
            is complete. The header contains no location control or inactive icon.
          </p>
        </div>
      </aside>
    </main>
  );
}
