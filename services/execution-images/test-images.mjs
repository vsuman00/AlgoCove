import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.dirname(fileURLToPath(import.meta.url));
const document = JSON.parse(await readFile(path.join(root, "profiles.json"), "utf8"));
const limits = [
  "--network=none",
  "--read-only",
  "--tmpfs=/work:rw,exec,nosuid,nodev,size=16m,uid=65532,gid=65532,mode=700",
  "--tmpfs=/tmp:rw,nosuid,nodev,size=32m,uid=65532,gid=65532,mode=700",
  "--cap-drop=ALL",
  "--security-opt=no-new-privileges:true",
  "--pids-limit=32",
  "--memory=384m",
  "--memory-swap=384m",
  "--cpus=0.5",
  "--ulimit=nofile=64:64",
  "--ulimit=fsize=1048576:1048576",
  "--user=65532:65532",
  "--env=HOME=/work",
];
const fixtures = {
  python: {
    file: "fixture.py",
    normal: 'print("NORMAL_OK")\n',
    failure: "raise SystemExit(3)\n",
    command: "cat > /work/fixture.py && python /work/fixture.py",
  },
  javascript: {
    file: "fixture.mjs",
    normal: 'console.log("NORMAL_OK");\n',
    failure: "process.exit(3);\n",
    command: "cat > /work/fixture.mjs && node /work/fixture.mjs",
  },
  typescript: {
    file: "fixture.ts",
    normal: 'const message: string = "NORMAL_OK"; console.log(message);\n',
    failure: 'const broken: number = "type failure"; console.log(broken);\n',
    command:
      "cat > /work/fixture.ts && tsc --project /opt/algocove/tsconfig.typecheck.json && tsc --project /opt/algocove/tsconfig.transpile.json && node /tmp/algocove-output/fixture.js",
  },
  java: {
    file: "Main.java",
    normal:
      'public class Main { public static void main(String[] args) { System.out.println("NORMAL_OK"); } }\n',
    failure: "public class Main {\n",
    command:
      "cat > /work/Main.java && mkdir -p /tmp/algocove-output && javac -d /tmp/algocove-output /work/Main.java && java -cp /tmp/algocove-output Main",
  },
  cpp: {
    file: "main.cpp",
    normal: '#include <iostream>\nint main() { std::cout << "NORMAL_OK\\n"; }\n',
    failure: "int main( { return 0; }\n",
    command:
      "cat > /work/main.cpp && mkdir -p /work/algocove-output && g++ -std=c++23 -O2 /work/main.cpp -o /work/algocove-output/main && /work/algocove-output/main",
  },
  c: {
    file: "main.c",
    normal: '#include <stdio.h>\nint main(void) { puts("NORMAL_OK"); }\n',
    failure: "int main( { return 0; }\n",
    command:
      "cat > /work/main.c && mkdir -p /work/algocove-output && gcc -std=c23 -O2 /work/main.c -o /work/algocove-output/main && /work/algocove-output/main",
  },
};

function run(image, fixture, source) {
  return spawnSync("docker", ["run", "--rm", "-i", ...limits, image, "sh", "-c", fixture.command], {
    input: source,
    encoding: "utf8",
    timeout: 20_000,
    maxBuffer: 16_384,
  });
}

for (const profile of document.profiles) {
  const inspect = spawnSync("docker", ["image", "inspect", profile.image], { encoding: "utf8" });
  if (inspect.status !== 0) throw new Error(`Image ${profile.image} is not built locally.`);
  for (const language of profile.languages) {
    const fixture = fixtures[language];
    const normal = run(profile.image, fixture, fixture.normal);
    if (normal.status !== 0 || !normal.stdout.includes("NORMAL_OK")) {
      throw new Error(`${language} normal smoke fixture failed.`);
    }
    const failure = run(profile.image, fixture, fixture.failure);
    if (failure.status === 0) throw new Error(`${language} failure fixture unexpectedly passed.`);
  }
}
console.log("All six execution-image normal and failure smoke fixtures passed.");
