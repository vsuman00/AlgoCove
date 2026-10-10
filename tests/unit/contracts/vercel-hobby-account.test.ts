import { describe, expect, it } from "vitest";
import {
  hobbyTarget,
  inspectHobbyAccount,
  qualifyHobbyAccount,
} from "../../../ops/environments/vercel-hobby/account.ts";

const team = { id: hobbyTarget.teamId, billing: { plan: "hobby" } };
const project = {
  id: hobbyTarget.projectId,
  name: hobbyTarget.projectName,
  accountId: hobbyTarget.teamId,
};

describe("Hobby account admission", () => {
  it("qualifies only the existing account without enabling execution", () => {
    expect(qualifyHobbyAccount(team, project)).toMatchObject({
      plan: "hobby",
      executionEnabled: false,
      capabilitiesQualified: false,
    });
  });

  it.each(["pro", "enterprise", "trial", undefined, null])("rejects plan %s", (plan) => {
    expect(() => qualifyHobbyAccount({ ...team, billing: { plan } }, project)).toThrow();
  });

  it.each([{}, null, [], { ...team, billing: undefined }])("rejects missing billing", (value) => {
    expect(() => qualifyHobbyAccount(value, project)).toThrow();
  });

  it("rejects a different account or project", () => {
    expect(() => qualifyHobbyAccount({ ...team, id: "other" }, project)).toThrow();
    expect(() => qualifyHobbyAccount(team, { ...project, accountId: "other" })).toThrow();
    expect(() => qualifyHobbyAccount(team, { ...project, id: "other" })).toThrow();
  });

  it("reads only fixed scoped endpoints and returns no private provider fields", async () => {
    const calls: string[] = [];
    const request: typeof fetch = async (input, options) => {
      calls.push(String(input));
      expect(options?.method).toBe("GET");
      expect(options?.redirect).toBe("error");
      expect(options?.signal).toBeInstanceOf(AbortSignal);
      return Response.json(
        calls.length === 1 ? project : { ...team, privateField: "PRIVATE_CANARY" },
      );
    };
    const receipt = await inspectHobbyAccount("synthetic-token", request);
    expect(calls).toEqual([
      `https://api.vercel.com/v9/projects/${hobbyTarget.projectId}?teamId=${hobbyTarget.teamId}`,
      `https://api.vercel.com/v2/teams/${hobbyTarget.teamId}`,
    ]);
    expect(JSON.stringify(receipt)).not.toContain("PRIVATE_CANARY");
  });

  it("rejects missing credentials without requesting provider resources", async () => {
    await expect(
      inspectHobbyAccount(" ", async () => {
        throw Error("must_not_call");
      }),
    ).rejects.toThrow("provider_token_required");
  });

  it("does not expose a provider error body", async () => {
    await expect(
      inspectHobbyAccount(
        "synthetic-token",
        async () => new Response("PRIVATE_CANARY", { status: 403 }),
      ),
    ).rejects.toThrow("project_read_http_403");
  });
});
