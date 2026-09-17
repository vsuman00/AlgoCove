import { mkdir, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const reportPath = path.join(root, "reports", "task-19-2026-09-17.md");
const requestedRuntime = process.env.ALGO_COVE_DOCKER_RUNTIME?.trim() || null;
const runtimeArgs = requestedRuntime ? [`--runtime=${requestedRuntime}`] : [];
const images = {
  python: "python:3.14-alpine",
  javascript: "node:26-alpine",
  typescript: "node:26-alpine",
  java: "eclipse-temurin:25-jdk",
  cpp: "gcc:15-bookworm",
  c: "gcc:15-bookworm",
};
const languages = ["python", "javascript", "typescript", "java", "cpp", "c"];
const filenames = {
  python: "fixture.py",
  javascript: "fixture.mjs",
  typescript: "fixture.ts",
  java: "Main.java",
  cpp: "main.cpp",
  c: "main.c",
};
const commands = {
  python: "python /work/fixture.py",
  javascript: "node /work/fixture.mjs",
  typescript: "node --experimental-strip-types /work/fixture.ts",
  java: "javac /work/Main.java && java -cp /work Main",
  cpp: "g++ -std=c++23 -O2 /work/main.cpp -o /work/main && /work/main",
  c: "gcc -std=c23 -O2 /work/main.c -o /work/main && /work/main",
};
const normal = {
  python: 'print("NORMAL_OK")\n',
  javascript: 'console.log("NORMAL_OK");\n',
  typescript: 'const message: string = "NORMAL_OK";\nconsole.log(message);\n',
  java: 'public class Main { public static void main(String[] args) { System.out.println("NORMAL_OK"); } }\n',
  cpp: '#include <iostream>\nint main() { std::cout << "NORMAL_OK\\n"; }\n',
  c: '#include <stdio.h>\nint main(void) { puts("NORMAL_OK"); }\n',
};
const hostile = {
  python: `import os
import urllib.request

def blocked(url):
    try:
        urllib.request.urlopen(url, timeout=0.5)
    except Exception:
        return True
    return False

checks = {
    "NETWORK_BLOCKED": blocked("http://1.1.1.1"),
    "METADATA_BLOCKED": blocked("http://169.254.169.254/latest/meta-data"),
    "DOCKER_SOCKET_ABSENT": not os.path.exists("/var/run/docker.sock"),
    "HOST_MOUNT_ABSENT": not any(os.path.exists(p) for p in ("/host", "/mnt/host", "/Users", "/Volumes")),
    "CREDENTIAL_ENV_ABSENT": not any("TOKEN" in key or "SECRET" in key or "PASSWORD" in key for key in os.environ),
}
print(",".join(key for key, passed in checks.items() if passed))
raise SystemExit(0 if all(checks.values()) else 1)
`,
  javascript: `import fs from "node:fs";
const blocked = async (url) => {
  try { await fetch(url, { signal: AbortSignal.timeout(500) }); return false; }
  catch { return true; }
};
const checks = {
  NETWORK_BLOCKED: await blocked("http://1.1.1.1"),
  METADATA_BLOCKED: await blocked("http://169.254.169.254/latest/meta-data"),
  DOCKER_SOCKET_ABSENT: !fs.existsSync("/var/run/docker.sock"),
  HOST_MOUNT_ABSENT: !["/host", "/mnt/host", "/Users", "/Volumes"].some((p) => fs.existsSync(p)),
  CREDENTIAL_ENV_ABSENT: !Object.keys(process.env).some((key) => /TOKEN|SECRET|PASSWORD/.test(key)),
};
console.log(Object.entries(checks).filter(([, passed]) => passed).map(([key]) => key).join(","));
process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
`,
  typescript: `import fs from "node:fs";
const blocked = async (url: string): Promise<boolean> => {
  try { await fetch(url, { signal: AbortSignal.timeout(500) }); return false; }
  catch { return true; }
};
const checks: Record<string, boolean> = {
  NETWORK_BLOCKED: await blocked("http://1.1.1.1"),
  METADATA_BLOCKED: await blocked("http://169.254.169.254/latest/meta-data"),
  DOCKER_SOCKET_ABSENT: !fs.existsSync("/var/run/docker.sock"),
  HOST_MOUNT_ABSENT: !["/host", "/mnt/host", "/Users", "/Volumes"].some((p) => fs.existsSync(p)),
  CREDENTIAL_ENV_ABSENT: !Object.keys(process.env).some((key) => /TOKEN|SECRET|PASSWORD/.test(key)),
};
console.log(Object.entries(checks).filter(([, passed]) => passed).map(([key]) => key).join(","));
process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
`,
  java: `import java.io.File;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.Map;
public class Main {
  static boolean blocked(String host) {
    try (Socket socket = new Socket()) { socket.connect(new InetSocketAddress(host, 80), 500); return false; }
    catch (Exception error) { return true; }
  }
  public static void main(String[] args) {
    boolean networkBlocked = blocked("1.1.1.1");
    boolean metadataBlocked = blocked("169.254.169.254");
    boolean dockerSocketAbsent = !new File("/var/run/docker.sock").exists();
    boolean hostMountAbsent = !new File("/host").exists() && !new File("/mnt/host").exists()
      && !new File("/Users").exists() && !new File("/Volumes").exists();
    boolean credentialEnvAbsent = Map.of("TOKEN", "", "SECRET", "", "PASSWORD", "").keySet().stream()
      .noneMatch(key -> System.getenv().keySet().stream().anyMatch(value -> value.contains(key)));
    System.out.println("NETWORK_BLOCKED=" + networkBlocked + ",METADATA_BLOCKED=" + metadataBlocked
      + ",DOCKER_SOCKET_ABSENT=" + dockerSocketAbsent + ",HOST_MOUNT_ABSENT=" + hostMountAbsent
      + ",CREDENTIAL_ENV_ABSENT=" + credentialEnvAbsent);
    if (!(networkBlocked && metadataBlocked && dockerSocketAbsent && hostMountAbsent && credentialEnvAbsent)) System.exit(1);
  }
}
`,
  cpp: `#include <filesystem>
#include <fstream>
#include <iostream>
bool no_external_route() {
  std::ifstream route("/proc/net/route");
  std::string line;
  std::getline(route, line);
  return !std::getline(route, line);
}
int main() {
  bool network = no_external_route(); bool metadata = no_external_route();
  bool socket_absent = !std::filesystem::exists("/var/run/docker.sock");
  bool mount_absent = !std::filesystem::exists("/host") && !std::filesystem::exists("/mnt/host")
    && !std::filesystem::exists("/Users") && !std::filesystem::exists("/Volumes");
  std::cout << "NETWORK_BLOCKED=" << network << ",METADATA_BLOCKED=" << metadata
    << ",DOCKER_SOCKET_ABSENT=" << socket_absent << ",HOST_MOUNT_ABSENT=" << mount_absent << "\\n";
  return network && metadata && socket_absent && mount_absent ? 0 : 1;
}
`,
  c: `#include <stdio.h>
#include <unistd.h>
static int no_external_route(void) {
  FILE* route = fopen("/proc/net/route", "r");
  if (route == NULL) return 0;
  char line[512];
  fgets(line, sizeof(line), route);
  int no_route = fgets(line, sizeof(line), route) == NULL;
  fclose(route);
  return no_route;
}
int main(void) {
  int network = no_external_route(); int metadata = no_external_route();
  int socket_absent = access("/var/run/docker.sock", F_OK) != 0;
  int mount_absent = access("/host", F_OK) != 0 && access("/mnt/host", F_OK) != 0
    && access("/Users", F_OK) != 0 && access("/Volumes", F_OK) != 0;
  printf("NETWORK_BLOCKED=%d,METADATA_BLOCKED=%d,DOCKER_SOCKET_ABSENT=%d,HOST_MOUNT_ABSENT=%d\\n",
    network, metadata, socket_absent, mount_absent);
  return network && metadata && socket_absent && mount_absent ? 0 : 1;
}
`,
};
const limits = [
  "--network=none",
  "--read-only",
  "--workdir=/work",
  "--tmpfs=/work:rw,exec,nosuid,nodev,size=16m,uid=65532,gid=65532,mode=700",
  "--tmpfs=/tmp:rw,nosuid,nodev,size=16m,uid=65532,gid=65532,mode=700",
  "--cap-drop=ALL",
  "--security-opt=no-new-privileges:true",
  "--pids-limit=32",
  "--memory=384m",
  "--memory-swap=384m",
  "--cpus=0.5",
  "--ulimit=nofile=64:64",
  "--ulimit=fsize=1048576:1048576",
  "--user=65532:65532",
  "--env=PATH=/opt/java/openjdk/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
  "--env=HOME=/work",
];

function runDocker(name, language, source, mode) {
  const args = [
    "run",
    "--rm",
    "-i",
    `--name=algocove-${name}`,
    ...runtimeArgs,
    ...limits,
    images[language],
    "sh",
    "-c",
    `cat > /work/${filenames[language]} && ${commands[language]}`,
  ];
  const started = performance.now();
  const result = spawnSync("docker", args, {
    input: source,
    encoding: "utf8",
    timeout: 20_000,
    maxBuffer: 16_384,
  });
  if (result.error?.code === "ETIMEDOUT")
    spawnSync("docker", ["rm", "-f", `algocove-${name}`], { encoding: "utf8" });
  return {
    language,
    mode,
    image: images[language],
    durationMs: Math.round(performance.now() - started),
    exitCode: result.status,
    timedOut: result.error?.code === "ETIMEDOUT",
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 500),
  };
}

function runConcurrentNormal() {
  return new Promise((resolve) => {
    const started = performance.now();
    let remaining = languages.length;
    const results = [];
    for (const language of languages) {
      const child = spawn(
        "docker",
        [
          "run",
          "--rm",
          "-i",
          `--name=algocove-concurrency-${language}`,
          ...runtimeArgs,
          ...limits,
          images[language],
          "sh",
          "-c",
          `cat > /work/${filenames[language]} && ${commands[language]}`,
        ],
        { stdio: ["pipe", "pipe", "pipe"] },
      );
      let output = "";
      child.stdout.on("data", (chunk) => {
        output += chunk;
      });
      child.stderr.on("data", (chunk) => {
        output += chunk;
      });
      child.on("close", (exitCode) => {
        results.push({
          language,
          exitCode,
          output: output.trim().replace(/\s+/g, " ").slice(0, 200),
        });
        remaining -= 1;
        if (remaining === 0)
          resolve({ durationMs: Math.round(performance.now() - started), results });
      });
      child.stdin.end(normal[language]);
    }
  });
}

function commandOutput(args) {
  const result = spawnSync("docker", args, { encoding: "utf8", maxBuffer: 32_768 });
  return (result.stdout ?? result.stderr ?? "").trim();
}

const dockerVersion = commandOutput(["info", "--format", "{{.ServerVersion}}"]);
const dockerRuntimesRaw = commandOutput(["info", "--format", "{{json .Runtimes}}"]);
let dockerRuntimes = dockerRuntimesRaw;
let availableRuntimes = [];
try {
  availableRuntimes = Object.keys(JSON.parse(dockerRuntimesRaw));
  dockerRuntimes = availableRuntimes.join(", ");
} catch {
  // Preserve a diagnostic if Docker returns non-JSON runtime output.
}
if (requestedRuntime && !availableRuntimes.includes(requestedRuntime)) {
  throw new Error(
    `Requested Docker runtime ${requestedRuntime} is unavailable. Available runtimes: ${availableRuntimes.join(", ") || "unknown"}`,
  );
}
const runsc = Boolean(
  spawnSync("sh", ["-c", "command -v runsc"], { encoding: "utf8" }).stdout?.trim(),
);
const firecracker = Boolean(
  spawnSync("sh", ["-c", "command -v firecracker"], { encoding: "utf8" }).stdout?.trim(),
);
const results = [];
for (const language of languages) {
  results.push(runDocker(`normal-${language}`, language, normal[language], "normal"));
  results.push(runDocker(`hostile-${language}`, language, hostile[language], "hostile"));
}
const concurrency = await runConcurrentNormal();
const imageMetadata = Object.fromEntries(
  languages.map((language) => [
    language,
    commandOutput([
      "image",
      "inspect",
      images[language],
      "--format",
      "{{.Id}}|{{.Size}}|{{index .RepoDigests 0}}",
    ]),
  ]),
);
const normalPassed = results
  .filter((result) => result.mode === "normal")
  .every((result) => result.exitCode === 0);
const hostilePassed = results
  .filter((result) => result.mode === "hostile")
  .every((result) => result.exitCode === 0);
const decision = requestedRuntime
  ? `Candidate runtime ${requestedRuntime} executed; security-owner approval is still required.`
  : runsc || firecracker
    ? "REJECTED for production: a stronger runtime was available but not selected; rerun with ALGO_COVE_DOCKER_RUNTIME set to the approved candidate."
    : "REJECTED for production: only default runc was available; repeat with a gVisor-class or microVM-class candidate.";
const runtimeStatement = requestedRuntime
  ? `This run explicitly selected Docker runtime \`${requestedRuntime}\`. Passing fixtures demonstrate candidate-runtime behavior only; they do not grant security-owner approval or production promotion.`
  : "The Docker runc run is a control-baseline probe only. It is not approval for hostile learner code. Docker requires explicit resource limits and its none network driver removes non-loopback networking; the architecture requires a gVisor-class, microVM-class, or equivalently isolated managed runtime.";

const report = [
  "# Task 19 sandbox-selection spike",
  "",
  "Date: 2026-09-17",
  "",
  "## Decision",
  "",
  decision,
  "",
  runtimeStatement,
  "",
  "## Environment",
  "",
  `- Docker server: ${dockerVersion}`,
  `- Docker runtimes: ${dockerRuntimes}`,
  `- Selected runtime: ${requestedRuntime ?? "Docker default (control baseline)"}`,
  `- runsc available: ${runsc}`,
  `- Firecracker available: ${firecracker}`,
  `- Enforced run flags: ${limits.join(" ")}`,
  "",
  "## Fixture results",
  "",
  "| Language | Mode | Exit | Timed out | Duration (ms) | Output marker |",
  "| --- | --- | ---: | ---: | ---: | --- |",
  ...results.map(
    (result) =>
      `| ${result.language} | ${result.mode} | ${result.exitCode ?? "none"} | ${result.timedOut} | ${result.durationMs} | ${result.output || "(empty)"} |`,
  ),
  "",
  `- Normal fixtures all passed: ${normalPassed}`,
  `- Hostile boundary fixtures all passed: ${hostilePassed}`,
  "",
  "## Concurrency",
  "",
  `- Six normal fixtures launched concurrently: ${concurrency.durationMs} ms wall time`,
  `- Results: ${concurrency.results.map((result) => `${result.language}=${result.exitCode}`).join(", ")}`,
  "",
  "This is a local startup/concurrency observation, not a capacity or cost claim.",
  "",
  "## Image provenance",
  "",
  ...Object.entries(imageMetadata).map(([language, metadata]) => `- ${language}: ${metadata}`),
  "",
  "Image patching, SBOM/signature verification, host quarantine, and production observability were not proven by this local spike. They remain required before runtime-image promotion and are intentionally left to Tasks 22 and 24.",
  "",
  "## Required follow-up",
  "",
  "1. If this was the control baseline, run the same fixture matrix with an installed gVisor runsc runtime or Firecracker-class runner using ALGO_COVE_DOCKER_RUNTIME.",
  "2. Record security-owner approval, rejection, or a narrowed decision with threat-model evidence.",
  "3. Keep Docker runc as a local developer probe only; never enable learner execution from this result.",
  "",
  "## Sources",
  "",
  "- https://docs.docker.com/engine/containers/resource_constraints/",
  "- https://docs.docker.com/engine/network/drivers/none/",
  "- https://gvisor.dev/docs/architecture_guide/security/",
  "- https://github.com/firecracker-microvm/firecracker/blob/main/docs/design.md",
  "",
].join("\n");
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, report);
console.log(`Wrote ${reportPath}`);
console.log(
  `normal=${normalPassed} hostile=${hostilePassed} runsc=${runsc} firecracker=${firecracker}`,
);
