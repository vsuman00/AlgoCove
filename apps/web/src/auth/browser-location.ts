"use client";
import { useSyncExternalStore } from "react";
const subscribe = (notify: () => void) => {
  window.addEventListener("popstate", notify);
  return () => window.removeEventListener("popstate", notify);
};
const snapshot = () => window.location.pathname + window.location.search;
export function useBrowserLocation(): string {
  return useSyncExternalStore(subscribe, snapshot, () => "/learn");
}
export function replaceBrowserQuery(query: URLSearchParams): void {
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${query.size ? `?${query}` : ""}`,
  );
  window.dispatchEvent(new PopStateEvent("popstate"));
}
