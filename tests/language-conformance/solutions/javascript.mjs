import { readFileSync } from "node:fs";

function solve(raw) {
  const lines = raw.split(/\r?\n/);
  const target = BigInt(lines[0]);
  const values = (lines[1] ?? "")
    .split(",")
    .filter(Boolean)
    .map((value) => BigInt(value));
  const label = lines[2] ?? "";
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      const total = values[left] + values[right];
      const matches = total === target;
      if (matches) return `${left},${right}|${label}`;
    }
  }
  return `none|${label}`;
}

process.stdout.write(`${solve(readFileSync(0, "utf8"))}\n`);
