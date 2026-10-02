"use client";

import { useEffect, useState, type ReactElement } from "react";
import { NextLearningAction } from "./learning-views";
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
      "Review the six code-backed language profiles and the local integration evidence still needed for learner execution.",
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
          <p className="ac-eyebrow">Guided learning</p>
          <h1 id="home-title">Build a pattern. Return to it.</h1>
          <p>
            Practice with authored explanations, check your reasoning, and revisit patterns with a
            clear record of your progress.
          </p>
        </div>
      </section>
      <NextLearningAction />

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
    </main>
  );
}
