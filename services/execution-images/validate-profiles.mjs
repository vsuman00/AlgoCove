import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const document = JSON.parse(await readFile(path.join(root, "profiles.json"), "utf8"));
const expectedLanguages = new Set(["python", "javascript", "typescript", "java", "cpp", "c"]);
const seenLanguages = new Set();

if (document.schemaVersion !== 1 || !Array.isArray(document.profiles)) {
  throw new Error("Execution image profile document must use schema version 1.");
}
for (const profile of document.profiles) {
  if (!/^[a-z-]+$/.test(profile.id) || !/^.+@sha256:[0-9a-f]{64}$/.test(profile.baseImage)) {
    throw new Error(`Profile ${profile.id} must pin a base image digest.`);
  }
  if (profile.network !== "none" || profile.user !== "65532:65532") {
    throw new Error(`Profile ${profile.id} violates the fixed runtime boundary.`);
  }
  if (profile.learnerFlagsAllowed !== false || profile.packageInstallAllowed !== false) {
    throw new Error(
      `Profile ${profile.id} permits learner-controlled or runtime installation behavior.`,
    );
  }
  if (!Array.isArray(profile.languages) || profile.languages.length === 0) {
    throw new Error(`Profile ${profile.id} must declare at least one language.`);
  }
  for (const language of profile.languages) {
    if (!expectedLanguages.has(language) || seenLanguages.has(language)) {
      throw new Error(`Language ${language} is missing, duplicated, or unsupported.`);
    }
    seenLanguages.add(language);
    const commands = profile.commands?.[language];
    if (
      !commands ||
      Object.values(commands).some((argv) => !Array.isArray(argv) || argv.length === 0)
    ) {
      throw new Error(`Profile ${profile.id} has invalid fixed commands for ${language}.`);
    }
    for (const argv of Object.values(commands)) {
      if (
        argv.some((part) => typeof part !== "string" || part.includes("$") || part.includes(";"))
      ) {
        throw new Error(`Profile ${profile.id} contains an unsafe command argument.`);
      }
    }
  }
}
if (seenLanguages.size !== expectedLanguages.size) {
  throw new Error("Execution image profiles must cover all six supported languages.");
}
console.log(
  `Validated ${document.profiles.length} pinned execution image profiles for ${seenLanguages.size} languages.`,
);
