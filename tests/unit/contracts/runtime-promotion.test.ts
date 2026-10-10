import { mkdtempSync, readFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { promoteRuntimeRelease } from "../../../ops/release/runtime-promotion.ts";
import {
  assembleRuntimeManifest,
  canonicalRuntimeManifest,
  RUNTIME_PROFILES,
  runtimeManifestDigest,
} from "../../../ops/release/runtime-manifest.ts";
const directories: string[] = [];
const state = () => {
  const path = mkdtempSync(join(tmpdir(), "algocove-runtime-"));
  directories.push(path);
  return path;
};
const candidate = (sha = "a", image = "1") =>
  canonicalRuntimeManifest(
    assembleRuntimeManifest(
      RUNTIME_PROFILES.map((profileId) => ({
        schemaVersion: 1,
        profileId,
        sourceSha: sha.repeat(40),
        sourceRunId: 123,
        sourceWorkflowRef:
          "vsuman00/AlgoCove/.github/workflows/execution-release.yml@refs/heads/main",
        imageDigest: "sha256:" + image.repeat(64),
      })),
    ),
  );
const input = (
  stateDirectory: string,
  body = candidate(),
  expectedCurrent: string | null = null,
) => ({
  stateDirectory,
  candidate: body,
  bundle: "synthetic-test-bundle",
  expectedCurrent,
  action: "promote" as const,
});
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
describe("verified runtime promotion and rollback", () => {
  it("retains manifests and six-language mappings with atomic audited pointers", () => {
    const directory = state();
    const verify = vi.fn();
    const first = promoteRuntimeRelease(input(directory), verify);
    const second = promoteRuntimeRelease(
      input(directory, candidate("b", "2"), first.manifestDigest),
      verify,
    );
    const rollback = promoteRuntimeRelease(
      { ...input(directory, candidate(), second.manifestDigest), action: "rollback" },
      verify,
    );
    expect(rollback.manifestDigest).toBe(first.manifestDigest);
    expect(rollback.previousDigest).toBe(second.manifestDigest);
    expect(rollback.executionEnabled).toBe(false);
    expect(JSON.parse(readFileSync(join(directory, "current.json"), "utf8"))).toEqual(rollback);
    expect(readdirSync(join(directory, "decisions"))).toHaveLength(3);
    const images = JSON.parse(
      readFileSync(join(directory, "sets", first.manifestDigest.slice(7), "images.json"), "utf8"),
    );
    expect(images.c).toBe(images.cpp);
    expect(verify).toHaveBeenCalledTimes(3);
  });
  it("leaves the pointer and audit unchanged after CI/signature rejection", () => {
    const directory = state();
    const first = promoteRuntimeRelease(input(directory), () => {});
    const before = readFileSync(join(directory, "current.json"), "utf8");
    expect(() =>
      promoteRuntimeRelease(input(directory, candidate("b", "2"), first.manifestDigest), () => {
        throw Error("invalid signature");
      }),
    ).toThrow();
    expect(readFileSync(join(directory, "current.json"), "utf8")).toBe(before);
    expect(readdirSync(join(directory, "decisions"))).toHaveLength(1);
    expect(existsSync(join(directory, "promotion.lock"))).toBe(false);
  });
  it("rejects stale expectations and rollback to an unrelated set before verification", () => {
    const directory = state();
    const first = promoteRuntimeRelease(input(directory), () => {});
    const verify = vi.fn();
    expect(() => promoteRuntimeRelease(input(directory, candidate("b", "2")), verify)).toThrow();
    expect(() =>
      promoteRuntimeRelease(
        { ...input(directory, candidate("b", "2"), first.manifestDigest), action: "rollback" },
        verify,
      ),
    ).toThrow();
    expect(verify).not.toHaveBeenCalled();
  });
  it("rejects signature byte changes and incomplete sets without creating current state", () => {
    const directory = state();
    const verify = vi.fn();
    expect(() => promoteRuntimeRelease(input(directory, candidate().trim()), verify)).toThrow();
    const manifest = JSON.parse(candidate());
    delete manifest.profiles.java;
    expect(() =>
      promoteRuntimeRelease(input(directory, JSON.stringify(manifest)), verify),
    ).toThrow();
    expect(existsSync(join(directory, "current.json"))).toBe(false);
    expect(verify).not.toHaveBeenCalled();
  });
  it("rejects tampered retained images instead of accepting a rollback", () => {
    const directory = state();
    const first = promoteRuntimeRelease(input(directory), () => {});
    const second = promoteRuntimeRelease(
      input(directory, candidate("b", "2"), first.manifestDigest),
      () => {},
    );
    rmSync(join(directory, "sets", first.manifestDigest.slice(7), "images.json"));
    expect(() =>
      promoteRuntimeRelease(
        { ...input(directory, candidate(), second.manifestDigest), action: "rollback" },
        () => {},
      ),
    ).toThrow();
    expect(JSON.parse(readFileSync(join(directory, "current.json"), "utf8")).manifestDigest).toBe(
      second.manifestDigest,
    );
    expect(runtimeManifestDigest(JSON.parse(candidate()))).toBe(first.manifestDigest);
  });
});
