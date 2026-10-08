import { expect, it } from "vitest";
import { practiceDestination } from "@algocove/domain";
it("deduplicates canonical solve identities independently from source sheets", () => {
  expect(practiceDestination("https://leetcode.com/problems/two-sum")).toEqual(
    practiceDestination("https://leetcode.com/problems/two-sum/"),
  );
  for (const url of [
    "https://leetcode.com/studyplan/top-interview-150/",
    "https://blind75.com/",
    "https://leetcode.com/problems/two-sum/?token=secret",
    "https://leetcode.com@evil.test/problems/two-sum/",
    "http://leetcode.com/problems/two-sum/",
    "https://leetcode.com/problems/a%2fb/",
  ])
    expect(practiceDestination(url)).toBeNull();
});
