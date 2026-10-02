"use client";
import RoadmapWorkspace from "./roadmap-workspace";
import { useEffect, useRef, useState, type ReactElement } from "react";
import {
  ROADMAP_HORIZONS,
  PROBLEM_LANGUAGES,
  addCalendarMonths,
  localStudyDay,
  type RoadmapHorizon,
  type RoadmapIntentVersion,
} from "@algocove/domain";
import type { PlanningContext } from "@algocove/application";
type Form = {
  goal: string;
  targetRole: string;
  horizonMonths: RoadmapHorizon;
  startDay: string;
  timezone: string;
  dailyCapacityMinutes: number;
  bufferPercent?: number;
  studyWeekdays: number[];
  preferredLanguages: string[];
  collectionIds: string[];
};
const empty: Form = {
  goal: "",
  targetRole: "",
  horizonMonths: 1,
  startDay: "",
  timezone: "UTC",
  dailyCapacityMinutes: 45,
  studyWeekdays: [1, 2, 3, 4, 5],
  preferredLanguages: ["python"],
  collectionIds: [],
};
async function read<T>(body?: unknown): Promise<T> {
  const response = await fetch("/api/planning/intent", {
    cache: "no-store",
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as {
      error?: { message: string };
    } | null;
    throw Error(
      response.status === 401
        ? "Sign in to save private planning preferences."
        : (envelope?.error?.message ?? "Planning service unavailable. Refresh to retry."),
    );
  }
  return response.json() as Promise<T>;
}
export default function PlanningPreferences(): ReactElement {
  const [context, setContext] = useState<PlanningContext | null>(null),
    [form, setForm] = useState<Form>(empty),
    [intent, setIntent] = useState<RoadmapIntentVersion | null>(null),
    [message, setMessage] = useState("Loading planning preferences…"),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0);
  const command = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => {
    let current = true;
    void read<PlanningContext & { asOf: RoadmapIntentVersion["savedAt"] }>()
      .then((body) => {
        if (!current) return;
        setContext(body);
        setIntent(body.intent);
        if (body.intent !== null)
          setForm({
            ...body.intent.preferences,
            studyWeekdays: [...body.intent.preferences.studyWeekdays],
            preferredLanguages: [...body.intent.preferences.preferredLanguages],
            collectionIds: [...body.intent.preferences.collectionIds],
          });
        else {
          const profile = body.profile;
          const timezone = profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
          setForm({
            ...empty,
            goal: profile?.goal ?? "",
            targetRole: profile?.targetRole ?? "",
            timezone,
            startDay: localStudyDay(body.asOf, timezone),
            dailyCapacityMinutes: profile?.dailyCapacityMinutes ?? 45,
            preferredLanguages: [...(profile?.preferredLanguages ?? ["python"])],
          });
        }
        setMessage(
          body.intent === null
            ? "Choose your planning preferences."
            : `Planning preferences revision ${body.intent.version} loaded.`,
        );
      })
      .catch((error: Error) => {
        if (current) {
          setContext(null);
          setMessage(error.message);
        }
      });
    return () => {
      current = false;
    };
  }, [reload]);
  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function toggle<K extends "preferredLanguages" | "collectionIds">(key: K, value: string) {
    update(
      key,
      form[key].includes(value)
        ? form[key].filter((item) => item !== value)
        : [...form[key], value],
    );
  }
  let endDay = "Choose a valid start date";
  try {
    endDay = addCalendarMonths(form.startDay, form.horizonMonths);
  } catch {
    /* Editable invalid dates receive server validation on save. */
  }
  async function save() {
    const body = {
      planId: intent?.planId ?? null,
      expectedVersion: intent?.version ?? null,
      preferences: form,
    };
    const fingerprint = JSON.stringify(body);
    if (command.current?.fingerprint !== fingerprint)
      command.current = { fingerprint, key: crypto.randomUUID() };
    setBusy(true);
    setMessage("Saving planning preferences…");
    try {
      const result = await read<{ intent: RoadmapIntentVersion; disposition: string }>({
        ...body,
        idempotencyKey: command.current.key,
      });
      setIntent(result.intent);
      setMessage(
        `Planning preferences revision ${result.intent.version} saved. Review a schedule preview before accepting changes.`,
      );
      command.current = null;
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="ac-home-main" id="main-content" tabIndex={-1}>
      <h1>Planning preferences</h1>
      <p>
        Choose your goal, calendar horizon and available study time. Saved preferences are inputs
        for a schedule; a schedule must be built, validated and reviewed before you accept it.
      </p>
      <p role="status">{message}</p>
      <button
        className="ac-small-button"
        disabled={busy}
        onClick={() => setReload((value) => value + 1)}
      >
        Reload saved preferences
      </button>
      {context !== null && (
        <section className="ac-profile-strip">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <fieldset disabled={busy}>
              <legend>Your planning inputs</legend>
              <label>
                Goal
                <input
                  required
                  maxLength={500}
                  value={form.goal}
                  onChange={(event) => update("goal", event.target.value)}
                />
              </label>
              <label>
                Target role
                <input
                  required
                  maxLength={120}
                  value={form.targetRole}
                  onChange={(event) => update("targetRole", event.target.value)}
                />
              </label>
              <label>
                Calendar horizon
                <select
                  value={form.horizonMonths}
                  onChange={(event) =>
                    update("horizonMonths", Number(event.target.value) as RoadmapHorizon)
                  }
                >
                  {ROADMAP_HORIZONS.map((months) => (
                    <option key={months} value={months}>
                      {months} {months === 1 ? "month" : "months"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Start day
                <input
                  required
                  type="date"
                  value={form.startDay}
                  onChange={(event) => update("startDay", event.target.value)}
                />
              </label>
              <label>
                Timezone
                <input
                  required
                  maxLength={128}
                  value={form.timezone}
                  onChange={(event) => update("timezone", event.target.value)}
                />
              </label>
              <p>
                Resolved target date: <strong>{endDay}</strong> in {form.timezone}. Month-end dates
                clamp to the last day of the target month.
              </p>
              <label>
                Study minutes per available day
                <input
                  required
                  type="number"
                  min={15}
                  max={480}
                  value={form.dailyCapacityMinutes}
                  onChange={(event) => update("dailyCapacityMinutes", Number(event.target.value))}
                />
              </label>
              <label>
                Recovery buffer (% of capacity)
                <input
                  type="number"
                  min={5}
                  max={40}
                  value={form.bufferPercent ?? 15}
                  onChange={(event) => update("bufferPercent", Number(event.target.value))}
                />
              </label>
              <fieldset>
                <legend>Study weekdays</legend>
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
                  (day, index) => (
                    <label className="ac-learning-option" key={day}>
                      <input
                        type="checkbox"
                        checked={form.studyWeekdays.includes(index + 1)}
                        onChange={() =>
                          update(
                            "studyWeekdays",
                            form.studyWeekdays.includes(index + 1)
                              ? form.studyWeekdays.filter((value) => value !== index + 1)
                              : [...form.studyWeekdays, index + 1],
                          )
                        }
                      />
                      {day}
                    </label>
                  ),
                )}
              </fieldset>
              <fieldset>
                <legend>Implementation languages</legend>
                {PROBLEM_LANGUAGES.map((language) => (
                  <label className="ac-learning-option" key={language}>
                    <input
                      type="checkbox"
                      checked={form.preferredLanguages.includes(language)}
                      onChange={() => toggle("preferredLanguages", language)}
                    />
                    {language}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>Supporting collections (optional)</legend>
                <p>
                  Selecting a collection does not imply internal coverage or provider account
                  synchronization.
                </p>
                {context.collections.length === 0 ? (
                  <p>No collections are registered yet.</p>
                ) : (
                  context.collections.map((collection) => (
                    <label className="ac-learning-option" key={collection.collectionId}>
                      <input
                        type="checkbox"
                        checked={form.collectionIds.includes(collection.collectionId)}
                        onChange={() => toggle("collectionIds", collection.collectionId)}
                      />
                      {collection.title}
                    </label>
                  ))
                )}
              </fieldset>
              <button className="ac-button ac-button--primary" type="submit">
                Save planning preferences
              </button>
            </fieldset>
          </form>
          {intent !== null && (
            <p>
              Saved revision {intent.version} · {new Date(intent.savedAt).toLocaleString()}
            </p>
          )}
        </section>
      )}
      {context !== null && <RoadmapWorkspace revision={intent?.version ?? 0} />}
    </main>
  );
}
