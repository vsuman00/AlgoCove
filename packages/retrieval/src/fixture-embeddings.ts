import { createHash } from "node:crypto";
import type { EmbeddingPort } from "./index-content.ts";
/** Deterministic local pipeline fixture. No semantic quality or provider readiness claim. */
export const fixtureEmbeddingPort: EmbeddingPort = {
  configuration: Object.freeze({
    policyVersion: "embedding.fixture.v1",
    provider: "fixture",
    model: "sha256-fixture.v1",
    dimensions: 8,
    normalization: "unit",
  }),
  async embed(texts, signal) {
    if (signal.aborted) throw Error("Embedding cancelled.");
    return texts.map((text) => {
      const b = createHash("sha256").update(text).digest();
      const v = Array.from({ length: 8 }, (_, i) => b[i]! - 127.5);
      const norm = Math.hypot(...v);
      return v.map((x) => x / norm);
    });
  },
};
