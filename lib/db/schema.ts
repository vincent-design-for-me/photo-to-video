import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { WorkflowConfig } from "../jobs/workflow";
import type {
  JobAsset,
  JobStatus,
  JobStep,
  ReviewDecision,
  StoredFrameJudgement,
} from "../jobs/types";

// ── Better Auth core tables (v1.7.x SQLite schema) ───────────────────────────

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified").notNull().default(0),
  image: text("image"),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: text("expiresAt").notNull(),
    token: text("token").notNull().unique(),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("idx_session_userId").on(table.userId)]
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: text("accessTokenExpiresAt"),
    refreshTokenExpiresAt: text("refreshTokenExpiresAt"),
    scope: text("scope"),
    password: text("password"),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
  },
  (table) => [index("idx_account_userId").on(table.userId)]
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: text("expiresAt").notNull(),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
  },
  (table) => [index("idx_verification_identifier").on(table.identifier)]
);

export const rateLimit = sqliteTable("rateLimit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: integer("lastRequest").notNull(),
});

// ── Application tables ───────────────────────────────────────────────────────

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    status: text("status").$type<JobStatus>().notNull().default("queued"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    config: text("config", { mode: "json" }).$type<WorkflowConfig>().notNull(),
    sourceImages: text("source_images", { mode: "json" }).$type<JobAsset[]>().notNull(),
    generatedFrames: text("generated_frames", { mode: "json" }).$type<string[]>().notNull(),
    frameJudgements: text("frame_judgements", { mode: "json" }).$type<
      (StoredFrameJudgement | null)[] | null
    >(),
    reviewDecisions: text("review_decisions", { mode: "json" }).$type<ReviewDecision[] | null>(),
    framePrompts: text("frame_prompts", { mode: "json" }).$type<string[] | null>(),
    userEditRequests: text("user_edit_requests", { mode: "json" }).$type<string[] | null>(),
    generatedClips: text("generated_clips", { mode: "json" }).$type<string[]>().notNull(),
    finalVideoPath: text("final_video_path"),
    error: text("error"),
    steps: text("steps", { mode: "json" }).$type<JobStep[]>().notNull(),
  },
  (table) => [
    index("idx_jobs_user_created").on(table.userId, table.createdAt),
    index("idx_jobs_status_updated").on(table.status, table.updatedAt),
  ]
);

export type JobRow = typeof jobs.$inferSelect;
export type NewJobRow = typeof jobs.$inferInsert;

export const schema = {
  user,
  session,
  account,
  verification,
  rateLimit,
  jobs,
};
