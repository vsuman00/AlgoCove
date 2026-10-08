export type PracticeDestination = {
  platform: "leetcode" | "neetcode";
  canonicalKey: string;
  canonicalUrl: string;
};
/** Canonical solve URL admission is independent of a sheet name or legacy provider value. */
export function practiceDestination(raw: unknown): PracticeDestination | null {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    url.search
  )
    return null;
  const match = /^\/problems\/([a-z][a-z0-9-]{0,199})\/?$/.exec(url.pathname);
  if (!match || !["leetcode.com", "neetcode.io"].includes(url.hostname)) return null;
  const platform = url.hostname === "leetcode.com" ? "leetcode" : "neetcode";
  return {
    platform,
    canonicalKey: match[1]!,
    canonicalUrl: `https://${url.hostname}/problems/${match[1]}${platform === "leetcode" ? "/" : ""}`,
  };
}
