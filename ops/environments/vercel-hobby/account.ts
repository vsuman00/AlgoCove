export const hobbyTarget = {
  teamId: "team_LGvZpIlcg4QXoGDvgCh1JX0v",
  projectId: "prj_y4QC0yhk2h2frXDs8l3H0yn9IjJK",
  projectName: "algocove",
  region: "sin1",
} as const;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("invalid_provider_response");
  return value as Record<string, unknown>;
}

/** Accept only the owner's existing Hobby scope; never infer a free trial is free hosting. */
export function qualifyHobbyAccount(
  teamValue: unknown,
  projectValue: unknown,
): {
  status: "hobby_account_passed";
  teamId: string;
  projectId: string;
  plan: "hobby";
  executionEnabled: false;
  capabilitiesQualified: false;
} {
  const team = record(teamValue);
  const project = record(projectValue);
  if (
    team.id !== hobbyTarget.teamId ||
    project.id !== hobbyTarget.projectId ||
    project.name !== hobbyTarget.projectName ||
    project.accountId !== hobbyTarget.teamId
  )
    throw Error("unexpected_provider_scope");
  const billing = record(team.billing);
  if (billing.plan !== "hobby") throw Error("hobby_plan_required");
  return {
    status: "hobby_account_passed",
    teamId: hobbyTarget.teamId,
    projectId: hobbyTarget.projectId,
    plan: "hobby",
    executionEnabled: false,
    capabilitiesQualified: false,
  };
}

export async function inspectHobbyAccount(
  token: string,
  request: typeof fetch = fetch,
): Promise<ReturnType<typeof qualifyHobbyAccount>> {
  if (!token.trim()) throw Error("provider_token_required");
  async function read(path: string, scope: "team" | "project"): Promise<unknown> {
    const response = await request(`https://api.vercel.com${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    // Provider error bodies may contain private account/credential material.
    if (!response.ok) throw Error(`${scope}_read_http_${response.status}`);
    return response.json();
  }
  const project = await read(
    `/v9/projects/${hobbyTarget.projectId}?teamId=${hobbyTarget.teamId}`,
    "project",
  );
  const team = await read(`/v2/teams/${hobbyTarget.teamId}`, "team");
  return qualifyHobbyAccount(team, project);
}
