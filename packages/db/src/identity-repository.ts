import { createHash } from "node:crypto";
import {
  formatId,
  parseId,
  parseInstant,
  parseLearnerProfileInput,
  parseRole,
  ROLES,
  type LearnerId,
  type LearnerProfile,
  type Role,
} from "@algocove/domain";
import type { QueryResultRow } from "pg";
import type { Queryable } from "./connection.ts";

type LearnerRow = QueryResultRow & { learner_id: string };
type ProfileRow = QueryResultRow & {
  learner_id: string;
  goal: string;
  target_role: string;
  timezone: string;
  daily_capacity_minutes: number;
  horizon_days: number;
  accessibility_settings: unknown;
  preferred_languages: string[];
  version: string | number;
  created_at: Date | string;
  updated_at: Date | string;
  updated_by: string;
};

function learnerIdForSubject(providerSubject: string): LearnerId {
  const entropy = createHash("sha256").update(providerSubject, "utf8").digest("hex").slice(0, 40);
  const result = formatId("learner", entropy);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function databaseInstant(value: Date | string) {
  const parsed = parseInstant(value instanceof Date ? value : new Date(value));
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.value;
}

function profileFromRow(row: ProfileRow): LearnerProfile {
  const learnerId = parseId("learner", row.learner_id);
  const updatedBy = parseId("learner", row.updated_by);
  const input = parseLearnerProfileInput({
    goal: row.goal,
    targetRole: row.target_role,
    timezone: row.timezone,
    dailyCapacityMinutes: row.daily_capacity_minutes,
    horizonDays: row.horizon_days,
    accessibility: row.accessibility_settings,
    preferredLanguages: row.preferred_languages,
  });
  if (!learnerId.ok || !updatedBy.ok || !input.ok) {
    throw new Error("Database learner profile violates the domain contract.");
  }
  return {
    ...input.value,
    learnerId: learnerId.value,
    version: Number(row.version),
    createdAt: databaseInstant(row.created_at),
    updatedAt: databaseInstant(row.updated_at),
    updatedBy: updatedBy.value,
  };
}

/** Database-backed Clerk subject mapping, roles, and learner profile store. */
export class PostgresIdentityRepository {
  private readonly database: Queryable;

  constructor(database: Queryable) {
    this.database = database;
  }

  async findOrCreateLearner(providerSubject: string): Promise<LearnerId> {
    const existing = await this.database.query<LearnerRow>(
      `SELECT learner_id FROM platform.identity_account
        WHERE provider = 'clerk' AND provider_subject = $1`,
      [providerSubject],
    );
    const existingId = existing.rows[0]?.learner_id;
    if (existingId !== undefined) return this.parseLearnerId(existingId);

    const learnerId = learnerIdForSubject(providerSubject);
    await this.database.query(
      `INSERT INTO platform.learner (learner_id) VALUES ($1)
       ON CONFLICT DO NOTHING RETURNING learner_id`,
      [learnerId],
    );
    await this.database.query(
      `INSERT INTO platform.identity_account (provider, provider_subject, learner_id)
       VALUES ('clerk', $1, $2) ON CONFLICT DO NOTHING`,
      [providerSubject, learnerId],
    );
    const mapped = await this.database.query<LearnerRow>(
      `SELECT learner_id FROM platform.identity_account
        WHERE provider = 'clerk' AND provider_subject = $1`,
      [providerSubject],
    );
    const mappedId = mapped.rows[0]?.learner_id;
    if (mappedId === undefined) throw new Error("Unable to persist Clerk identity mapping.");
    await this.database.query(
      `INSERT INTO platform.role_grant (learner_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [mappedId, ROLES.learner],
    );
    return this.parseLearnerId(mappedId);
  }

  async getRoles(learnerId: LearnerId): Promise<readonly Role[]> {
    const result = await this.database.query<{ role: string }>(
      `SELECT role FROM platform.role_grant
        WHERE learner_id = $1 AND revoked_at IS NULL ORDER BY role`,
      [learnerId],
    );
    return result.rows.map((row) => {
      const role = parseRole(row.role);
      if (!role.ok) throw new Error("Database role grant violates the domain contract.");
      return role.value;
    });
  }

  async get(learnerId: LearnerId): Promise<LearnerProfile | null> {
    const result = await this.database.query<ProfileRow>(
      `SELECT learner_id, goal, target_role, timezone, daily_capacity_minutes,
              horizon_days, accessibility_settings, preferred_languages, version,
              created_at, updated_at, updated_by
         FROM platform.learner_profile WHERE learner_id = $1`,
      [learnerId],
    );
    const row = result.rows[0];
    return row === undefined ? null : profileFromRow(row);
  }

  async create(profile: LearnerProfile): Promise<LearnerProfile> {
    await this.database.query(
      `INSERT INTO platform.learner (learner_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [profile.learnerId],
    );
    const result = await this.database.query<ProfileRow>(
      `INSERT INTO platform.learner_profile
         (learner_id, goal, target_role, timezone, daily_capacity_minutes,
          horizon_days, accessibility_settings, preferred_languages, version, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, 1, $9)
       RETURNING learner_id, goal, target_role, timezone, daily_capacity_minutes,
                 horizon_days, accessibility_settings, preferred_languages, version,
                 created_at, updated_at, updated_by`,
      [
        profile.learnerId,
        profile.goal,
        profile.targetRole,
        profile.timezone,
        profile.dailyCapacityMinutes,
        profile.horizonDays,
        JSON.stringify(profile.accessibility),
        profile.preferredLanguages,
        profile.updatedBy,
      ],
    );
    const row = result.rows[0];
    if (row === undefined) throw new Error("Database did not return the created learner profile.");
    return profileFromRow(row);
  }

  async update(input: {
    readonly learnerId: LearnerId;
    readonly expectedVersion: number;
    readonly profile: LearnerProfile;
  }): Promise<LearnerProfile | null> {
    const result = await this.database.query<ProfileRow>(
      `UPDATE platform.learner_profile
          SET goal = $2, target_role = $3, timezone = $4,
              daily_capacity_minutes = $5, horizon_days = $6,
              accessibility_settings = $7::jsonb, preferred_languages = $8,
              version = version + 1, updated_by = $9
        WHERE learner_id = $1 AND version = $10
       RETURNING learner_id, goal, target_role, timezone, daily_capacity_minutes,
                 horizon_days, accessibility_settings, preferred_languages, version,
                 created_at, updated_at, updated_by`,
      [
        input.learnerId,
        input.profile.goal,
        input.profile.targetRole,
        input.profile.timezone,
        input.profile.dailyCapacityMinutes,
        input.profile.horizonDays,
        JSON.stringify(input.profile.accessibility),
        input.profile.preferredLanguages,
        input.profile.updatedBy,
        input.expectedVersion,
      ],
    );
    const row = result.rows[0];
    return row === undefined ? null : profileFromRow(row);
  }

  private parseLearnerId(value: string): LearnerId {
    const parsed = parseId("learner", value);
    if (!parsed.ok) throw new Error("Database learner identity violates the domain contract.");
    return parsed.value;
  }
}
