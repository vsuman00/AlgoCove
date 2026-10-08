import type { ProblemLanguage } from "@algocove/domain";
import { PROBLEM_LANGUAGES } from "@algocove/domain";
import type { PilotBundle, PilotPublicView } from "./pilot-bundle.ts";

export type LessonBlock = { kind: "prose" | "example"; text: string };
export type LearningBrief = {
  input: string;
  output: string;
  invariant: string;
  complexity: string;
};
export type ReleaseQuestion = {
  id: string;
  prompt: string;
  options: { id: string; text: string }[];
  answer: string;
};
export type ReleasePacket = {
  schemaVersion: 1;
  slug: string;
  pattern: string;
  brief: LearningBrief;
  lesson: { objectives: string[]; prerequisites: string[]; blocks: LessonBlock[] };
  questions: ReleaseQuestion[];
  hints: { tier: number; text: string }[];
  review: { afterDays: number[]; question: ReleaseQuestion };
  transfer: { delayDays: number; title: string; statement: string; question: ReleaseQuestion };
  media: {
    role: "explanation" | "video";
    title: string;
    url: string;
    transcript: string;
    essential: boolean;
  }[];
};
export type LearningPublicView = {
  schemaVersion: 1;
  slug: string;
  pattern: string;
  brief: LearningBrief;
  lesson: ReleasePacket["lesson"];
  questions: Omit<ReleaseQuestion, "answer">[];
  media: ReleasePacket["media"];
  traceKind: "pilot" | "legacy" | "unavailable";
};
export type ReleaseManifest = {
  schemaVersion: 1;
  releaseId: string;
  contentVersionId: string;
  problemVersionId: string;
  sourceChecksum: string;
  assets: { role: string; versionId: string; checksum: string }[];
  languages: { language: ProblemLanguage; manifestId: string }[];
};
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown, max = 4000): v is string =>
  typeof v === "string" &&
  v.trim().length > 0 &&
  v.length <= max &&
  !/<\/?[a-z!]|javascript:|data:/i.test(v);
function fields(v: unknown, allowed: string[]): asserts v is Record<string, unknown> {
  if (!record(v) || Object.keys(v).some((k) => !allowed.includes(k)))
    throw Error("Unsupported release field.");
}
/** Author/operator-only packet. Public views must be explicitly projected. */
export function validateReleasePacket(raw: unknown): ReleasePacket {
  fields(raw, [
    "schemaVersion",
    "slug",
    "pattern",
    "brief",
    "lesson",
    "questions",
    "hints",
    "review",
    "transfer",
    "media",
  ]);
  if (
    raw.schemaVersion !== 1 ||
    !text(raw.slug, 64) ||
    !/^[a-z][a-z0-9-]{1,63}$/.test(raw.slug) ||
    !text(raw.pattern, 64) ||
    !/^[a-z][a-z0-9-]{1,63}$/.test(raw.pattern) ||
    Object.hasOwn(Object.prototype, raw.slug) ||
    Object.hasOwn(Object.prototype, raw.pattern)
  )
    throw Error("Unsupported release identity.");
  fields(raw.brief, ["input", "output", "invariant", "complexity"]);
  const brief = raw.brief;
  if (!["input", "output", "invariant", "complexity"].every((k) => text(brief[k])))
    throw Error("Complete learning brief required.");
  fields(raw.lesson, ["objectives", "prerequisites", "blocks"]);
  const lesson = raw.lesson;
  if (
    !Array.isArray(lesson.objectives) ||
    lesson.objectives.length < 1 ||
    lesson.objectives.length > 12 ||
    !lesson.objectives.every((v) => text(v, 500)) ||
    !Array.isArray(lesson.prerequisites) ||
    lesson.prerequisites.length > 20 ||
    !lesson.prerequisites.every((v) => typeof v === "string" && /^[a-z][a-z0-9-]{1,63}$/.test(v)) ||
    !Array.isArray(lesson.blocks) ||
    lesson.blocks.length < 1 ||
    lesson.blocks.length > 40
  )
    throw Error("Bounded lesson required.");
  for (const block of lesson.blocks) {
    fields(block, ["kind", "text"]);
    if (!["prose", "example"].includes(String(block.kind)) || !text(block.text))
      throw Error("Unsafe lesson block.");
  }
  if (
    !Array.isArray(raw.questions) ||
    raw.questions.length < 1 ||
    raw.questions.length > 8 ||
    new Set(raw.questions.map((q: unknown) => (record(q) ? q.id : null))).size !==
      raw.questions.length
  )
    throw Error("Bounded unique questions required.");
  for (const q of raw.questions) {
    fields(q, ["id", "prompt", "options", "answer"]);
    if (
      !text(q.id, 64) ||
      !/^[a-z][a-z0-9_]{0,63}$/.test(q.id) ||
      !text(q.prompt, 1600) ||
      !Array.isArray(q.options) ||
      q.options.length < 2 ||
      q.options.length > 8
    )
      throw Error("Invalid release checkpoint.");
    for (const o of q.options) {
      fields(o, ["id", "text"]);
      if (!text(o.id, 64) || !text(o.text, 500)) throw Error("Invalid checkpoint option.");
    }
    if (
      new Set(q.options.map((o) => o.id)).size !== q.options.length ||
      !q.options.some((o) => o.id === q.answer)
    )
      throw Error("Checkpoint answer required.");
  }
  if (
    !Array.isArray(raw.hints) ||
    raw.hints.length !== 6 ||
    raw.hints.some(
      (h, i) =>
        !record(h) ||
        Object.keys(h).some((k) => !["tier", "text"].includes(k)) ||
        h.tier !== i + 1 ||
        !text(h.text),
    )
  )
    throw Error("Six bounded hints required.");
  fields(raw.review, ["afterDays", "question"]);
  fields(raw.transfer, ["delayDays", "title", "statement", "question"]);
  const review = raw.review,
    transfer = raw.transfer;
  if (
    !Array.isArray(review.afterDays) ||
    review.afterDays.length < 1 ||
    review.afterDays.length > 8 ||
    !review.afterDays.every((d) => Number.isInteger(d) && d >= 1 && d <= 365) ||
    !Number.isInteger(transfer.delayDays) ||
    Number(transfer.delayDays) < 1 ||
    Number(transfer.delayDays) > 365 ||
    !text(transfer.title, 200) ||
    !text(transfer.statement)
  )
    throw Error("Delayed review and transfer required.");
  for (const question of [review.question, transfer.question]) {
    fields(question, ["id", "prompt", "options", "answer"]);
    if (
      !text(question.id, 64) ||
      !/^[a-z][a-z0-9_]{0,63}$/.test(question.id) ||
      !text(question.prompt, 1600) ||
      !Array.isArray(question.options) ||
      question.options.length < 2 ||
      question.options.length > 8
    )
      throw Error("Invalid review question.");
    for (const option of question.options) {
      fields(option, ["id", "text"]);
      if (!text(option.id, 64) || !text(option.text, 500)) throw Error("Invalid review option.");
    }
    if (
      new Set(question.options.map((o) => o.id)).size !== question.options.length ||
      !question.options.some((o) => o.id === question.answer)
    )
      throw Error("Review answer required.");
  }
  if (!Array.isArray(raw.media) || raw.media.length > 8)
    throw Error("Bounded optional media required.");
  for (const m of raw.media) {
    fields(m, ["role", "title", "url", "transcript", "essential"]);
    if (
      !["explanation", "video"].includes(String(m.role)) ||
      !text(m.title, 200) ||
      typeof m.url !== "string" ||
      m.url.length > 2048 ||
      typeof m.essential !== "boolean" ||
      typeof m.transcript !== "string" ||
      m.transcript.length > 12000 ||
      (m.essential && !text(m.transcript, 12000))
    )
      throw Error("Invalid accessible media.");
    const url = new URL(m.url);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.hash ||
      !["youtube.com", "www.youtube.com", "youtu.be", "leetcode.com", "neetcode.io"].includes(
        url.hostname,
      )
    )
      throw Error("Media host is not allowlisted.");
  }
  return structuredClone(raw) as ReleasePacket;
}
export function releasePublicView(
  raw: unknown,
  traceKind: LearningPublicView["traceKind"] = "unavailable",
): LearningPublicView {
  const p = validateReleasePacket(raw);
  return {
    schemaVersion: 1,
    slug: p.slug,
    pattern: p.pattern,
    brief: p.brief,
    lesson: p.lesson,
    questions: p.questions.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options })),
    media: p.media,
    traceKind,
  };
}
export function pilotReleasePacket(bundle: PilotBundle): ReleasePacket {
  return validateReleasePacket({
    schemaVersion: 1,
    slug: bundle.slug,
    pattern: bundle.pattern,
    brief: {
      input: bundle.statement,
      output: "Integer result; preserve the input",
      invariant: bundle.lesson.invariant,
      complexity: bundle.lesson.complexity,
    },
    lesson: {
      objectives: [bundle.lesson.invariant],
      prerequisites: [],
      blocks: [
        { kind: "prose", text: bundle.lesson.summary },
        ...bundle.lesson.recognition.map((text) => ({ kind: "example", text })),
      ],
    },
    questions: [
      {
        id: "pattern",
        prompt: bundle.review.prompt,
        options: bundle.review.options,
        answer: bundle.review.correctOption,
      },
    ],
    hints: bundle.hints,
    review: {
      afterDays: bundle.review.afterDays,
      question: {
        id: "pattern",
        prompt: bundle.review.prompt,
        options: bundle.review.options,
        answer: bundle.review.correctOption,
      },
    },
    transfer: {
      delayDays: bundle.transfer.delayDays,
      title: bundle.transfer.title,
      statement: bundle.transfer.statement,
      question: {
        id: "transfer",
        prompt: bundle.transfer.checkpoint.prompt,
        options: bundle.transfer.checkpoint.options,
        answer: bundle.transfer.checkpoint.correctOption,
      },
    },
    media: [],
  });
}
/** Compatibility projection for already published pilot v1 metadata; no private bundle needed. */
export function pilotLearningView(p: PilotPublicView): LearningPublicView {
  return {
    schemaVersion: 1,
    slug: p.slug,
    pattern: p.pattern,
    brief: {
      input: `Integer readings 0–${p.semantics.maxValue}, at most ${p.semantics.maxLength}; ${p.semantics.sortedDistinct ? "sorted and distinct" : "arrival order"}`,
      output: "Integer result; preserve the input",
      invariant: p.lesson.invariant,
      complexity: p.lesson.complexity,
    },
    lesson: {
      objectives: [p.lesson.invariant],
      prerequisites: [],
      blocks: [
        { kind: "prose", text: p.lesson.summary },
        ...p.lesson.recognition.map((text) => ({ kind: "example" as const, text })),
      ],
    },
    questions: [p.checkpoint],
    media: [],
    traceKind: "pilot",
  };
}
export function validateReleaseManifest(m: ReleaseManifest): void {
  if (
    m.schemaVersion !== 1 ||
    m.releaseId !== m.contentVersionId ||
    !/^sha256:[0-9a-f]{64}$/.test(m.sourceChecksum) ||
    m.assets.length < 3 ||
    m.assets.length > 32 ||
    new Set(m.assets.map((a) => a.role)).size !== m.assets.length ||
    !["lesson", "rubric", "walkthrough"].every((role) => m.assets.some((a) => a.role === role)) ||
    m.assets.some(
      (a) =>
        !a.versionId.startsWith(`${m.contentVersionId}:`) ||
        !/^sha256:[0-9a-f]{64}$/.test(a.checksum),
    ) ||
    m.languages.length !== 6 ||
    !PROBLEM_LANGUAGES.every((l) => m.languages.some((a) => a.language === l)) ||
    new Set(m.languages.map((a) => a.manifestId)).size !== 6
  )
    throw Error("Incompatible release pins.");
}
