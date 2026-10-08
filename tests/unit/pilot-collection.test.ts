import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { validatePilotCollection } from "@algocove/content/pilot-collection";
import {
  canonicalPilotBundle,
  pilotPublicView,
  validatePilotBundle,
} from "@algocove/content/pilot";
import { loadPublishedPilotCatalog } from "../../services/execution-host/src/pilot-problem.ts";
import { sha256Digest } from "@algocove/execution-contracts";
const raw = JSON.parse(readFileSync("content/collections/pilot-transfer.json", "utf8"));
it("keeps four unique independent outbound mappings with pending human review", () => {
  expect(validatePilotCollection(raw).entries).toHaveLength(4);
  const duplicate = structuredClone(raw);
  duplicate.entries[1] = duplicate.entries[0];
  expect(() => validatePilotCollection(duplicate)).toThrow();
  const forged = structuredClone(raw);
  forged.entries[0].reviewStatus = "approved";
  expect(() => validatePilotCollection(forged)).toThrow();
});
it("excludes private scaffolds, solutions and answers from published learner metadata", () => {
  for (const e of raw.entries) {
    const bundle = validatePilotBundle(
      JSON.parse(readFileSync(`content/patterns/${e.pattern}/bundle.json`, "utf8")),
    );
    const serialized = JSON.stringify(pilotPublicView(bundle));
    for (const key of [
      "hints",
      "languages",
      "solution",
      "pseudocode",
      "fixtures",
      "trace",
      "readinessQuestions",
      "correctOption",
      "expectedReasoning",
    ])
      expect(serialized).not.toContain(`"${key}"`);
    const poisoned = structuredClone(bundle);
    Object.assign(poisoned.lesson, { solution: "hidden" });
    expect(() => validatePilotBundle(poisoned)).toThrow();
  }
});
it("installs execution catalog only from checksum-bound registered publication exports", () => {
  const bundle = validatePilotBundle(
    JSON.parse(readFileSync("content/patterns/stack/bundle.json", "utf8")),
  );
  expect(() => loadPublishedPilotCatalog([{ bundle }])).toThrow();
  const receipt = {
    bundle,
    checksum: sha256Digest(canonicalPilotBundle(bundle)),
    publicationRecordId: "evt_1111111111111111",
  };
  const catalog = loadPublishedPilotCatalog([receipt]);
  expect(catalog.size).toBe(1);
  expect(catalog.get("prb_4444444444444444")?.fixtures).toHaveLength(8);
  expect(() =>
    loadPublishedPilotCatalog([{ ...receipt, checksum: `sha256:${"0".repeat(64)}` }]),
  ).toThrow();
  expect(() => loadPublishedPilotCatalog([receipt, receipt])).toThrow();
});
