import { inspectHobbyAccount } from "./account.ts";

try {
  if (process.argv.length !== 2) throw Error("invalid_arguments");
  const receipt = await inspectHobbyAccount(process.env.VERCEL_TOKEN ?? "");
  process.stdout.write(JSON.stringify({ ...receipt, checkedAt: new Date().toISOString() }) + "\n");
} catch {
  process.stderr.write(
    JSON.stringify({ status: "hobby_account_failed", reason: "account_or_access_not_qualified" }) +
      "\n",
  );
  process.exitCode = 1;
}
