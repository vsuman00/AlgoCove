import sys


def solve(raw):
    lines = raw.splitlines()
    target = int(lines[0])
    values = [int(value) for value in lines[1].split(",") if value]
    label = lines[2]
    for left in range(len(values)):
        for right in range(left + 1, len(values)):
            total = values[left] + values[right]
            matches = total == target
            if matches:
                return f"{left},{right}|{label}"
    return f"none|{label}"


print(solve(sys.stdin.read()))
