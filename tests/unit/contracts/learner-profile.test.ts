import { describe, expect, it } from "vitest";
import {
  createFixedClock,
  createRequestContext,
  createSequenceIdGenerator,
  saveLearnerProfile,
  getLearnerProfile,
  type LearnerProfileRepository,
} from "@algocove/application";
import {
  formatId,
  parseLearnerProfileInput,
  parseInstant,
  ROLES,
  type LearnerProfile,
} from "@algocove/domain";

const learner = formatId("learner", "0000000000000001");
const otherLearner = formatId("learner", "0000000000000002");
const session = formatId("session", "0000000000000003");
const instant = parseInstant("2026-09-17T10:00:00.000Z");

if (!learner.ok || !otherLearner.ok || !session.ok || !instant.ok) {
  throw new Error("profile fixtures are invalid");
}

if (!learner.ok) throw new Error("profile learner fixture is invalid");
if (!otherLearner.ok) throw new Error("profile other learner fixture is invalid");
if (!session.ok) throw new Error("profile session fixture is invalid");
if (!instant.ok) throw new Error("profile instant fixture is invalid");

const learnerId = learner.value;
const otherLearnerId = otherLearner.value;
const sessionId = session.value;
const fixedInstant = instant.value;

const baseInput = {
  goal: "Prepare for an algorithms interview",
  targetRole: "software engineer",
  timezone: "Asia/Kolkata",
  dailyCapacityMinutes: 45,
  horizonDays: 30,
  accessibility: { reducedMotion: true, highContrast: false, screenReader: false },
  preferredLanguages: ["python", "typescript"],
} as const;

function contextFor(userId = learnerId) {
  return createRequestContext({
    actor: {
      userId,
      sessionId,
      roles: [ROLES.learner],
      privileged: false,
    },
    clock: createFixedClock(fixedInstant),
    ids: createSequenceIdGenerator(),
    serviceName: "algocove-web",
  });
}

function memoryRepository(initial?: LearnerProfile): LearnerProfileRepository {
  let current = initial;
  let ownerId = initial?.learnerId ?? learnerId;
  return {
    async get(learnerId) {
      return learnerId === ownerId ? (current ?? null) : null;
    },
    async create(profile) {
      ownerId = profile.learnerId;
      current = profile;
      return profile;
    },
    async update(input) {
      if (
        current === undefined ||
        ownerId !== input.learnerId ||
        current.version !== input.expectedVersion
      ) {
        return null;
      }
      current = { ...input.profile, version: current.version + 1 };
      return current;
    },
  };
}

describe("learner profile contract", () => {
  it("validates timezone, capacity, horizon, accessibility, and languages", () => {
    expect(parseLearnerProfileInput(baseInput).ok).toBe(true);
    expect(parseLearnerProfileInput({ ...baseInput, timezone: "Mars/Olympus" }).ok).toBe(false);
    expect(parseLearnerProfileInput({ ...baseInput, dailyCapacityMinutes: 5 }).ok).toBe(false);
    expect(parseLearnerProfileInput({ ...baseInput, preferredLanguages: ["ruby"] }).ok).toBe(false);
    expect(
      parseLearnerProfileInput({ ...baseInput, accessibility: { reducedMotion: "yes" } }).ok,
    ).toBe(false);
  });

  it("allows the owner to create and update a profile with an audit version", async () => {
    const repository = memoryRepository();
    const created = await saveLearnerProfile(contextFor(), repository, baseInput);
    expect(created.version).toBe(1);
    expect(created.updatedBy).toBe(learnerId);

    const updated = await saveLearnerProfile(contextFor(), repository, {
      ...baseInput,
      goal: "Build durable DSA intuition",
      version: created.version,
    });
    expect(updated.version).toBe(2);
    expect(updated.goal).toBe("Build durable DSA intuition");
    expect((await getLearnerProfile(contextFor(), repository))?.version).toBe(2);
  });

  it("does not allow a learner to read or mutate another learner profile", async () => {
    const repository = memoryRepository();
    await saveLearnerProfile(contextFor(), repository, baseInput);

    await expect(
      getLearnerProfile(contextFor(otherLearnerId), repository, learnerId),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});
