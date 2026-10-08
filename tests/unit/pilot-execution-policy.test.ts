import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { PILOT_CATALOG, pilotIdentity, PROBLEM_LANGUAGES } from "@algocove/domain";
import { generateSigningKeyPair, sha256Digest } from "@algocove/execution-contracts";
import { validatePilotBundle, canonicalPilotBundle } from "@algocove/content/pilot";
import { loadPublishedPilotCatalog } from "../../services/execution-host/src/pilot-problem.ts";
import { createContainerDescriptorPolicy } from "../../services/execution-host/src/container-problem.ts";
import { pilotHarness } from "@algocove/content/pilot-harness";
import {
  createGvisorRunner,
  type DockerCommand,
} from "../../services/execution-host/src/docker-runner.ts";
import type { WebsiteExecutionRun } from "@algocove/execution-control";
const bundles = PILOT_CATALOG.map((p) =>
  validatePilotBundle(
    JSON.parse(readFileSync(`content/patterns/${p.pattern}/bundle.json`, "utf8")),
  ),
);
const catalog = loadPublishedPilotCatalog(
  bundles.map((bundle) => ({
    bundle,
    checksum: sha256Digest(canonicalPilotBundle(bundle)),
    publicationRecordId: "evt_1111111111111111",
  })),
);
const key = generateSigningKeyPair("pilot-fixture");
const images = Object.fromEntries(
  PROBLEM_LANGUAGES.map((l) => [l, `sha256:${"f".repeat(64)}`]),
) as Record<(typeof PROBLEM_LANGUAGES)[number], string>;
it.each(bundles)(
  "$pattern: binds six manifests and refuses uninstalled or mismatched execution",
  async (b) => {
    const id = pilotIdentity(b.slug)!;
    for (const [i, language] of PROBLEM_LANGUAGES.entries()) {
      const source = b.languages[language].solution;
      const run = {
        runId: "run_1111111111111111",
        attemptId: "att_1111111111111111",
        learnerId: "usr_1111111111111111",
        problemVersionId: id.problemVersionId,
        manifestId: id.manifestId(i),
        language,
        mode: "run",
        sourceChecksum: sha256Digest(source),
        sourceLength: source.length,
        requestedAt: new Date().toISOString(),
      } as unknown as WebsiteExecutionRun;
      expect(() =>
        createContainerDescriptorPolicy(key, images, () => new Date().toISOString())(
          run,
          "evt_1111111111111111",
        ),
      ).toThrow();
      const policy = createContainerDescriptorPolicy(
        key,
        images,
        () => new Date().toISOString(),
        catalog,
      );
      const descriptor = policy(run, "evt_1111111111111111").descriptor.payload;
      expect(descriptor.manifestDigest).toBe(
        catalog.get(id.problemVersionId)!.manifestDigest(language),
      );
      expect(descriptor.fixtureDigest).toBe(catalog.get(id.problemVersionId)!.fixtureDigest);
      expect(() =>
        policy(
          { ...run, manifestId: "man_9999999999999999" as WebsiteExecutionRun["manifestId"] },
          "evt_1111111111111111",
        ),
      ).toThrow();
      const command = vi.fn(async () => ({ code: 0, stdout: "", stderr: "" }));
      expect(
        await createGvisorRunner(images, command, catalog)(
          { ...descriptor, fixtureDigest: sha256Digest("corrupt fixtures") },
          source,
          new AbortController().signal,
        ),
      ).toMatchObject({ category: "infrastructure_error" });
      expect(command).not.toHaveBeenCalled();
      let fixtureIndex = 0;
      const harness = pilotHarness(language, source);
      const acceptedCommand: DockerCommand = async (args, options) => {
        if (
          args[0] === "exec" &&
          args[1] === "-i" &&
          args.slice(3).join(" ") === harness.run.join(" ")
        ) {
          const fixture = catalog.get(id.problemVersionId)!.fixtures[fixtureIndex++]!;
          expect(options?.input).toBe(`${fixture.values.length}\n${fixture.values.join(" ")}\n`);
          return { code: 0, stdout: String(fixture.expected), stderr: "" };
        }
        return { code: 0, stdout: "", stderr: "" };
      };
      expect(
        await createGvisorRunner(images, acceptedCommand, catalog)(
          descriptor,
          source,
          new AbortController().signal,
        ),
      ).toMatchObject({ category: "pass", teardownConfirmed: true });
      expect(fixtureIndex).toBe(b.fixtures.length);
    }
  },
);
