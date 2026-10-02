"use client";

import { useEffect, useState, type ReactElement } from "react";
import { HomeLearningSummary, NextLearningAction } from "./learning-views";
import { Icon } from "./algocove-icons";

type Profile = {
  goal: string;
  targetRole: string;
  dailyCapacityMinutes: number;
  horizonDays: number;
  preferredLanguages: string[];
};

type LoadState = "loading" | "signed-out" | "empty" | "ready" | "error";

export default function HomeExperience(): ReactElement {
  const [state, setState] = useState<LoadState>("loading");
  const [refresh, setRefresh] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/onboarding", { cache: "no-store", signal: controller.signal })
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
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, [refresh]);

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
      {(state === "ready" || state === "empty") && <NextLearningAction />}

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
              ? "Your profile could not be loaded. Try again when your connection is available."
              : "Choose a goal and a comfortable daily schedule to personalize your next steps."}
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

      {state === "error" && (
        <button
          className="ac-small-button"
          onClick={() => {
            setState("loading");
            setRefresh((n) => n + 1);
          }}
          type="button"
        >
          Retry profile
        </button>
      )}
      {(state === "ready" || state === "empty") && <HomeLearningSummary />}
      {state === "signed-out" && (
        <section className="ac-profile-strip">
          <p className="ac-eyebrow">Explore a learning session</p>
          <h2>See the two-pointer pattern in motion.</h2>
          <p>Read the authored problem, build your reasoning and explore its interactive trace.</p>
          <a className="ac-button ac-button--primary" href="/learn/arrays-two-pointer">
            Explore guided practice
          </a>
        </section>
      )}
    </main>
  );
}
