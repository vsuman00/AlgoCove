declare const process: {
  stdin: {
    setEncoding(encoding: string): void;
    on(event: "data", callback: (chunk: string) => void): void;
    on(event: "end", callback: () => void): void;
  };
  stdout: { write(value: string): void };
};

function solve(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const target = BigInt(lines[0] ?? "0");
  const values = (lines[1] ?? "")
    .split(",")
    .filter(Boolean)
    .map((value) => BigInt(value));
  const label = lines[2] ?? "";
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      const total = (values[left] ?? 0n) + (values[right] ?? 0n);
      const matches = total === target;
      if (matches) return `${left},${right}|${label}`;
    }
  }
  return `none|${label}`;
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  process.stdout.write(`${solve(input)}\n`);
});
