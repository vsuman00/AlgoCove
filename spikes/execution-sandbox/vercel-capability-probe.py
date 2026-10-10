"""Synthetic discovery only. Never print environment values or run learner code."""

import json
import os
from pathlib import Path
import socket
import subprocess
import sys


def blocked(host, port):
    connection = socket.socket()
    connection.settimeout(0.5)
    try:
        connection.connect((host, port))
        return False
    except OSError:
        return True
    finally:
        connection.close()


def cgroup(name):
    location = Path("/sys/fs/cgroup") / name
    return location.read_text().strip() if location.exists() else "unavailable"


result = {
    "normal": sum([1, 2, 3]) == 6,
    "pythonVersion": sys.version.split()[0],
    "uid": os.getuid(),
    "externalBlocked": blocked("1.1.1.1", 443),
    "metadataBlocked": blocked("169.254.169.254", 80),
    "credentialEnvAbsent": not any(
        any(word in key.upper() for word in ["TOKEN", "SECRET", "PASSWORD", "DATABASE_URL"])
        for key in os.environ
    ),
    "dockerSocketAbsent": not Path("/var/run/docker.sock").exists(),
    "memoryMax": cgroup("memory.max"),
    "pidsMax": cgroup("pids.max"),
}
try:
    result["sudoAvailable"] = subprocess.run(
        ["sudo", "-n", "true"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=1,
        check=False,
    ).returncode == 0
except (OSError, subprocess.TimeoutExpired):
    result["sudoAvailable"] = False

print(json.dumps(result))
