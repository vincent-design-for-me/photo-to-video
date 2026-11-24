-- Cloudflare D1 (SQLite) schema for Photo-to-Video + Better Auth core tables.
-- Applied via: npx wrangler d1 execute photo-to-video --remote --file=cloudflare/migrations/0001_init.sql

-- ── Better Auth core tables (v1.7.x SQLite schema) ───────────────────────────

CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" INTEGER NOT NULL DEFAULT 0,
  "image" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "expiresAt" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_session_userId" ON "session"("userId");

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TEXT,
  "refreshTokenExpiresAt" TEXT,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_account_userId" ON "account"("userId");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_verification_identifier" ON "verification"("identifier");

CREATE TABLE IF NOT EXISTS "rateLimit" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "key" TEXT NOT NULL UNIQUE,
  "count" INTEGER NOT NULL,
  "lastRequest" INTEGER NOT NULL
);

-- ── Application jobs table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "jobs" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "config" TEXT NOT NULL DEFAULT '{}',
  "source_images" TEXT NOT NULL DEFAULT '[]',
  "generated_frames" TEXT NOT NULL DEFAULT '[]',
  "frame_judgements" TEXT,
  "review_decisions" TEXT,
  "frame_prompts" TEXT,
  "user_edit_requests" TEXT,
  "generated_clips" TEXT NOT NULL DEFAULT '[]',
  "final_video_path" TEXT,
  "error" TEXT,
  "steps" TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS "idx_jobs_user_created" ON "jobs"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_jobs_status_updated" ON "jobs"("status", "updated_at");
