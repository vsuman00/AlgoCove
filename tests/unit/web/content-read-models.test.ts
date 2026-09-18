import { describe, expect, it } from "vitest";
import { phase3ContentFixture } from "../../../apps/web/src/content-fixtures";

describe("content operations fixture read model", () => {
  it("shows complete separated review evidence but keeps runnable publication blocked", () => {
    const model = phase3ContentFixture();

    expect(model.reviewRows.map((row) => row.status)).toEqual(["approved", "approved"]);
    expect(model.validationLabel).toBe("Passed");
    expect(model.languageRows).toHaveLength(6);
    expect(model.languageRows.map((row) => row.displayName)).toEqual([
      "Python",
      "JavaScript",
      "TypeScript",
      "Java",
      "C++",
      "C",
    ]);
    expect(model.languageRows.every((row) => row.entrySignature.length > 0)).toBe(true);
    expect(model.externalReference.canNavigate).toBe(true);
    expect(model.publicationStatus).toBe("fixture_only_blocked");
    expect(model.publicationBlockers).toContain(
      "Runnable publication is blocked until the hostile-code sandbox is approved by the security owner.",
    );
  });
});
