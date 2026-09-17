"use client";

import { useEffect, useState, type FormEvent, type ReactElement } from "react";
import AlgoCoveShell from "../../src/components/algocove-shell";

type ProfileForm = {
  goal: string;
  targetRole: string;
  timezone: string;
  dailyCapacityMinutes: string;
  horizonDays: string;
  reducedMotion: boolean;
  highContrast: boolean;
  screenReader: boolean;
  preferredLanguages: string;
  version?: number;
};

const initialForm: ProfileForm = {
  goal: "",
  targetRole: "",
  timezone: "UTC",
  dailyCapacityMinutes: "45",
  horizonDays: "30",
  reducedMotion: false,
  highContrast: false,
  screenReader: false,
  preferredLanguages: "python,typescript",
};

const focusRing =
  "focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-[var(--focus-ring-offset)]";
const inputClass = `mt-2 min-h-11 w-full rounded-cove-sm border border-cove-strong bg-cove-surface px-3 py-2 text-cove-primary ${focusRing}`;

export default function OnboardingPage(): ReactElement {
  const [form, setForm] = useState<ProfileForm>(initialForm);
  const [status, setStatus] = useState<"loading" | "ready" | "saved" | "signed-out" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("Loading your learning profile.");

  useEffect(() => {
    void fetch("/api/onboarding", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          setStatus("signed-out");
          setMessage("Sign in with Clerk to set your learning profile.");
          return;
        }
        if (!response.ok) {
          setStatus("error");
          setMessage("We could not load your profile. Try again.");
          return;
        }
        const body = (await response.json()) as { profile: Record<string, unknown> | null };
        if (body.profile === null) {
          setStatus("ready");
          setMessage("Start with a few details so the learning loop fits your week.");
          return;
        }
        const profile = body.profile;
        const accessibility = (profile.accessibility as Record<string, unknown> | undefined) ?? {};
        const nextForm: ProfileForm = {
          goal: String(profile.goal ?? ""),
          targetRole: String(profile.targetRole ?? ""),
          timezone: String(profile.timezone ?? "UTC"),
          dailyCapacityMinutes: String(profile.dailyCapacityMinutes ?? 45),
          horizonDays: String(profile.horizonDays ?? 30),
          reducedMotion: accessibility.reducedMotion === true,
          highContrast: accessibility.highContrast === true,
          screenReader: accessibility.screenReader === true,
          preferredLanguages: Array.isArray(profile.preferredLanguages)
            ? profile.preferredLanguages.join(",")
            : "python,typescript",
          ...(typeof profile.version === "number" ? { version: profile.version } : {}),
        };
        setForm(nextForm);
        setStatus("ready");
        setMessage("Your profile is ready to edit.");
      })
      .catch(() => {
        setStatus("error");
        setMessage("We could not reach the profile service. Try again.");
      });
  }, []);

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setStatus("loading");
    setMessage("Saving your profile.");
    const response = await fetch("/api/onboarding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal: form.goal,
        targetRole: form.targetRole,
        timezone: form.timezone,
        dailyCapacityMinutes: Number(form.dailyCapacityMinutes),
        horizonDays: Number(form.horizonDays),
        accessibility: {
          reducedMotion: form.reducedMotion,
          highContrast: form.highContrast,
          screenReader: form.screenReader,
        },
        preferredLanguages: form.preferredLanguages
          .split(",")
          .map((language) => language.trim().toLowerCase())
          .filter(Boolean),
        ...(form.version === undefined ? {} : { version: form.version }),
      }),
    });
    if (!response.ok) {
      setStatus("error");
      setMessage("We could not save that profile. Check the fields and try again.");
      return;
    }
    const body = (await response.json()) as { profile: { version: number } };
    setForm((current) => ({ ...current, version: body.profile.version }));
    setStatus("saved");
    setMessage("Profile saved. Your learning plan can now use it.");
  }

  return (
    <AlgoCoveShell active="Today">
      <main
        id="main-content"
        tabIndex={-1}
        className="ac-form-page mx-auto min-h-svh w-[calc(100%-32px)] max-w-[760px] py-10 sm:w-[calc(100%-48px)] sm:py-16"
      >
        <a className={`text-cove-body-sm text-cove-link underline ${focusRing}`} href="/">
          Back to home
        </a>
        <header className="mb-8 mt-8">
          <p className="mb-3 text-cove-label font-semibold uppercase tracking-[0.08em] text-cove-link">
            Learner setup
          </p>
          <h1 className="mb-4 font-cove-display text-cove-h2 font-semibold text-cove-primary">
            Shape the learning loop around your week.
          </h1>
          <p className="max-w-[60ch] text-cove-body-lg text-cove-body">
            These settings are private to your AlgoCove learner profile and can be changed later.
          </p>
        </header>

        <div
          role="status"
          aria-live="polite"
          className="mb-6 border-l-2 border-cove-link pl-3 text-cove-body-sm text-cove-secondary"
        >
          {message}
        </div>

        {status === "signed-out" ? (
          <a
            className={`inline-flex min-h-11 items-center rounded-cove-sm bg-cove-action-primary px-4 py-3 font-semibold text-cove-on-dark no-underline ${focusRing}`}
            href="/sign-in"
          >
            Sign in with Clerk
          </a>
        ) : (
          <form className="grid gap-6" onSubmit={submit} aria-busy={status === "loading"}>
            <div className="grid gap-6 sm:grid-cols-2">
              <label className="text-cove-body-sm font-semibold sm:col-span-2">
                Learning goal
                <textarea
                  className={`${inputClass} min-h-28`}
                  value={form.goal}
                  onChange={(event) => update("goal", event.target.value)}
                  required
                  maxLength={500}
                />
              </label>
              <label className="text-cove-body-sm font-semibold">
                Target role
                <input
                  className={inputClass}
                  value={form.targetRole}
                  onChange={(event) => update("targetRole", event.target.value)}
                  required
                  maxLength={120}
                />
              </label>
              <label className="text-cove-body-sm font-semibold">
                Time zone
                <input
                  className={inputClass}
                  value={form.timezone}
                  onChange={(event) => update("timezone", event.target.value)}
                  required
                />
              </label>
              <label className="text-cove-body-sm font-semibold">
                Daily minutes
                <input
                  className={inputClass}
                  type="number"
                  min="15"
                  max="480"
                  step="1"
                  value={form.dailyCapacityMinutes}
                  onChange={(event) => update("dailyCapacityMinutes", event.target.value)}
                  required
                />
              </label>
              <label className="text-cove-body-sm font-semibold">
                Planning horizon (days)
                <input
                  className={inputClass}
                  type="number"
                  min="7"
                  max="365"
                  step="1"
                  value={form.horizonDays}
                  onChange={(event) => update("horizonDays", event.target.value)}
                  required
                />
              </label>
              <label className="text-cove-body-sm font-semibold sm:col-span-2">
                Preferred languages
                <input
                  className={inputClass}
                  value={form.preferredLanguages}
                  onChange={(event) => update("preferredLanguages", event.target.value)}
                  aria-describedby="language-help"
                  required
                />
                <span
                  id="language-help"
                  className="mt-2 block font-normal text-cove-meta text-cove-secondary"
                >
                  Comma-separated: python, javascript, typescript, java, cpp, or c.
                </span>
              </label>
            </div>

            <fieldset className="grid gap-3 border-t border-cove-default pt-6">
              <legend className="text-cove-body-sm font-semibold">Accessibility preferences</legend>
              {(
                [
                  ["reducedMotion", "Reduce motion"],
                  ["highContrast", "Use higher contrast"],
                  ["screenReader", "Optimize for screen reader use"],
                ] as const
              ).map(([key, label]) => (
                <label className="flex min-h-11 items-center gap-3 text-cove-body-sm" key={key}>
                  <input
                    className="size-5 accent-cove-action-primary"
                    type="checkbox"
                    checked={form[key]}
                    onChange={(event) => update(key, event.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>

            <button
              className={`inline-flex min-h-11 w-fit items-center justify-center rounded-cove-sm bg-cove-action-primary px-4 py-3 font-semibold text-cove-on-dark hover:bg-cove-action-primary-hover disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
              disabled={status === "loading"}
              type="submit"
            >
              {status === "loading" ? "Saving…" : "Save profile"}
            </button>
          </form>
        )}
      </main>
    </AlgoCoveShell>
  );
}
