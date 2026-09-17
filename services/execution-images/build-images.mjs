import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.dirname(fileURLToPath(import.meta.url));
const document = JSON.parse(await readFile(path.join(root, "profiles.json"), "utf8"));

for (const profile of document.profiles) {
  const result = spawnSync(
    "docker",
    [
      "buildx",
      "build",
      "--load",
      "--provenance=true",
      "--sbom=true",
      `--label=org.opencontainers.image.version=${document.buildDate}`,
      `--label=org.opencontainers.image.revision=profiles-${document.schemaVersion}`,
      "--tag",
      profile.image,
      path.join(root, profile.directory),
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
