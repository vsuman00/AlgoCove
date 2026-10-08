/** Only bounded same-origin learner destinations can survive authentication. */
export function safeReturnTo(raw: unknown, fallback = "/learn", depth = 0): string {
  if (
    depth > 2 ||
    typeof raw !== "string" ||
    raw.length > 1024 ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\") ||
    [...raw].some((c) => c.charCodeAt(0) <= 32)
  )
    return fallback;
  try {
    const url = new URL(raw, "https://algocove.local");
    if (
      url.origin !== "https://algocove.local" ||
      url.hash ||
      /%(?:2f|5c|00|0a|0d)/i.test(url.pathname) ||
      !/^\/(?:learn(?:\/[a-z0-9._-]+){0,3}|sheets(?:\/[a-z0-9._-]+)?|plan|roadmap|review|progress|onboarding|settings\/privacy)?$/.test(
        url.pathname,
      )
    )
      return fallback;
    const allowed = ["language", "search", "pattern", "after", "attemptId", "returnTo"];
    if (
      [...url.searchParams.keys()].some(
        (k) => !allowed.includes(k) || url.searchParams.getAll(k).length !== 1,
      )
    )
      return fallback;
    if (url.searchParams.has("returnTo")) {
      if (depth === 2) url.searchParams.delete("returnTo");
      else
        url.searchParams.set(
          "returnTo",
          safeReturnTo(url.searchParams.get("returnTo"), fallback, depth + 1),
        );
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
