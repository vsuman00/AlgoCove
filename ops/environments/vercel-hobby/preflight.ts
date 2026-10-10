import { inspectHobbyAccount } from "./account.ts";

try {
  if (process.argv.length !== 2) throw Error("invalid_arguments");
  const receipt = await inspectHobbyAccount(process.env.VERCEL_TOKEN ?? "");
  process.stdout.write(JSON.stringify({ ...receipt, checkedAt: new Date().toISOString() }) + "\n");
} catch (error) {
  const safeReasons = new Set([
    "invalid_arguments",
    "invalid_provider_response",
    "unexpected_provider_scope",
    "hobby_plan_required",
    "provider_token_required",
    "provider_read_rejected",
  ]);
  process.stderr.write(
    JSON.stringify({
      status: "hobby_account_failed",
      reason:
        error instanceof Error &&
        (safeReasons.has(error.message) ||
          /^(team|project)_read_http_[1-5][0-9]{2}$/.test(error.message))
          ? error.message
          : "account_or_access_not_qualified",
    }) + "\n",
  );
  process.exitCode = 1;
}
