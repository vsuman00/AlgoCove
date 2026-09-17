import { describe, expect, it } from "vitest";
import {
  createFixedClock,
  createRequestContext,
  createSequenceIdGenerator,
  publishCurriculumVersion,
} from "@algocove/application";
import {
  formatId,
  isPublishedCurriculumGraphImmutable,
  parseInstant,
  publishCurriculumGraph,
  validateCurriculumGraph,
  type ConceptId,
  type CurriculumGraphInput,
  ROLES,
} from "@algocove/domain";

function conceptId(seed: string): ConceptId {
  const result = formatId("concept", seed.padEnd(16, "0"));
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function graph(overrides: Partial<CurriculumGraphInput> = {}): CurriculumGraphInput {
  const arrays = [conceptId("aaaaaaaa"), conceptId("bbbbbbbb"), conceptId("cccccccc")];
  return {
    concepts: arrays.map((id, index) => ({
      conceptId: id,
      slug: ["arrays", "hashing", "two-pointers"][index]!,
      title: ["Arrays", "Hashing", "Two pointers"][index]!,
      summary: "A bounded curriculum concept.",
    })),
    nodes: arrays.map((conceptId, ordinal) => ({
      conceptId,
      objective: `Explain objective ${ordinal + 1}`,
      ordinal,
    })),
    edges: [
      { fromConceptId: arrays[0]!, toConceptId: arrays[1]!, kind: "required" },
      { fromConceptId: arrays[1]!, toConceptId: arrays[2]!, kind: "recommended" },
    ],
    ...overrides,
  };
}

describe("curriculum graph contract", () => {
  it("preserves required, recommended, and related edge semantics", () => {
    const concepts = [
      conceptId("aaaaaaaa"),
      conceptId("bbbbbbbb"),
      conceptId("cccccccc"),
      conceptId("dddddddd"),
    ];
    const result = validateCurriculumGraph({
      concepts: concepts.map((id, index) => ({
        conceptId: id,
        slug: `concept-${index}`,
        title: `Concept ${index}`,
        summary: "Summary",
      })),
      nodes: concepts.map((conceptId, ordinal) => ({ conceptId, objective: "Objective", ordinal })),
      edges: [
        { fromConceptId: concepts[0]!, toConceptId: concepts[1]!, kind: "required" },
        { fromConceptId: concepts[1]!, toConceptId: concepts[2]!, kind: "recommended" },
        { fromConceptId: concepts[2]!, toConceptId: concepts[3]!, kind: "related" },
      ],
    });

    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("rejects a graph with a cycle across any edge kind", () => {
    const input = graph();
    const first = input.concepts[0]!.conceptId;
    const last = input.concepts[2]!.conceptId;
    const result = validateCurriculumGraph({
      ...input,
      edges: [...input.edges, { fromConceptId: last, toConceptId: first, kind: "related" }],
    });

    expect(result).toMatchObject({ ok: false, error: { code: "cycle_detected" } });
  });

  it("rejects an edge that references a concept outside the graph", () => {
    const input = graph();
    const result = validateCurriculumGraph({
      ...input,
      edges: [
        ...input.edges,
        {
          fromConceptId: input.concepts[0]!.conceptId,
          toConceptId: conceptId("eeeeeeee"),
          kind: "required",
        },
      ],
    });

    expect(result).toMatchObject({ ok: false, error: { code: "unknown_edge_concept" } });
  });

  it("publishes a validated version as a copied immutable snapshot", () => {
    const input = graph();
    const versionId = formatId("curriculumVersion", "vvvvvvvvvvvvvvvv");
    const createdAt = parseInstant(new Date("2026-09-17T10:00:00.000Z"));
    if (!versionId.ok || !createdAt.ok) throw new Error("curriculum fixture is invalid");
    const result = publishCurriculumGraph({
      curriculumVersionId: versionId.value,
      versionNumber: 1,
      graph: input,
      createdAt: createdAt.value,
      publishedAt: createdAt.value,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("published");
      expect(result.value.concepts).not.toBe(input.concepts);
      expect(result.value.edges).toEqual(input.edges);
    }
    expect(isPublishedCurriculumGraphImmutable()).toBe(true);
  });

  it("requires the publisher permission at the application boundary", async () => {
    const learner = formatId("learner", "aaaaaaaaaaaaaaaa");
    const session = formatId("session", "bbbbbbbbbbbbbbbb");
    const versionId = formatId("curriculumVersion", "cccccccccccccccc");
    const instant = parseInstant(new Date("2026-09-17T10:00:00.000Z"));
    if (!learner.ok || !session.ok || !versionId.ok || !instant.ok) {
      throw new Error("application curriculum fixture is invalid");
    }
    const context = createRequestContext({
      actor: {
        userId: learner.value,
        sessionId: session.value,
        roles: [ROLES.learner],
        privileged: false,
      },
      clock: createFixedClock(instant.value),
      ids: createSequenceIdGenerator(),
      serviceName: "algocove-test",
    });
    const repository = {
      publish: async (value: Awaited<ReturnType<typeof publishCurriculumVersion>>) => value,
      getPublished: async () => null,
    };

    await expect(
      publishCurriculumVersion(context, repository, {
        curriculumVersionId: versionId.value,
        versionNumber: 1,
        graph: graph(),
      }),
    ).rejects.toThrow("permission");
  });
});
