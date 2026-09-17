import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const profiles = JSON.parse(
  readFileSync(path.join(root, "services/execution-images/profiles.json"), "utf8"),
) as {
  schemaVersion: number;
  profiles: Array<{
    id: string;
    languages: string[];
    baseImage: string;
    commands: Record<string, Record<string, string[]>>;
    network: string;
    user: string;
    learnerFlagsAllowed: boolean;
    packageInstallAllowed: boolean;
  }>;
};

describe("execution image profiles", () => {
  it("covers six languages with immutable base digests and fixed non-root policy", () => {
    expect(profiles.schemaVersion).toBe(1);
    expect(profiles.profiles).toHaveLength(4);
    const languages = profiles.profiles.flatMap((profile) => profile.languages);
    expect(languages.sort()).toEqual(["c", "cpp", "java", "javascript", "python", "typescript"]);
    for (const profile of profiles.profiles) {
      expect(profile.baseImage).toMatch(/^.+@sha256:[0-9a-f]{64}$/);
      expect(profile.network).toBe("none");
      expect(profile.user).toBe("65532:65532");
      expect(profile.learnerFlagsAllowed).toBe(false);
      expect(profile.packageInstallAllowed).toBe(false);
    }
  });

  it("keeps TypeScript type-check and transpile as separate fixed commands", () => {
    const profile = profiles.profiles.find((entry) => entry.id === "javascript-typescript");
    expect(profile?.commands.typescript).toEqual({
      typecheck: ["tsc", "--project", "/opt/algocove/tsconfig.typecheck.json"],
      transpile: ["tsc", "--project", "/opt/algocove/tsconfig.transpile.json"],
      run: ["node", "/tmp/algocove-output/fixture.js"],
    });
  });
});
