import { it, expect } from "vitest";
import {
  embeddingConfigurationId,
  validateEmbeddings,
  fixtureEmbeddingPort,
} from "@algocove/retrieval";
it("versioned fixture embeddings are deterministic normalized and explicitly fixtures", async () => {
  const c = fixtureEmbeddingPort.configuration;
  const vectors = await fixtureEmbeddingPort.embed(
    ["pointer invariant"],
    new AbortController().signal,
  );
  expect(() => validateEmbeddings(vectors, 1, c)).not.toThrow();
  expect(
    await fixtureEmbeddingPort.embed(["pointer invariant"], new AbortController().signal),
  ).toEqual(vectors);
  expect(embeddingConfigurationId({ ...c, model: "v2" })).not.toBe(embeddingConfigurationId(c));
  expect(c.provider).toBe("fixture");
});
it.each(
  [[], [[0, 0, 0, 0, 0, 0, 0, 0]], [[NaN]], [[Infinity]], [[1]], [[1, 1, 1, 1, 1, 1, 1, 1]]].map(
    (v) => ({ v }),
  ),
)("rejects incomplete nonfinite wrong-dimension and unnormalized vectors %j", ({ v }) => {
  expect(() => validateEmbeddings(v, 1, fixtureEmbeddingPort.configuration)).toThrow();
});
