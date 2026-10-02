import { randomBytes } from "node:crypto";
import { createSystemClock, type IdGenerator } from "@algocove/application";
import { formatId, parseId, MASTERY_POLICY_V1 } from "@algocove/domain";
import {
  createPool,
  PostgresMasteryRepository,
  PostgresMasteryConceptSource,
  PostgresPracticeRepository,
  PostgresOutboxRelayRepository,
} from "@algocove/db";
import { MasteryOutboxRelay } from "./mastery-relay.ts";

try {
  process.loadEnvFile();
} catch {
  /* Environment may be supplied by the operator. */
}
const [command, ...args] = process.argv.slice(2);
if (command !== "consume" && command !== "rebuild")
  throw new Error("Use mastery:consume or mastery:rebuild <learnerId> <conceptId>.");
const url = process.env[command === "rebuild" ? "DATABASE_ADMIN_URL" : "DATABASE_URL"];
if (url === undefined || url.trim() === "")
  throw new Error("The requested mastery command needs its database connection configured.");
const pool = createPool({
  connectionString: url,
  applicationName: `algocove-mastery-${command}`,
  maxConnections: 4,
  statementTimeoutMs: 5000,
});
const mastery = new PostgresMasteryRepository(pool);
try {
  if (command === "rebuild") {
    const learner = parseId("learner", args[0]),
      concept = parseId("concept", args[1]);
    if (!learner.ok || !concept.ok || args.length !== 2)
      throw new Error("Rebuild requires a valid learner ID and concept ID.");
    process.stdout.write(
      JSON.stringify(
        await mastery.rebuild({
          learnerId: learner.value,
          conceptId: concept.value,
          policy: MASTERY_POLICY_V1,
        }),
      ) + "\n",
    );
  } else {
    const limit = args.length === 0 ? 100 : Number(args[0]?.replace(/^--limit=/, ""));
    if (args.length > 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
      throw new Error("Consumer limit must be from 1 to 1000.");
    const ids: IdGenerator = {
      generate(kind) {
        const id = formatId(kind, randomBytes(20).toString("hex"));
        if (!id.ok) throw new Error("Identifier generation failed.");
        return id.value;
      },
    };
    const relay = new MasteryOutboxRelay(
      new PostgresOutboxRelayRepository(pool),
      {
        practice: new PostgresPracticeRepository(pool),
        curriculum: new PostgresMasteryConceptSource(pool),
        mastery,
      },
      { relayId: `mastery-local-${process.pid}`, clock: createSystemClock(), ids },
    );
    for (let n = 0; n < limit; n++) {
      const result = await relay.pumpOnce();
      process.stdout.write(JSON.stringify(result) + "\n");
      if (result.kind === "idle") break;
    }
  }
} finally {
  await pool.end();
}
