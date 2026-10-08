import { expect, it, vi } from "vitest";
import {
  catalogFilter,
  listPublishedProblems,
  resolvePublishedProblem,
  type PublishedLearningCatalog,
  type PublishedProblemSummary,
} from "@algocove/application";
import { parseId } from "@algocove/domain";
const parsed = parseId("problemVersion", "prb_1111111111111111");
if (!parsed.ok) throw Error("Invalid fixture");
const summary: PublishedProblemSummary = {
  problemId: "pro_1111111111111111",
  problemVersionId: parsed.value,
  contentVersionId: "cnt_1111111111111111",
  checksum: `sha256:${"1".repeat(64)}`,
  slug: "fixture-one",
  title: "Distinct fixture",
  pattern: "arrays-hashing",
  languages: ["python", "javascript", "typescript", "java", "cpp", "c"],
};
function repository(): PublishedLearningCatalog {
  return { listProblems: vi.fn(async () => []), resolveProblem: vi.fn(async () => summary) };
}
it("validates bounded catalog filters before invoking persistence", async () => {
  for (const input of [
    { limit: 0 },
    { limit: 51 },
    { limit: 1.5 },
    { limit: "20" },
    { after: "../" },
    { language: "ruby" },
    { search: "x".repeat(101) },
    { secret: "x" },
  ]) {
    const repo = repository();
    await expect(listPublishedProblems(repo, input)).rejects.toMatchObject({ status: 400 });
    expect(repo.listProblems).not.toHaveBeenCalled();
  }
  expect(catalogFilter({ search: "  stack  " })).toEqual({ limit: 20, search: "stack" });
});
it("uses a keyset continuation only when another matching result exists", async () => {
  const repo = repository();
  vi.mocked(repo.listProblems).mockResolvedValue([summary, { ...summary, slug: "fixture-two" }]);
  expect(await listPublishedProblems(repo, { limit: 1 })).toEqual({
    items: [summary],
    nextAfter: "fixture-one",
  });
  vi.mocked(repo.listProblems).mockResolvedValue([summary]);
  expect((await listPublishedProblems(repo, { limit: 1 })).nextAfter).toBeNull();
  vi.mocked(repo.listProblems).mockResolvedValue([]);
  expect(await listPublishedProblems(repo)).toEqual({ items: [], nextAfter: null });
});
it("projects resolved views without restricted adapter fields", async () => {
  const repo = repository();
  vi.mocked(repo.resolveProblem).mockResolvedValue({
    ...summary,
    solution: "private",
    authorId: "private",
  } as PublishedProblemSummary);
  expect(await resolvePublishedProblem(repo, "fixture-one")).toEqual(summary);
  vi.mocked(repo.resolveProblem).mockResolvedValue(null);
  await expect(resolvePublishedProblem(repo, "fixture-one")).rejects.toMatchObject({ status: 404 });
});

it("bounds curated collection filters and rejects private or invalid identities", async () => {
  const { collectionFilter, getPublishedCollection } = await import("@algocove/application");
  expect(collectionFilter({ search: "  Stack  " })).toEqual({
    search: "Stack",
    limit: 20,
    after: null,
  });
  for (const raw of [
    { limit: 51 },
    { after: "private-sheet" },
    { learnerId: "usr_1111111111111111" },
    { search: "x".repeat(101) },
  ])
    expect(() => collectionFilter(raw)).toThrow();
  const repo = {
    get: vi.fn(async () => ({ collection: null, items: [], truncated: false })),
    list: vi.fn(async () => ({ items: [], nextAfter: null })),
  };
  await expect(getPublishedCollection(repo, "../../private")).rejects.toMatchObject({
    status: 400,
  });
  expect(repo.get).not.toHaveBeenCalled();
  await expect(getPublishedCollection(repo, "col_1111111111111111")).rejects.toMatchObject({
    status: 404,
  });
});
