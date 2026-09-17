import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await sourceFiles(entryPath)));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(entryPath);
    }
  }
  return files;
}

async function sourceText(directory: string): Promise<string> {
  const files = await sourceFiles(directory);
  return (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
}

describe("package import boundaries", () => {
  it("keeps the domain dependency-free", async () => {
    const source = await sourceText(path.join(root, "packages/domain/src"));
    expect(source).not.toMatch(
      /from\s+["'](?:node:|next(?:\/|["'])|react(?:\/|["'])|pg["']|zod["'])/,
    );
  });

  it("keeps application code behind domain-owned ports", async () => {
    const source = await sourceText(path.join(root, "packages/application/src"));
    expect(source).not.toMatch(/from\s+["']@algocove\/(?:config|db)["']/);
    expect(source).not.toMatch(/from\s+["']next(?:\/|["'])/);
  });

  it("detects the deliberately invalid dependency fixture", async () => {
    const fixture = await readFile(
      path.join(root, "tests/architecture/fixtures/invalid-domain-import.ts"),
      "utf8",
    );
    expect(fixture).toMatch(/from\s+["']react["']/);
  });
});
