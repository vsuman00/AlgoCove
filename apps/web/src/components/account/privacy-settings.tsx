"use client";
import { useEffect, useState, type ReactElement } from "react";
import { useReverification } from "@clerk/nextjs";
import type { PrivacyStatus } from "@algocove/application";
const control =
  "min-h-11 rounded-cove-sm border border-cove-strong bg-cove-surface px-4 py-2 text-cove-primary focus-visible:outline-[var(--focus-ring)]";
export default function PrivacySettings({
  clerkConfigured,
}: {
  clerkConfigured: boolean;
}): ReactElement {
  // Rendering this child only under ClerkProvider preserves the anonymous local shell.
  return clerkConfigured ? (
    <VerifiedPrivacySettings />
  ) : (
    <PrivacyPanel
      send={(body) =>
        fetch("/api/privacy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      }
    />
  );
}
function VerifiedPrivacySettings() {
  const send = useReverification((body: unknown) =>
    fetch("/api/privacy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return <PrivacyPanel send={send} />;
}
export function PrivacyPanel({
  send,
}: {
  send: (body: unknown) => Promise<Response | null | undefined>;
}): ReactElement {
  const [status, setStatus] = useState<PrivacyStatus | null>(null),
    [message, setMessage] = useState("Loading privacy status…"),
    [busy, setBusy] = useState(false),
    [confirmation, setConfirmation] = useState("");
  async function load() {
    setBusy(true);
    try {
      const response = await fetch("/api/privacy", { cache: "no-store" });
      if (!response.ok) throw Error();
      setStatus(await response.json());
      setMessage("Privacy status loaded.");
    } catch {
      setMessage("Privacy status unavailable. Sign in or retry.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/privacy", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw Error();
        return response.json();
      })
      .then((value) => {
        if (!cancelled) {
          setStatus(value);
          setMessage("Privacy status loaded.");
        }
      })
      .catch(() => {
        if (!cancelled) setMessage("Privacy status unavailable. Sign in or retry.");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function act(action: "export" | "delete") {
    setBusy(true);
    try {
      const current =
        action === "delete"
          ? await fetch("/api/auth/session", { cache: "no-store" })
              .then((r) => r.json())
              .catch(() => null)
          : null;
      const response = await send({ action, ...(action === "delete" ? { confirmation } : {}) });
      if (!response) {
        setMessage("Identity verification cancelled. Your data is unchanged.");
        return;
      }
      if (!response.ok) {
        const data = await response.json();
        setMessage(data.error?.message ?? "Privacy request unavailable. Retry.");
        return;
      }
      if (action === "export") {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "algocove-private-data.json";
        link.click();
        URL.revokeObjectURL(url);
        setMessage("Your private data export is ready. Store it securely.");
      } else {
        const receipt: PrivacyStatus = await response.json();
        setStatus(receipt);
        // Clear only this account's recovery snapshots on this browser.
        const id = current?.user?.id;
        if (id) {
          localStorage.setItem(`algocove:privacy-deleted:${encodeURIComponent(id)}`, "pending");
          for (const key of Object.keys(localStorage))
            if (
              key.startsWith("algocove:workspace-recovery:") &&
              key.includes(`:${encodeURIComponent(id)}:`)
            )
              localStorage.removeItem(key);
        }
        setMessage(
          "Deletion requested. New learning work is blocked while existing work is cancelled and private records are removed.",
        );
      }
    } catch {
      setMessage("Request interrupted. Refresh status before retrying deletion.");
    } finally {
      setBusy(false);
    }
  }
  const active = status?.state === "active";
  return (
    <div className="grid gap-6">
      <p role="status" aria-live="polite">
        {message}
      </p>
      <div className="flex flex-wrap gap-3">
        <button className={control} disabled={busy} onClick={() => void load()}>
          Refresh status
        </button>
        <a className={control} href="/sign-in?returnTo=%2Fsettings%2Fprivacy">
          Sign in
        </a>
      </div>
      <section aria-labelledby="export-heading">
        <h2 id="export-heading">Export your learning data</h2>
        <p>
          Download your profile, saved work, practice journal, plans and learning evidence, with the
          versions used by those records. Identity verification is required.
        </p>
        <button className={control} disabled={busy || !active} onClick={() => void act("export")}>
          Export private data
        </button>
      </section>
      <section aria-labelledby="delete-heading">
        <h2 id="delete-heading">Delete your account data</h2>
        <p>
          Deletion removes private learning records and unlinks your sign-in identity. Published
          curriculum attribution retains an unlinked account identifier. Existing backups are
          tracked until expiry. This cannot be undone through this page.
        </p>
        <label htmlFor="delete-confirmation">Type DELETE MY DATA to confirm</label>
        <input
          className={control}
          id="delete-confirmation"
          value={confirmation}
          disabled={busy || !active}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="off"
        />
        <button
          className={control}
          disabled={busy || !active || confirmation !== "DELETE MY DATA"}
          onClick={() => void act("delete")}
        >
          Request deletion
        </button>
        {status && (
          <p>
            Account state: {status.state}.{" "}
            {status.deletionState && `Deletion: ${status.deletionState}.`}{" "}
            {status.backupExpiry && `Backup expiry tracking date: ${status.backupExpiry}.`}
          </p>
        )}
      </section>
    </div>
  );
}
