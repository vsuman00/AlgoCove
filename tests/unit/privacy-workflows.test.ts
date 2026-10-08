import { describe, expect, it, vi } from "vitest";
import {
  exportPrivateData,
  requestPrivateDeletion,
} from "../../packages/application/src/privacy-workflows.ts";
import type { PrivacyRepository } from "../../packages/application/src/privacy-workflows.ts";
import type { RequestContext } from "@algocove/application";

describe("privacy authorization", () => {
  const context = {} as RequestContext;
  const repository = {
    exportOwned: vi.fn(),
    requestDeletion: vi.fn(),
  } as unknown as PrivacyRepository;
  it("denies stale export verification without reading private data", async () => {
    await expect(
      exportPrivateData(context, repository, { recentlyVerified: false }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(repository.exportOwned).not.toHaveBeenCalled();
  });
  it("requires verified identity and explicit deletion confirmation", async () => {
    await expect(
      requestPrivateDeletion(context, repository, { recentlyVerified: false }, "DELETE MY DATA"),
    ).rejects.toThrow("Verify");
    await expect(
      requestPrivateDeletion(context, repository, { recentlyVerified: true }, "yes"),
    ).rejects.toThrow("Type DELETE");
    expect(repository.requestDeletion).not.toHaveBeenCalled();
  });
});
