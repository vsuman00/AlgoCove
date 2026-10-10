"""Fixed trusted diagnostics, not a learner launcher. No environment values emitted."""

import json
from pathlib import Path
import shutil
import subprocess
import tempfile


def succeeds(args):
    try:
        return subprocess.run(
            args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            timeout=2, check=False,
        ).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


result = {
    "dockerInstalled": shutil.which("docker") is not None,
    "mountNamespaceAvailable": succeeds(["unshare", "--mount", "true"]),
    "networkNamespaceAvailable": succeeds(["unshare", "--net", "true"]),
    "privilegeDropAvailable": succeeds([
        "setpriv", "--reuid=65532", "--regid=65532", "--clear-groups",
        "--no-new-privs", "--bounding-set=-all", "--inh-caps=-all",
        "--ambient-caps=-all", "python3", "-c",
        "import os; from pathlib import Path; "
        "s=Path('/proc/self/status').read_text(); "
        "assert os.getuid()==65532 and os.getgid()==65532; "
        "assert 'NoNewPrivs:\\t1' in s and 'CapEff:\\t0000000000000000' in s",
    ]),
    "childCgroupMemoryWritable": False,
    "childCgroupPidsWritable": False,
    "childCgroupCpuWritable": False,
    "childCgroupRemoved": False,
    "parentControllersRestored": False,
}
group = None
subtree = Path("/sys/fs/cgroup/cgroup.subtree_control")
added = []
try:
    # Trusted setup in this disposable diagnostic VM only. Do not alter parent limits.
    # Enable missing child controllers, then restore them after removing the empty group.
    existing = set(subtree.read_text().split())
    added = [name for name in ["memory", "pids", "cpu"] if name not in existing]
    if added:
        subtree.write_text(" ".join("+" + name for name in added))
    group = Path(tempfile.mkdtemp(prefix="algocove-discovery-", dir="/sys/fs/cgroup"))
    for key, filename, value in [
        ("childCgroupMemoryWritable", "memory.max", "134217728"),
        ("childCgroupPidsWritable", "pids.max", "8"),
        ("childCgroupCpuWritable", "cpu.max", "10000 100000"),
    ]:
        path = group / filename
        if path.exists():
            try:
                path.write_text(value)
                result[key] = path.read_text().strip() == value
            except OSError:
                pass
except OSError:
    pass
finally:
    if group is not None:
        try:
            group.rmdir()
            result["childCgroupRemoved"] = not group.exists()
        except OSError:
            pass
    try:
        if added:
            subtree.write_text(" ".join("-" + name for name in added))
        result["parentControllersRestored"] = set(subtree.read_text().split()) == existing
    except (OSError, NameError):
        pass

print(json.dumps(result))
