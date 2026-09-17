import { readFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, "abuse-manifest.json"), "utf8"));
const image = manifest.target;
const maxOutputBytes = manifest.maxOutputBytes;
const limits = [
  "--network=none",
  "--read-only",
  "--workdir=/work",
  "--tmpfs=/work:rw,exec,nosuid,nodev,size=8m,uid=65532,gid=65532,mode=700",
  "--tmpfs=/tmp:rw,nosuid,nodev,size=8m,uid=65532,gid=65532,mode=700",
  "--cap-drop=ALL",
  "--security-opt=no-new-privileges:true",
  "--pids-limit=8",
  "--memory=128m",
  "--memory-swap=128m",
  "--cpus=0.25",
  "--ulimit=nofile=32:32",
  "--ulimit=fsize=65536:65536",
  "--user=65532:65532",
  "--env=HOME=/work",
  "--env=PATH=/usr/local/bin:/usr/bin:/bin",
];

const sources = {
  "escape-boundary": `
import os
checks = {
    "non_root": os.geteuid() == 65532,
    "docker_socket_absent": not os.path.exists("/var/run/docker.sock"),
    "host_mount_absent": not any(os.path.exists(p) for p in ("/host", "/mnt/host", "/Users", "/Volumes")),
    "proc_root_is_container_only": os.path.realpath("/proc/1/root") == "/",
}
print("ESCAPE=" + ("PASS" if all(checks.values()) else "FAIL"))
raise SystemExit(0 if all(checks.values()) else 1)
`,
  "egress-denial": `
import socket
try:
    socket.create_connection(("1.1.1.1", 80), timeout=0.25)
except OSError:
    print("EGRESS=BLOCKED")
    raise SystemExit(0)
raise SystemExit(1)
`,
  "metadata-denial": `
import socket
try:
    socket.create_connection(("169.254.169.254", 80), timeout=0.25)
except OSError:
    print("METADATA=BLOCKED")
    raise SystemExit(0)
raise SystemExit(1)
`,
  "fork-thread-bomb": `
import os
children = []
try:
    for _ in range(64):
        child = os.fork()
        if child == 0:
            os._exit(0)
        children.append(child)
except OSError:
    pass
for child in children:
    try:
        os.waitpid(child, 0)
    except ChildProcessError:
        pass
print("PID_LIMIT=ENFORCED")
`,
  "memory-flood": `
try:
    allocation = bytearray(512 * 1024 * 1024)
    allocation[0] = 1
except (MemoryError, OSError):
    print("MEMORY_LIMIT=ENFORCED")
    raise SystemExit(0)
raise SystemExit(2)
`,
  "cpu-flood": `
while True:
    pass
`,
  "disk-flood": `
try:
    with open("/tmp/flood.bin", "wb") as output:
        output.write(b"x" * (2 * 1024 * 1024))
except (OSError, MemoryError):
    print("DISK_LIMIT=ENFORCED")
    raise SystemExit(0)
raise SystemExit(2)
`,
  "output-flood": `
print("x" * 100_000)
`,
  "path-traversal": `
import os
try:
    with open("/work/../algocove-host-escape", "w", encoding="utf-8") as output:
        output.write("must not persist")
except OSError:
    print("PATH_TRAVERSAL=BLOCKED")
    raise SystemExit(0)
raise SystemExit(1)
`,
  "symlink-boundary": `
import os
try:
    os.symlink("/etc/passwd", "/work/passwd-link")
    with open("/work/passwd-link", "w", encoding="utf-8") as output:
        output.write("must not overwrite")
except OSError:
    print("SYMLINK_ESCAPE=BLOCKED")
    raise SystemExit(0)
raise SystemExit(1)
`,
  "container-residue": `
with open("/work/owned-fixture-marker", "w", encoding="utf-8") as marker:
    marker.write("container scoped")
print("RESIDUE=CONTAINER_SCOPED")
`,
  "signal-boundary": `
import signal
import time
signal.signal(signal.SIGTERM, lambda _signum, _frame: raise_signal())
def raise_signal():
    raise SystemExit(143)
while True:
    time.sleep(1)
`,
  "explicit-cancellation": `
import time
while True:
    time.sleep(1)
`,
  "teardown-residue": `
with open("/tmp/teardown-marker", "w", encoding="utf-8") as marker:
    marker.write("must be removed with container")
print("TEARDOWN=READY")
`,
};

function cleanup(name) {
  spawnSync("docker", ["rm", "--force", name], { encoding: "utf8", stdio: "ignore" });
}

function hasContainerResidue(name) {
  const result = spawnSync("docker", ["ps", "--all", "--quiet", "--filter", `name=^${name}$`], {
    encoding: "utf8",
  });
  return (result.stdout ?? "").trim().length > 0;
}

function runFixture(fixture) {
  const name = `algocove-abuse-${fixture.id}-${process.pid}`;
  const command = `cat > /work/fixture.py && python /work/fixture.py`;
  const child = spawn(
    "docker",
    ["run", "--rm", "-i", `--name=${name}`, ...limits, image, "sh", "-c", command],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  let output = "";
  let overflow = false;
  let timedOut = false;
  let settled = false;
  let timeout;

  const finish = (exitCode, signal) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    cleanup(name);
    const residue = hasContainerResidue(name);
    process.stdout.write(
      `${fixture.id} exit=${exitCode ?? "none"} signal=${signal ?? "none"} timeout=${timedOut} overflow=${overflow} residue=${residue}\n`,
    );
    if (residue) throw new Error(`${fixture.id} left a Docker container behind.`);
    const expectation = fixture.terminalExpectation;
    const safeProbe = expectation === "safe_probe" && exitCode === 0 && !timedOut && !overflow;
    const boundedLimit =
      expectation === "bounded_limit" && exitCode !== 0 && !timedOut && !overflow;
    const controlPlane = expectation === "control_plane" && (timedOut || overflow);
    if (!(safeProbe || boundedLimit || controlPlane)) {
      throw new Error(`${fixture.id} did not satisfy ${expectation}.`);
    }
  };

  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
    if (Buffer.byteLength(output) > maxOutputBytes && !settled) {
      overflow = true;
      child.kill("SIGKILL");
      cleanup(name);
    }
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
    if (Buffer.byteLength(output) > maxOutputBytes && !settled) {
      overflow = true;
      child.kill("SIGKILL");
      cleanup(name);
    }
  });
  timeout = setTimeout(() => {
    if (settled) return;
    timedOut = true;
    child.kill("SIGKILL");
    cleanup(name);
  }, fixture.maxDurationMs);
  child.on("error", (error) => {
    if (!settled) throw error;
  });
  child.on("close", (exitCode, signal) => finish(exitCode, signal));
  child.stdin.end(sources[fixture.id]);
  return new Promise((resolve) => child.once("close", () => resolve()));
}

const imageCheck = spawnSync("docker", ["image", "inspect", image], { encoding: "utf8" });
if (imageCheck.status !== 0) throw new Error(`Image ${image} is not built locally.`);

for (const fixture of manifest.fixtures) await runFixture(fixture);
console.log("All Task 24 abuse fixtures completed with bounded terminal outcomes.");
