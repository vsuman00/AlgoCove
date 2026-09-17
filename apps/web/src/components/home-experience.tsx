"use client";

import { useEffect, useState, type ReactElement } from "react";
import { Icon } from "./algocove-icons";

type Profile = {
  goal: string;
  targetRole: string;
  timezone: string;
  dailyCapacityMinutes: number;
  horizonDays: number;
  preferredLanguages: string[];
  version: number;
};

type LoadState = "loading" | "signed-out" | "empty" | "ready" | "error";

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

  const heading =
    state === "ready" ? "Your learning loop is ready." : "Your next useful step is ready.";
  const subtitle =
    state === "ready"
      ? "Your saved learner profile is the starting point for planning."
      : "Start with the smallest truthful step for your AlgoCove account.";

  return (
    <main className="ac-home-main" id="main-content" tabIndex={-1}>
      <section className="ac-home-hero" aria-labelledby="greeting-title">
        <div>
          <h1 id="greeting-title">{heading}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="ac-week-context">
          <span>Foundation phase</span>
          <div className="ac-progress-track" aria-hidden="true">
            <i style={{ width: "0%" }} />
          </div>
          <small>{state === "ready" ? "Profile saved" : "Setup required"}</small>
        </div>
        <div className="ac-hero-quote">
          Calmer
          <br />
          practice
          <br />
          Clearer thinking
          <br />
          <b>―</b>
        </div>
      </section>
      <section className="ac-panel ac-continue" aria-labelledby="continue-title">
        <div className="ac-section-heading">
          <Icon name="book" size={24} />
          <h2 id="continue-title">Continue learning</h2>
        </div>
        <div className="ac-continue__grid">
          <div className="ac-continue__copy">
            <div className="ac-lesson-type">
              <span className="ac-lesson-glyph">
                <Icon name="target" size={25} />
              </span>
              <span>{state === "ready" ? "Learner profile" : "Profile setup"}</span>
            </div>
            <h3>
              {state === "ready"
                ? `${profile?.targetRole || "Your"} learning plan`
                : "Shape the learning loop around your week"}
            </h3>
            <div className="ac-inline-meta">
              {state === "ready" ? (
                <>
                  <span>
                    <Icon name="clock" size={17} />
                    {profile?.dailyCapacityMinutes} minutes/day
                  </span>
                  <span>
                    <Icon name="calendar" size={17} />
                    {profile?.horizonDays}-day horizon
                  </span>
                </>
              ) : (
                <span>
                  <Icon name="info" size={17} />
                  No plan has been generated yet
                </span>
              )}
            </div>
            <p>
              {state === "ready"
                ? profile?.goal
                : "AlgoCove uses this private profile to prepare a plan. It does not invent progress or review history before you have evidence."}
            </p>
            <div
              className="ac-session-path ac-session-path--status"
              aria-label="Current product readiness"
            >
              <div className="ac-path-step is-complete">
                <span className="ac-path-node">{state === "ready" ? "✓" : "1"}</span>
                <strong>Profile</strong>
                <small>{state === "ready" ? "Saved" : "Required"}</small>
              </div>
              <div className={`ac-path-step${state === "ready" ? " is-current" : ""}`}>
                <span className="ac-path-node">2</span>
                <strong>Plan</strong>
                <small>{state === "ready" ? "Next phase" : "Waiting"}</small>
              </div>
              <div className="ac-path-step">
                <span className="ac-path-node">3</span>
                <strong>Practice</strong>
                <small>Not available</small>
              </div>
              <div className="ac-path-step">
                <span className="ac-path-node">4</span>
                <strong>Review</strong>
                <small>Not available</small>
              </div>
            </div>
            <div className="ac-button-row">
              {state === "signed-out" ? (
                <a className="ac-button ac-button--primary" href="/sign-in">
                  Sign in to continue <Icon name="arrow" size={19} />
                </a>
              ) : (
                <a className="ac-button ac-button--primary" href="/onboarding">
                  {state === "ready" ? "Edit learner profile" : "Set up learner profile"}{" "}
                  <Icon name="arrow" size={19} />
                </a>
              )}
              <a className="ac-button ac-button--secondary" href="/onboarding">
                <Icon name="info" size={19} />
                View setup details
              </a>
            </div>
          </div>
          <div className="ac-real-status-card">
            <Icon name={state === "ready" ? "target" : "info"} size={30} />
            <strong>
              {state === "ready"
                ? "Profile saved"
                : state === "signed-out"
                  ? "Sign in required"
                  : state === "error"
                    ? "Profile service unavailable"
                    : state === "loading"
                      ? "Loading profile"
                      : "No learner profile yet"}
            </strong>
            <p>
              {state === "ready"
                ? `${profile?.preferredLanguages.join(", ")} are selected as your preferred languages.`
                : state === "signed-out"
                  ? "Your learner data is private to your account. Sign in to access it."
                  : state === "error"
                    ? "Try refreshing this page. We will not show stale or invented progress."
                    : state === "loading"
                      ? "Checking the saved profile for this account."
                      : "Complete setup before a plan or progress view can be truthful."}
            </p>
            {state === "ready" && (
              <div className="ac-language-list">
                {profile?.preferredLanguages.map((language) => (
                  <span key={language}>{language}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
      <div className="ac-two-column">
        <section className="ac-panel ac-plan" aria-labelledby="today-plan-title">
          <div className="ac-panel-heading">
            <div className="ac-section-heading">
              <Icon name="calendar" size={24} />
              <h2 id="today-plan-title">Today&apos;s plan</h2>
            </div>
            {state === "ready" && (
              <a className="ac-small-button" href="/onboarding">
                Adjust profile
              </a>
            )}
          </div>
          <div className="ac-empty-panel">
            <Icon name="calendar" size={27} />
            <strong>
              {state === "ready" ? "Planning is the next product phase" : "No plan to show yet"}
            </strong>
            <span>
              {state === "ready"
                ? "Your profile is saved. A validated roadmap will populate this area when roadmap planning is implemented."
                : "Complete learner setup before daily work can be scheduled."}
            </span>
          </div>
        </section>
        <section className="ac-panel ac-review" aria-labelledby="review-title">
          <div className="ac-panel-heading">
            <div className="ac-section-heading">
              <Icon name="clock" size={24} />
              <h2 id="review-title">Review queue</h2>
            </div>
            <span className="ac-updated">Evidence-led</span>
          </div>
          <div className="ac-empty-panel">
            <Icon name="journal" size={27} />
            <strong>No review evidence yet</strong>
            <span>
              Reviews appear only after a real guided session produces learner evidence. Nothing is
              marked complete in advance.
            </span>
          </div>
        </section>
      </div>
      <section className="ac-panel ac-signals" aria-labelledby="signals-title">
        <div className="ac-panel-heading">
          <div className="ac-section-heading">
            <Icon name="chart" size={24} />
            <h2 id="signals-title">Your learning signals</h2>
          </div>
          <span className="ac-updated">No evidence recorded</span>
        </div>
        <div className="ac-signal-grid ac-signal-grid--real">
          {[
            ["Internal mastery", "Awaiting evidence", "Lesson and assessment observations"],
            ["External practice", "Self-reported only", "No provider sync or verification"],
            ["Plan adherence", "Not available", "Requires a validated plan"],
            ["Review health", "Not available", "Requires spaced review data"],
            ["Consistency", "Not available", "Requires dated learning activity"],
          ].map(([title, value, detail], index) => (
            <article
              className={`ac-signal ac-signal--${index === 1 ? "blue" : index === 3 ? "sand" : "jade"}`}
              key={title}
            >
              <Icon
                name={
                  index === 0
                    ? "leaf"
                    : index === 1
                      ? "external"
                      : index === 2
                        ? "target"
                        : index === 3
                          ? "journal"
                          : "calendar"
                }
                size={22}
              />
              <span className="ac-signal__title">{title}</span>
              <strong className="ac-signal__real-value">{value}</strong>
              <p>{detail}</p>
            </article>
          ))}
        </div>
        <div className="ac-insight">
          <Icon name="info" size={21} />
          <span>
            AlgoCove keeps activity, external self-reports, mastery, review health, and consistency
            separate. This surface will only show values backed by product evidence.
          </span>
        </div>
      </section>
    </main>
  );
}
