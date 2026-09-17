import {
  err,
  normalizeLearnerText,
  ok,
  textLength,
  type Instant,
  type OpaqueId,
  type Result,
} from "./primitives.ts";

export type ConceptId = OpaqueId<"concept">;
export type CurriculumVersionId = OpaqueId<"curriculumVersion">;

export const CURRICULUM_EDGE_KINDS = ["required", "recommended", "related"] as const;
export type CurriculumEdgeKind = (typeof CURRICULUM_EDGE_KINDS)[number];

export type CurriculumConcept = {
  readonly conceptId: ConceptId;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
};

export type CurriculumNode = {
  readonly conceptId: ConceptId;
  readonly objective: string;
  readonly ordinal: number;
};

export type CurriculumEdge = {
  /** The prerequisite/source concept. */
  readonly fromConceptId: ConceptId;
  /** The concept that depends on the source concept. */
  readonly toConceptId: ConceptId;
  readonly kind: CurriculumEdgeKind;
};

export type CurriculumGraphVersion = {
  readonly curriculumVersionId: CurriculumVersionId;
  readonly versionNumber: number;
  readonly status: "published";
  readonly concepts: readonly CurriculumConcept[];
  readonly nodes: readonly CurriculumNode[];
  readonly edges: readonly CurriculumEdge[];
  readonly createdAt: Instant;
  readonly publishedAt: Instant;
};

export type CurriculumFailureCode =
  | "empty_graph"
  | "invalid_concept"
  | "duplicate_concept"
  | "duplicate_node"
  | "invalid_objective"
  | "invalid_edge"
  | "unknown_edge_concept"
  | "cycle_detected"
  | "invalid_version";

export type CurriculumFailure = {
  readonly code: CurriculumFailureCode;
  readonly message: string;
  readonly conceptId?: ConceptId;
};

export type CurriculumGraphInput = {
  readonly concepts: readonly CurriculumConcept[];
  readonly nodes: readonly CurriculumNode[];
  readonly edges: readonly CurriculumEdge[];
};

const SLUG_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const EDGE_KIND_SET = new Set<string>(CURRICULUM_EDGE_KINDS);

function validText(value: string, maximum: number): boolean {
  const normalized = normalizeLearnerText(value);
  return normalized.length > 0 && textLength(normalized) <= maximum;
}

function validateConcepts(
  concepts: readonly CurriculumConcept[],
): Result<undefined, CurriculumFailure> {
  const seen = new Set<ConceptId>();
  for (const concept of concepts) {
    if (
      !SLUG_PATTERN.test(concept.slug) ||
      !validText(concept.title, 160) ||
      !validText(concept.summary, 500)
    ) {
      return err({
        code: "invalid_concept",
        message: "Concept slug, title, and summary must satisfy the curriculum contract.",
        conceptId: concept.conceptId,
      });
    }
    if (seen.has(concept.conceptId)) {
      return err({
        code: "duplicate_concept",
        message: "A curriculum graph cannot contain the same concept twice.",
        conceptId: concept.conceptId,
      });
    }
    seen.add(concept.conceptId);
  }
  return ok(undefined);
}

function validateNodes(
  concepts: readonly CurriculumConcept[],
  nodes: readonly CurriculumNode[],
): Result<undefined, CurriculumFailure> {
  const conceptIds = new Set(concepts.map((concept) => concept.conceptId));
  const seen = new Set<ConceptId>();
  for (const node of nodes) {
    if (!conceptIds.has(node.conceptId)) {
      return err({
        code: "unknown_edge_concept",
        message: "Every curriculum node must reference a concept in the same graph.",
        conceptId: node.conceptId,
      });
    }
    if (!Number.isInteger(node.ordinal) || node.ordinal < 0 || !validText(node.objective, 500)) {
      return err({
        code: "invalid_objective",
        message: "Curriculum objectives require a non-negative ordinal and bounded text.",
        conceptId: node.conceptId,
      });
    }
    if (seen.has(node.conceptId)) {
      return err({
        code: "duplicate_node",
        message: "A concept may appear only once in a graph version.",
        conceptId: node.conceptId,
      });
    }
    seen.add(node.conceptId);
  }
  return ok(undefined);
}

function validateEdges(
  concepts: readonly CurriculumConcept[],
  edges: readonly CurriculumEdge[],
): Result<ReadonlyMap<ConceptId, readonly ConceptId[]>, CurriculumFailure> {
  const conceptIds = new Set(concepts.map((concept) => concept.conceptId));
  const adjacency = new Map<ConceptId, ConceptId[]>();
  for (const concept of concepts) adjacency.set(concept.conceptId, []);

  for (const edge of edges) {
    if (
      !conceptIds.has(edge.fromConceptId) ||
      !conceptIds.has(edge.toConceptId) ||
      edge.fromConceptId === edge.toConceptId ||
      !EDGE_KIND_SET.has(edge.kind)
    ) {
      return err({
        code: edge.fromConceptId === edge.toConceptId ? "invalid_edge" : "unknown_edge_concept",
        message: "Curriculum edges must connect two distinct concepts in the same graph.",
        conceptId: edge.fromConceptId,
      });
    }
    adjacency.get(edge.fromConceptId)?.push(edge.toConceptId);
  }
  return ok(adjacency);
}

function isAcyclic(adjacency: ReadonlyMap<ConceptId, readonly ConceptId[]>): ConceptId | null {
  const visiting = new Set<ConceptId>();
  const visited = new Set<ConceptId>();

  function visit(conceptId: ConceptId): ConceptId | null {
    if (visiting.has(conceptId)) return conceptId;
    if (visited.has(conceptId)) return null;
    visiting.add(conceptId);
    for (const next of adjacency.get(conceptId) ?? []) {
      const cycle = visit(next);
      if (cycle !== null) return cycle;
    }
    visiting.delete(conceptId);
    visited.add(conceptId);
    return null;
  }

  for (const conceptId of adjacency.keys()) {
    const cycle = visit(conceptId);
    if (cycle !== null) return cycle;
  }
  return null;
}

/** Validate a complete graph before it can become a published version. */
export function validateCurriculumGraph(
  input: CurriculumGraphInput,
): Result<undefined, CurriculumFailure> {
  if (input.concepts.length === 0 || input.nodes.length === 0) {
    return err({
      code: "empty_graph",
      message: "A published curriculum graph requires at least one concept and objective.",
    });
  }
  const concepts = validateConcepts(input.concepts);
  if (!concepts.ok) return concepts;
  const nodes = validateNodes(input.concepts, input.nodes);
  if (!nodes.ok) return nodes;
  const edges = validateEdges(input.concepts, input.edges);
  if (!edges.ok) return edges;
  const cycle = isAcyclic(edges.value);
  if (cycle !== null) {
    return err({
      code: "cycle_detected",
      message: "A published curriculum graph must be acyclic.",
      conceptId: cycle,
    });
  }
  return ok(undefined);
}

/** Build a published graph. The input object is copied so callers cannot mutate it in place. */
export function publishCurriculumGraph(input: {
  readonly curriculumVersionId: CurriculumVersionId;
  readonly versionNumber: number;
  readonly graph: CurriculumGraphInput;
  readonly createdAt: Instant;
  readonly publishedAt: Instant;
}): Result<CurriculumGraphVersion, CurriculumFailure> {
  if (!Number.isSafeInteger(input.versionNumber) || input.versionNumber < 1) {
    return err({ code: "invalid_version", message: "Curriculum version numbers start at one." });
  }
  const valid = validateCurriculumGraph(input.graph);
  if (!valid.ok) return valid;
  return ok({
    curriculumVersionId: input.curriculumVersionId,
    versionNumber: input.versionNumber,
    status: "published",
    concepts: input.graph.concepts.map((concept) => ({ ...concept })),
    nodes: input.graph.nodes.map((node) => ({ ...node })),
    edges: input.graph.edges.map((edge) => ({ ...edge })),
    createdAt: input.createdAt,
    publishedAt: input.publishedAt,
  });
}

/** Published versions are immutable; edits must create a new version. */
export function isPublishedCurriculumGraphImmutable(): true {
  return true;
}
