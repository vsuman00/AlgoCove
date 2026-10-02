import type { PlanProposalPort } from "./roadmap-use-cases.ts";
/** Explicit test adapter. Never selected from a browser or a live provider setting. */
export function fixturePlanProposal(
  mode: "valid" | "malformed" | "injected" | "over_capacity" | "failure" | "timeout",
): PlanProposalPort {
  return {
    async propose({ schedule, signal }) {
      if (mode === "failure") throw Error("fixture failure");
      if (mode === "timeout")
        return new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(Error("aborted")), { once: true }),
        );
      if (mode === "malformed") return "not a proposal";
      if (mode === "injected")
        return { items: schedule.items, command: "accept", url: "https://unapproved.invalid" };
      if (mode === "over_capacity")
        return { items: schedule.items.map((i) => ({ ...i, minutes: 9999 })) };
      return { items: schedule.items };
    },
  };
}
