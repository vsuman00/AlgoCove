import { createHash } from "node:crypto";
import {
  authorizationError,
  conflictError,
  dependencyUnavailableError,
  notFoundError,
  validationError,
  createProblemContentDraft,
  reviewProblemContent,
  validateProblemContent,
  publishProblemVersion,
  retireProblemVersion,
  requireContentSeparation,
  requirePermission,
  type RequestContext,
} from "@algocove/application";
import {
  PostgresContentRepository,
  PostgresPlatformRepository,
  withTransaction,
} from "@algocove/db";
import {
  isContentRole,
  permissionsForRoles,
  parseId,
  parseContentChecksum,
  validateProblemManifest,
  normalizeLearnerText,
  ROLES,
  PROBLEM_LANGUAGES,
  PERMISSIONS,
  languageProfile,
  type ProblemContentVersion,
  type ProblemManifest,
  type Permission,
} from "@algocove/domain";
import { getPracticeRuntime } from "../practice/runtime";

export function contentRevision(content: ProblemContentVersion, manifest: ProblemManifest): string {
  return createHash("sha256").update(JSON.stringify({ content, manifest })).digest("hex");
}
function contentAccess(ctx: RequestContext): void {
  if (!ctx.actor.roles.some((role) => isContentRole(role) || role === ROLES.evaluator))
    throw authorizationError("Content operations require a content role.");
}
function pool() {
  const runtime = getPracticeRuntime();
  if (runtime === null) throw dependencyUnavailableError("Content persistence is unavailable.");
  return runtime.pool;
}
function versionId(value: unknown) {
  const id = parseId("contentVersion", value);
  if (!id.ok) throw validationError("A valid content version is required.");
  return id.value;
}
export async function readContent(
  ctx: RequestContext,
  id?: string,
): Promise<{
  records: {
    content: ProblemContentVersion;
    revision: string;
    manifest: ProblemManifest;
    manifestIssue: string | null;
  }[];
  permissions: readonly Permission[];
  actorId: string;
  references: readonly { title: string; provider: string; url: string; attribution: string }[];
}> {
  contentAccess(ctx);
  return withTransaction(pool(), async (tx) => {
    const repository = new PostgresContentRepository(tx);
    const contents =
      id === undefined ? await repository.list() : [await repository.get(versionId(id))];
    if (contents.some((content) => content === null))
      throw notFoundError("Content version is unavailable.");
    const records = [];
    for (const content of contents) {
      if (content === null) continue;
      const manifest = await repository.manifest(content.problemVersionId);
      const validation = validateProblemManifest(manifest);
      records.push({
        content,
        revision: contentRevision(content, manifest),
        manifest,
        manifestIssue: validation.ok ? null : validation.error.message,
      });
    }
    return {
      records,
      permissions: permissionsForRoles(ctx.actor.roles),
      actorId: ctx.actor.userId,
      references: await repository.externalReferences(),
    };
  });
}
export async function commandContent(
  ctx: RequestContext,
  body: Record<string, unknown>,
): Promise<Readonly<Record<string, unknown>>> {
  contentAccess(ctx);
  const command = body.command;
  if (!["create", "manifest", "review", "validate", "publish", "retire"].includes(String(command)))
    throw validationError("Choose a content operation.");
  if (
    typeof body.idempotencyKey !== "string" ||
    !/^[a-zA-Z0-9-]{16,100}$/.test(body.idempotencyKey)
  )
    throw validationError("A command identity is required.");
  const checksum = parseContentChecksum(
    `sha256:${createHash("sha256").update(JSON.stringify(body)).digest("hex")}`,
  );
  if (!checksum.ok) throw validationError("Invalid command checksum.");
  return withTransaction(pool(), async (tx) => {
    const platform = new PostgresPlatformRepository(tx);
    const claim = {
      scope: `content:${ctx.actor.userId}`,
      key: body.idempotencyKey as string,
      requestHash: checksum.value,
    };
    const claimed = await platform.claim(claim);
    if (claimed.kind === "replay") return claimed.response.body;
    if (claimed.kind !== "claimed")
      throw conflictError("This command is already pending or has different input.");
    const repository = new PostgresContentRepository(tx);
    let content: ProblemContentVersion;
    if (command === "create") {
      if (
        typeof body.title !== "string" ||
        typeof body.statement !== "string" ||
        typeof body.rightsHolder !== "string" ||
        typeof body.license !== "string"
      )
        throw validationError("Title, original statement, rights holder and license are required.");
      const title = normalizeLearnerText(body.title);
      const statement = normalizeLearnerText(body.statement);
      content = await createProblemContentDraft(ctx, repository, {
        title,
        statement,
        checksum: `sha256:${createHash("sha256").update(JSON.stringify({ title, statement })).digest("hex")}`,
        provenance: {
          kind: "original",
          rightsHolder: body.rightsHolder,
          license: body.license,
          sourceUrl: null,
          rightsExpiresAt: null,
        },
      });
    } else {
      const id = versionId(body.versionId);
      const current = await repository.get(id);
      if (current === null) throw notFoundError("Content version is unavailable.");
      if (
        body.expectedRevision !==
        contentRevision(current, await repository.manifest(current.problemVersionId))
      )
        throw conflictError("Content changed. Reload before recording a decision.");
      if (command === "manifest") {
        requirePermission(ctx, PERMISSIONS.contentAuthor);
        if (current.authorId !== ctx.actor.userId)
          throw authorizationError("Only the draft author may edit language contracts.");
        if (current.status !== "draft")
          throw conflictError("Published language contracts are immutable.");
        if (
          !Array.isArray(body.fixtures) ||
          body.fixtures.length < 1 ||
          body.fixtures.length > 100 ||
          typeof body.starters !== "object" ||
          body.starters === null ||
          Array.isArray(body.starters)
        )
          throw validationError("Semantic checks and six starter templates are required.");
        const fixtures = body.fixtures.map((candidate: unknown) => {
          if (typeof candidate !== "object" || candidate === null)
            throw validationError("Invalid semantic check.");
          const item = candidate as Record<string, unknown>;
          if (
            typeof item.fixtureId !== "string" ||
            !/^[a-z][a-z0-9_-]{1,80}$/.test(item.fixtureId) ||
            typeof item.semanticKey !== "string" ||
            item.semanticKey.trim().length < 1 ||
            item.semanticKey.length > 160
          )
            throw validationError("Semantic checks require bounded identities and descriptions.");
          return { fixtureId: item.fixtureId, semanticKey: item.semanticKey.trim() };
        });
        const starters = body.starters as Record<string, unknown>;
        const manifest: ProblemManifest = {
          problemVersionId: current.problemVersionId,
          fixtures,
          languages: PROBLEM_LANGUAGES.map((language) => {
            const starter = starters[language];
            if (typeof starter !== "string" || starter.trim().length < 1 || starter.length > 20000)
              throw validationError("Every language needs a bounded starter template.");
            const profile = languageProfile(language);
            return {
              language,
              starterTemplate: starter,
              entrySignature: profile.entrySignature,
              adapterId: profile.adapterId,
              limitsProfile: profile.limitsProfile,
              fixtureIds: fixtures.map((item) => item.fixtureId),
            };
          }),
        };
        const checked = validateProblemManifest(manifest);
        if (!checked.ok) throw validationError(checked.error.message);
        await repository.replaceManifest(
          manifest,
          manifest.languages.map(() => ctx.ids.generate("languageManifest")),
        );
        content = (await repository.get(id))!;
      } else if (command === "review") {
        if (
          (body.kind !== "technical" && body.kind !== "pedagogical") ||
          (body.decision !== "approved" && body.decision !== "rejected") ||
          (body.notes !== null && typeof body.notes !== "string")
        )
          throw validationError("A review kind, decision and bounded notes are required.");
        requireContentSeparation([
          { actorId: current.authorId, role: ROLES.author },
          ...current.reviews.map((review) => ({
            actorId: review.reviewerId,
            role: review.kind === "technical" ? ROLES.technicalReviewer : ROLES.pedagogicalReviewer,
          })),
          {
            actorId: ctx.actor.userId,
            role: body.kind === "technical" ? ROLES.technicalReviewer : ROLES.pedagogicalReviewer,
          },
        ]);
        content = await reviewProblemContent(ctx, repository, {
          versionId: id,
          review: {
            kind: body.kind,
            decision: body.decision,
            notes: body.notes as string | null,
            reviewerId: ctx.actor.userId,
            reviewedAt: ctx.now,
          },
        });
      } else if (command === "validate" || command === "publish") {
        const manifest = await repository.manifest(current.problemVersionId);
        const checked = validateProblemManifest(manifest);
        if (command === "validate") {
          content = await validateProblemContent(ctx, repository, {
            versionId: id,
            validation: {
              status: checked.ok ? "passed" : "failed",
              validatorId: ctx.actor.userId,
              validatedAt: ctx.now,
              message: checked.ok
                ? "Six-language metadata contract passed."
                : checked.error.message,
            },
          });
        } else {
          if (!checked.ok) throw validationError(checked.error.message);
          requireContentSeparation([
            { actorId: current.authorId, role: ROLES.author },
            ...current.reviews.map((review) => ({
              actorId: review.reviewerId,
              role:
                review.kind === "technical" ? ROLES.technicalReviewer : ROLES.pedagogicalReviewer,
            })),
            { actorId: ctx.actor.userId, role: ROLES.publisher },
          ]);
          content = await publishProblemVersion(ctx, repository, id);
        }
      } else {
        if (!["retired", "rights_withdrawn", "security_tombstone"].includes(String(body.reason)))
          throw validationError("Choose a retirement reason.");
        content = await retireProblemVersion(ctx, repository, {
          versionId: id,
          reason: body.reason as "retired" | "rights_withdrawn" | "security_tombstone",
        });
      }
    }
    const event = {
      actorId: ctx.actor.userId,
      action: `content.${command}`,
      resourceType: "content_version",
      resourceId: content.contentVersionId,
      payload: {
        status: content.status,
        checksum: content.checksum,
        revision: contentRevision(content, await repository.manifest(content.problemVersionId)),
        ...(command === "review" ? { reviewKind: body.kind, decision: body.decision } : {}),
        ...(command === "validate" ? { validationStatus: content.validation.status } : {}),
        ...(command === "retire" ? { reason: content.retirementReason } : {}),
      },
      occurredAt: ctx.now,
    };
    await platform.append({ ...event, eventId: ctx.ids.generate("event") });
    await platform.enqueue({
      eventId: ctx.ids.generate("event"),
      topic: `content.${command}`,
      aggregateId: content.contentVersionId,
      payload: { contentVersionId: content.contentVersionId, status: content.status },
      occurredAt: ctx.now,
    });
    const response = {
      content: { contentVersionId: content.contentVersionId, status: content.status },
      revision: contentRevision(content, await repository.manifest(content.problemVersionId)),
    };
    await platform.complete({ ...claim, response: { status: 200, body: response } });
    return response;
  });
}
