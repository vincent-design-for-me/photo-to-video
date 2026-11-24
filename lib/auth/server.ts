import { mkdirSync } from "node:fs";
import path from "node:path";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { isD1Configured } from "../cloudflare/config";
import { getD1Database } from "../cloudflare/d1";

const DEFAULT_TRUSTED_ORIGINS = [
  "https://photo-to-video-brown.vercel.app",
  "https://photo-to-video-vincent-design-for-mes-projects.vercel.app",
  "https://photo-to-video-git-main-vincent-design-for-mes-projects.vercel.app",
];

function resolveBaseURL(): string {
  const configured = process.env.BETTER_AUTH_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return vercelUrl.startsWith("http") ? vercelUrl.replace(/\/$/, "") : `https://${vercelUrl}`;
  }
  return "http://localhost:3000";
}

function resolveTrustedOrigins(): string[] {
  const origins = new Set<string>(DEFAULT_TRUSTED_ORIGINS);
  const envOrigins = [
    process.env.BETTER_AUTH_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : undefined,
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") ?? []),
  ];
  for (const raw of envOrigins) {
    const trimmed = raw?.trim().replace(/\/$/, "");
    if (trimmed) origins.add(trimmed);
  }
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }
  return [...origins];
}

function resolveAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET must be configured in production (32+ random characters).");
  }
  return "dev-only-better-auth-secret-do-not-use-in-production-0123456789";
}

function createLocalSqliteFallback() {
  // Uses Node's built-in node:sqlite (Node 22.5+/24) for zero-dependency local offline dev/tests.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require("node:sqlite") as {
    DatabaseSync: new (filename: string) => { exec(sql: string): void };
  };
  const dataDir = path.join(process.cwd(), ".data");
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, "auth.sqlite"));
  db.exec(`
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
    CREATE TABLE IF NOT EXISTS "verification" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "identifier" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "expiresAt" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "rateLimit" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "key" TEXT NOT NULL UNIQUE,
      "count" INTEGER NOT NULL,
      "lastRequest" INTEGER NOT NULL
    );
  `);
  return db;
}

async function sendResetPasswordEmail(userEmail: string, resetUrl: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || "Photo to Video <onboarding@resend.dev>";

  if (!resendKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[auth] Password reset link for ${userEmail}: ${resetUrl}`);
      return;
    }
    console.warn(`[auth] RESEND_API_KEY is not set; cannot send password reset email to ${userEmail}.`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [userEmail],
      subject: "Reset your Photo to Video password",
      html: `<p>Click the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, you can safely ignore this email.</p>`,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[auth] Failed to send password reset email (${response.status}): ${body.slice(0, 300)}`);
  }
}

function buildAuthInstance() {
  const database = isD1Configured() ? getD1Database() : createLocalSqliteFallback();

  return betterAuth({
    // Better Auth's built-in D1SqliteDialect auto-detects `{ prepare, batch, exec }`.
    database: database as unknown as Parameters<typeof betterAuth>[0]["database"],
    secret: resolveAuthSecret(),
    baseURL: resolveBaseURL(),
    trustedOrigins: resolveTrustedOrigins(),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
      requireEmailVerification: false,
      async sendResetPassword({ user, url }) {
        await sendResetPasswordEmail(user.email, url);
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
    },
    // Minimal surface area: only nextCookies (no cookieCache / SSO / org plugins).
    plugins: [nextCookies()],
  });
}

type AuthInstance = ReturnType<typeof buildAuthInstance>;

let cachedAuth: AuthInstance | null = null;

export function getAuth(): AuthInstance {
  if (!cachedAuth) {
    cachedAuth = buildAuthInstance();
  }
  return cachedAuth;
}
