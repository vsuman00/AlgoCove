import { parseId, type OpaqueId } from "@algocove/domain";
import { validationError } from "@algocove/application";

const PROBLEM_VERSION_BY_SLUG = {
  "arrays-two-pointer": "prb_dddddddddddddddd",
} as const;

export function problemVersionFrom(value: unknown): OpaqueId<"problemVersion"> {
  if (typeof value !== "string" || !Object.hasOwn(PROBLEM_VERSION_BY_SLUG, value)) {
    throw validationError("Problem workspace is not available.", { field: "problem_id" });
  }
  const raw = PROBLEM_VERSION_BY_SLUG[value as keyof typeof PROBLEM_VERSION_BY_SLUG];
  const problemVersionId = parseId("problemVersion", raw);
  if (!problemVersionId.ok) throw new Error("Practice catalog identifier is invalid.");
  return problemVersionId.value;
}
