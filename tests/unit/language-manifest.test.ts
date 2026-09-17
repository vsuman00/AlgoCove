import { describe, expect, it } from "vitest";
import {
  completeProblemManifest,
  formatId,
  LANGUAGE_PROFILES,
  PROBLEM_LANGUAGES,
  type ProblemLanguageManifest,
} from "@algocove/domain";

const problemVersionId = formatId("problemVersion", "aaaaaaaaaaaaaaaa");
if (!problemVersionId.ok) throw new Error(problemVersionId.error.message);

const fixtures = [
  { fixtureId: "pair-sum-small", semanticKey: "pair_sum_small" },
  { fixtureId: "pair-sum-empty", semanticKey: "pair_sum_empty" },
] as const;

function manifests(): ProblemLanguageManifest[] {
  return LANGUAGE_PROFILES.map((profile) => ({
    language: profile.language,
    starterTemplate: `starter for ${profile.language}`,
    entrySignature: profile.entrySignature,
    adapterId: profile.adapterId,
    limitsProfile: { ...profile.limitsProfile },
    fixtureIds: fixtures.map((fixture) => fixture.fixtureId),
  }));
}

describe("six-language problem manifest", () => {
  it("declares exactly the six supported language IDs", () => {
    expect(PROBLEM_LANGUAGES).toEqual(["python", "javascript", "typescript", "java", "cpp", "c"]);
    expect(new Set(LANGUAGE_PROFILES.map((profile) => profile.language)).size).toBe(6);
  });

  it("requires every language to map to the same semantic fixtures", () => {
    const result = completeProblemManifest({
      problemVersionId: problemVersionId.value,
      fixtures,
      languages: manifests(),
    });
    expect(result.ok).toBe(true);
  });

  it("exposes missing language support instead of generalizing publication", () => {
    const result = completeProblemManifest({
      problemVersionId: problemVersionId.value,
      fixtures,
      languages: manifests().filter((manifest) => manifest.language !== "typescript"),
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "missing_language", language: "typescript" },
    });
  });

  it("keeps JavaScript and TypeScript, and C and C++, distinct adapters", () => {
    const javascript = LANGUAGE_PROFILES.find((profile) => profile.language === "javascript");
    const typescript = LANGUAGE_PROFILES.find((profile) => profile.language === "typescript");
    const c = LANGUAGE_PROFILES.find((profile) => profile.language === "c");
    const cpp = LANGUAGE_PROFILES.find((profile) => profile.language === "cpp");
    expect(javascript?.adapterId).not.toBe(typescript?.adapterId);
    expect(javascript?.entrySignature).not.toBe(typescript?.entrySignature);
    expect(c?.adapterId).not.toBe(cpp?.adapterId);
    expect(c?.runtimeFamily).not.toBe(cpp?.runtimeFamily);
  });

  it("rejects a manifest that silently changes a language limits profile", () => {
    const entries = manifests();
    const javascript = entries.find((entry) => entry.language === "javascript");
    if (javascript === undefined) throw new Error("javascript fixture missing");
    const javascriptIndex = entries.indexOf(javascript);
    entries[javascriptIndex] = {
      ...javascript,
      limitsProfile: { ...javascript.limitsProfile, runTimeoutMs: 1 },
    };
    expect(
      completeProblemManifest({
        problemVersionId: problemVersionId.value,
        fixtures,
        languages: entries,
      }),
    ).toMatchObject({ ok: false, error: { code: "invalid_profile", language: "javascript" } });
  });
});
