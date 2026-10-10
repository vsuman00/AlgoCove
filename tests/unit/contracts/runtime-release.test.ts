import { describe, expect, it } from "vitest";
import {
  RUNTIME_PROFILES,
  assembleRuntimeManifest,
  canonicalRuntimeManifest,
  runtimeManifestDigest,
  runtimeImageMapping,
} from "../../../ops/release/runtime-manifest.ts";
const receipts = () =>
  RUNTIME_PROFILES.map((profileId, i) => ({
    schemaVersion: 1,
    profileId,
    sourceSha: "a".repeat(40),
    sourceRunId: 123,
    sourceWorkflowRef: "vsuman00/AlgoCove/.github/workflows/execution-release.yml@refs/heads/main",
    imageDigest: "sha256:" + String(i + 1).repeat(64),
  }));
describe("independent immutable runtime release", () => {
  it("pins six languages to a complete four-profile set with source lineage", () => {
    const manifest = assembleRuntimeManifest(receipts());
    const images = runtimeImageMapping(manifest);
    expect(Object.keys(images).sort()).toEqual([
      "c",
      "cpp",
      "java",
      "javascript",
      "python",
      "typescript",
    ]);
    expect(images.javascript).toBe(images.typescript);
    expect(images.c).toBe(images.cpp);
    expect(images.java).toMatch(
      /^ghcr\.io\/vsuman00\/algocove\/execution-java@sha256:[a-f0-9]{64}$/,
    );
  });
  it("has the same canonical identity regardless of receipt arrival order", () => {
    const a = assembleRuntimeManifest(receipts());
    const b = assembleRuntimeManifest(receipts().reverse());
    expect(canonicalRuntimeManifest(a)).toBe(canonicalRuntimeManifest(b));
    expect(runtimeManifestDigest(a)).toBe(runtimeManifestDigest(b));
    expect(runtimeManifestDigest({ ...a, sourceSha: "b".repeat(40) })).not.toBe(
      runtimeManifestDigest(a),
    );
  });
  it("rejects missing and duplicated profiles", () => {
    expect(() => assembleRuntimeManifest(receipts().slice(1))).toThrow();
    const rows = receipts();
    rows[1] = rows[0]!;
    expect(() => assembleRuntimeManifest(rows)).toThrow();
  });
  it.each(["sourceSha", "sourceRunId", "sourceWorkflowRef"] as const)(
    "rejects mixed %s lineage",
    (key) => {
      const rows = receipts();
      const changed = {
        ...rows[1],
        [key]:
          key === "sourceSha"
            ? "b".repeat(40)
            : key === "sourceRunId"
              ? 124
              : "vsuman00/AlgoCove/.github/workflows/execution-release.yml@refs/heads/another",
      };
      expect(() => assembleRuntimeManifest([rows[0], changed, ...rows.slice(2)])).toThrow();
    },
  );
  it.each(["latest", "sha256:" + "x".repeat(64), "sha256:" + "a".repeat(63)])(
    "rejects mutable or malformed image identity %s",
    (imageDigest) => {
      expect(() =>
        assembleRuntimeManifest(receipts().map((row) => ({ ...row, imageDigest }))),
      ).toThrow();
    },
  );
  it("rejects foreign workflows, unknown fields and enabling switches", () => {
    expect(() =>
      assembleRuntimeManifest(
        receipts().map((row) => ({
          ...row,
          sourceWorkflowRef: "other/Repo/.github/workflows/execution-release.yml@refs/heads/main",
        })),
      ),
    ).toThrow();
    expect(() =>
      assembleRuntimeManifest(receipts().map((row) => ({ ...row, verified: true }))),
    ).toThrow();
    const manifest = assembleRuntimeManifest(receipts());
    expect(() => runtimeImageMapping({ ...manifest, executionEnabled: true })).toThrow();
  });
});
