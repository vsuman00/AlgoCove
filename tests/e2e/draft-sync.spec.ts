import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { expect, test } from "@playwright/test";

type BrowserDraftApi = {
  createBrowserDraftRecoveryStore(storage: Storage): {
    load(input: { learnerId: string; draftId: string; now: string }): unknown;
    save(snapshot: unknown): void;
    clear(input: { learnerId: string; draftId: string }): void;
    clearLearner(learnerId: string): void;
  };
  createDraftSyncController(input: {
    learnerId: string;
    initialDraft: Record<string, unknown>;
    transport: {
      replaceCurrent(input: {
        draftId: string;
        expectedVersion: number;
        text: string;
      }): Promise<Record<string, unknown>>;
      getDraft(draftId: string): Promise<Record<string, unknown>>;
    };
    recoveryStore: ReturnType<BrowserDraftApi["createBrowserDraftRecoveryStore"]>;
    now: () => string;
  }): {
    recover(): boolean;
    setCurrentText(text: string): void;
    sync(): Promise<{
      state: string;
      currentText: string;
      remoteDraft: Record<string, unknown> | null;
    }>;
    clearLearnerRecovery(): void;
  };
};

function browserBundle(): string {
  const sourcePath = path.resolve(process.cwd(), "apps/web/src/drafts/draft-sync.ts");
  const source = fs.readFileSync(sourcePath, "utf8").replace(/^export\s+/gm, "");
  const compiled = ts
    .transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    })
    .outputText.replace(/\nexport \{\};\s*$/, "");
  return `${compiled}\nwindow.__algoCoveDraftSync = { createBrowserDraftRecoveryStore, createDraftSyncController };`;
}

test("draft sync survives offline reload, reconnects, and preserves newer remote work", async ({
  page,
}) => {
  await page.goto("/");
  await page.addScriptTag({ content: browserBundle() });

  const result = await page.evaluate(async () => {
    const api = (window as unknown as { __algoCoveDraftSync: BrowserDraftApi }).__algoCoveDraftSync;
    localStorage.clear();
    const recovery = api.createBrowserDraftRecoveryStore(localStorage);
    const initialDraft = {
      draftId: "drf_ffffffffffffffff",
      attemptId: "att_cccccccccccccccc",
      learnerId: "usr_aaaaaaaaaaaaaaaa",
      problemVersionId: "prb_dddddddddddddddd",
      manifestId: "man_eeeeeeeeeeeeeeee",
      language: "python",
      kind: "source",
      currentText: "",
      currentRevision: 0,
      savedRevision: 0,
      version: 1,
      updatedAt: "2026-09-18T10:00:00.000Z",
      expiresAt: "2026-09-25T10:00:00.000Z",
      localRecoveryEnabled: true,
    };
    let online = false;
    let serverText = "";
    let serverVersion = 1;
    const transport = {
      async replaceCurrent(input: { draftId: string; expectedVersion: number; text: string }) {
        if (!online) throw new Error("offline");
        if (input.expectedVersion !== serverVersion) {
          const error = new Error("version conflict") as Error & { code: string };
          error.code = "version_conflict";
          throw error;
        }
        serverText = input.text;
        serverVersion += 1;
        return {
          ...initialDraft,
          currentText: serverText,
          currentRevision: 1,
          version: serverVersion,
        };
      },
      async getDraft() {
        return {
          ...initialDraft,
          currentText: serverText,
          currentRevision: serverText ? 1 : 0,
          version: serverVersion,
        };
      },
    };

    const firstTab = api.createDraftSyncController({
      learnerId: initialDraft.learnerId,
      initialDraft,
      transport,
      recoveryStore: recovery,
      now: () => "2026-09-18T10:01:00.000Z",
    });
    firstTab.setCurrentText("offline work");
    const offline = await firstTab.sync();

    const secondTab = api.createDraftSyncController({
      learnerId: initialDraft.learnerId,
      initialDraft,
      transport,
      recoveryStore: recovery,
      now: () => "2026-09-18T10:02:00.000Z",
    });
    const recovered = secondTab.recover();
    online = true;
    const reconnected = await secondTab.sync();

    serverText = "newer remote";
    serverVersion = 3;
    const staleTab = api.createDraftSyncController({
      learnerId: initialDraft.learnerId,
      initialDraft: { ...initialDraft, currentText: "server copy", version: 2 },
      transport,
      recoveryStore: recovery,
      now: () => "2026-09-18T10:03:00.000Z",
    });
    staleTab.setCurrentText("local conflict");
    const conflict = await staleTab.sync();
    staleTab.clearLearnerRecovery();

    return {
      offline: offline.state,
      recovered,
      reconnected: reconnected.state,
      reconnectedText: reconnected.currentText,
      conflict: conflict.state,
      localTextAfterConflict: conflict.currentText,
      remoteTextAfterConflict: conflict.remoteDraft?.currentText ?? null,
      remainingKeys: localStorage.length,
    };
  });

  expect(result).toEqual({
    offline: "offline",
    recovered: true,
    reconnected: "synced",
    reconnectedText: "offline work",
    conflict: "conflict",
    localTextAfterConflict: "local conflict",
    remoteTextAfterConflict: "newer remote",
    remainingKeys: 0,
  });
});
