import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirectories = new Set([".git", ".next", "node_modules", "coverage", "dist"]);
const ignoredFiles = new Set([".env.example", "pnpm-lock.yaml"]);
const suspiciousPatterns = [
  { label: "private key", pattern: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/ },
  { label: "GitHub token", pattern: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/ },
  { label: "OpenAI-style key", pattern: /\bsk-[A-Za-z0-9]{24,}\b/ },
  { label: "cloud access key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
];

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) {
      continue;
    }
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await sourceFiles(entryPath)));
    } else if (!ignoredFiles.has(entry.name)) {
      files.push(entryPath);
    }
  }
  return files;
}

const findings = [];
for (const filePath of await sourceFiles(root)) {
  const extension = path.extname(filePath).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".zip"].includes(extension)) {
    continue;
  }
  const source = await readFile(filePath, "utf8").catch(() => null);
  if (source === null) {
    continue;
  }
  for (const { label, pattern } of suspiciousPatterns) {
    if (pattern.test(source)) {
      findings.push(`${path.relative(root, filePath)} contains a possible ${label}`);
    }
  }
}

if (findings.length > 0) {
  process.stderr.write(`${findings.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("No committed secret-shaped material found.\n");
}
