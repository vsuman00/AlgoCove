import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const markdownRoots = ["ARCHITECTURE.md", "DESIGN.md", "docs", "tasks"];

async function filesUnder(relativePath) {
  const absolutePath = path.join(root, relativePath);
  const metadata = await readdir(absolutePath, { withFileTypes: true }).catch(() => null);
  if (metadata === null) {
    return [absolutePath];
  }

  const files = [];
  for (const entry of metadata) {
    const entryPath = path.join(absolutePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await filesUnder(path.relative(root, entryPath))));
    } else if (entry.name.endsWith(".md")) {
      files.push(entryPath);
    }
  }
  return files;
}

async function checkMarkdown(filePath) {
  const source = await readFile(filePath, "utf8");
  const errors = [];
  let fence = null;
  const lines = source.split("\n");

  for (const [index, line] of lines.entries()) {
    const marker = /^\s{0,3}(```|~~~)/.exec(line)?.[1];
    if (marker !== undefined) {
      fence = fence === null ? marker : fence === marker ? null : fence;
    }

    for (const match of line.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const destination = match[1]?.trim().replace(/^<|>$/g, "");
      if (
        destination === undefined ||
        destination.startsWith("#") ||
        destination.startsWith("http://") ||
        destination.startsWith("https://") ||
        destination.startsWith("mailto:")
      ) {
        continue;
      }
      const target = destination.split("#", 1)[0];
      if (target === "") {
        continue;
      }
      const targetPath = path.resolve(path.dirname(filePath), target);
      try {
        await access(targetPath);
      } catch {
        errors.push(`${path.relative(root, filePath)}:${index + 1} missing link target ${target}`);
      }
    }
  }

  if (fence !== null) {
    errors.push(`${path.relative(root, filePath)}: unmatched ${fence} code fence`);
  }
  return errors;
}

const files = (await Promise.all(markdownRoots.map(filesUnder))).flat();
const errors = (await Promise.all(files.map(checkMarkdown))).flat();
if (errors.length > 0) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Checked ${files.length} Markdown files for links and code fences.\n`);
}
