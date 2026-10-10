import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { promoteRuntimeRelease } from "./runtime-promotion.ts";
import { verifyRuntimeRelease } from "./verify-runtime.ts";

try {
  const [action, manifestFile, bundleFile, stateDirectory, expectedCurrent, ...rest] =
    process.argv.slice(2);
  if (
    !["promote", "rollback"].includes(action ?? "") ||
    !manifestFile ||
    !bundleFile ||
    !stateDirectory ||
    !expectedCurrent ||
    rest.length ||
    (expectedCurrent !== "none" && !/^sha256:[a-f0-9]{64}$/.test(expectedCurrent))
  )
    throw Error("arguments");
  const receipt = promoteRuntimeRelease(
    {
      action: action as "promote" | "rollback",
      stateDirectory: resolve(stateDirectory),
      candidate: readFileSync(manifestFile, "utf8"),
      bundle: readFileSync(bundleFile, "utf8"),
      expectedCurrent: expectedCurrent === "none" ? null : expectedCurrent,
    },
    verifyRuntimeRelease,
  );
  process.stdout.write(JSON.stringify({ status: "runtime_pointer_changed", ...receipt }) + "\n");
} catch {
  process.stderr.write('{"status":"runtime_promotion_rejected"}\n');
  process.exitCode = 1;
}
