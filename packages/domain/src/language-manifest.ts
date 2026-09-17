import { err, ok, type OpaqueId, type Result } from "./primitives.ts";

export type ProblemVersionId = OpaqueId<"problemVersion">;

export const PROBLEM_LANGUAGES = [
  "python",
  "javascript",
  "typescript",
  "java",
  "cpp",
  "c",
] as const;
export type ProblemLanguage = (typeof PROBLEM_LANGUAGES)[number];

export type LanguageProfile = {
  readonly language: ProblemLanguage;
  readonly displayName: string;
  readonly runtimeFamily: "python" | "javascript" | "jvm" | "native-cpp" | "native-c";
  readonly adapterId: `harness.${ProblemLanguage}`;
  readonly entrySignature: string;
  readonly limitsProfile: {
    readonly compileTimeoutMs: number;
    readonly runTimeoutMs: number;
    readonly memoryLimitMb: number;
  };
};

export const LANGUAGE_PROFILES: readonly LanguageProfile[] = [
  {
    language: "python",
    displayName: "Python",
    runtimeFamily: "python",
    adapterId: "harness.python",
    entrySignature: "solve(input)",
    limitsProfile: { compileTimeoutMs: 5_000, runTimeoutMs: 2_000, memoryLimitMb: 256 },
  },
  {
    language: "javascript",
    displayName: "JavaScript",
    runtimeFamily: "javascript",
    adapterId: "harness.javascript",
    entrySignature: "function solve(input)",
    limitsProfile: { compileTimeoutMs: 5_000, runTimeoutMs: 2_000, memoryLimitMb: 256 },
  },
  {
    language: "typescript",
    displayName: "TypeScript",
    runtimeFamily: "javascript",
    adapterId: "harness.typescript",
    entrySignature: "function solve(input): Output",
    limitsProfile: { compileTimeoutMs: 8_000, runTimeoutMs: 2_000, memoryLimitMb: 256 },
  },
  {
    language: "java",
    displayName: "Java",
    runtimeFamily: "jvm",
    adapterId: "harness.java",
    entrySignature: "static Output solve(Input input)",
    limitsProfile: { compileTimeoutMs: 10_000, runTimeoutMs: 3_000, memoryLimitMb: 384 },
  },
  {
    language: "cpp",
    displayName: "C++",
    runtimeFamily: "native-cpp",
    adapterId: "harness.cpp",
    entrySignature: "Output solve(Input input)",
    limitsProfile: { compileTimeoutMs: 8_000, runTimeoutMs: 2_000, memoryLimitMb: 256 },
  },
  {
    language: "c",
    displayName: "C",
    runtimeFamily: "native-c",
    adapterId: "harness.c",
    entrySignature: "Output solve(Input input)",
    limitsProfile: { compileTimeoutMs: 8_000, runTimeoutMs: 2_000, memoryLimitMb: 256 },
  },
] as const;

export type SemanticFixture = {
  readonly fixtureId: string;
  readonly semanticKey: string;
};

export type ProblemLanguageManifest = {
  readonly language: ProblemLanguage;
  readonly starterTemplate: string;
  readonly entrySignature: string;
  readonly adapterId: `harness.${ProblemLanguage}`;
  readonly limitsProfile: LanguageProfile["limitsProfile"];
  readonly fixtureIds: readonly string[];
};

export type ProblemManifest = {
  readonly problemVersionId: ProblemVersionId;
  readonly fixtures: readonly SemanticFixture[];
  readonly languages: readonly ProblemLanguageManifest[];
};

export type ManifestFailureCode =
  | "missing_language"
  | "duplicate_language"
  | "unknown_language"
  | "missing_fixture"
  | "fixture_mismatch"
  | "invalid_profile";

export type ManifestFailure = {
  readonly code: ManifestFailureCode;
  readonly message: string;
  readonly language?: string;
};

const LANGUAGE_SET = new Set<string>(PROBLEM_LANGUAGES);

/** Runtime profiles are explicit data so JavaScript/TypeScript and C/C++ cannot collapse. */
export function languageProfile(language: ProblemLanguage): LanguageProfile {
  const profile = LANGUAGE_PROFILES.find((candidate) => candidate.language === language);
  if (profile === undefined) throw new Error(`Missing language profile for ${language}.`);
  return profile;
}

export function validateProblemManifest(
  manifest: ProblemManifest,
): Result<undefined, ManifestFailure> {
  const fixtureIds = new Set(manifest.fixtures.map((fixture) => fixture.fixtureId));
  if (manifest.fixtures.length === 0 || fixtureIds.size !== manifest.fixtures.length) {
    return err({
      code: "missing_fixture",
      message: "A problem manifest requires unique semantic fixtures.",
    });
  }
  const seen = new Set<ProblemLanguage>();
  for (const languageManifest of manifest.languages) {
    if (!LANGUAGE_SET.has(languageManifest.language)) {
      return err({
        code: "unknown_language",
        message: "Manifest language is not supported.",
        language: languageManifest.language,
      });
    }
    if (seen.has(languageManifest.language)) {
      return err({
        code: "duplicate_language",
        message: "A problem manifest can contain one entry per language.",
        language: languageManifest.language,
      });
    }
    seen.add(languageManifest.language);
    const profile = languageProfile(languageManifest.language);
    if (
      languageManifest.adapterId !== profile.adapterId ||
      languageManifest.entrySignature !== profile.entrySignature ||
      languageManifest.limitsProfile.compileTimeoutMs !== profile.limitsProfile.compileTimeoutMs ||
      languageManifest.limitsProfile.runTimeoutMs !== profile.limitsProfile.runTimeoutMs ||
      languageManifest.limitsProfile.memoryLimitMb !== profile.limitsProfile.memoryLimitMb
    ) {
      return err({
        code: "invalid_profile",
        message: "Manifest profile does not match the language contract.",
        language: languageManifest.language,
      });
    }
    if (
      languageManifest.fixtureIds.length !== fixtureIds.size ||
      languageManifest.fixtureIds.some((id) => !fixtureIds.has(id))
    ) {
      return err({
        code: "fixture_mismatch",
        message: "Every language must map to the same semantic fixture IDs.",
        language: languageManifest.language,
      });
    }
  }
  for (const language of PROBLEM_LANGUAGES) {
    if (!seen.has(language)) {
      return err({
        code: "missing_language",
        message: "General publication requires all six language manifests.",
        language,
      });
    }
  }
  return ok(undefined);
}

export function completeProblemManifest(input: {
  readonly problemVersionId: ProblemVersionId;
  readonly fixtures: readonly SemanticFixture[];
  readonly languages: readonly ProblemLanguageManifest[];
}): Result<ProblemManifest, ManifestFailure> {
  const manifest: ProblemManifest = {
    problemVersionId: input.problemVersionId,
    fixtures: input.fixtures.map((fixture) => ({ ...fixture })),
    languages: input.languages.map((language) => ({
      ...language,
      limitsProfile: { ...language.limitsProfile },
      fixtureIds: [...language.fixtureIds],
    })),
  };
  const valid = validateProblemManifest(manifest);
  return valid.ok ? ok(manifest) : valid;
}
