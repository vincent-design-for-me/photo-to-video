import test from "node:test";
import assert from "node:assert/strict";
import { buildLoginHref, canonicalizeAuthPath, isPublicPath } from "../lib/auth/paths";
import { getR2Config, isCloudMode, isD1Configured, isR2Configured } from "../lib/cloudflare/config";
import { D1HttpDatabase, normalizeD1Param } from "../lib/cloudflare/d1";
import { getStorageObjectKeyForPublicAsset, getStorageObjectKeyForWorkflowFile } from "../lib/jobs/publicAsset";

test("canonicalizeAuthPath normalizes legacy auth routes", () => {
  assert.equal(canonicalizeAuthPath("/auth/login"), "/login");
  assert.equal(canonicalizeAuthPath("/auth/signup"), "/signup");
  assert.equal(canonicalizeAuthPath("/auth/forgot-password"), "/forgot-password");
  assert.equal(canonicalizeAuthPath("/auth/reset-password"), "/reset-password");
  assert.equal(canonicalizeAuthPath("/jobs/123"), "/jobs/123");
});

test("isPublicPath allows canonical and compatibility auth routes", () => {
  assert.equal(isPublicPath("/login"), true);
  assert.equal(isPublicPath("/auth/login"), true);
  assert.equal(isPublicPath("/auth/callback"), true);
  assert.equal(isPublicPath("/"), true);
  assert.equal(isPublicPath("/jobs/123"), false);
});

test("buildLoginHref preserves a safe next path", () => {
  assert.equal(buildLoginHref("/jobs/123"), "/login?next=%2Fjobs%2F123");
  assert.equal(buildLoginHref("https://example.com/elsewhere"), "/login");
  assert.equal(buildLoginHref(""), "/login");
});

test("getStorageObjectKeyForWorkflowFile infers source and generated asset keys", () => {
  assert.equal(
    getStorageObjectKeyForWorkflowFile("job-123", "/tmp/job-123/source/source-1.jpg"),
    "job-123/source/source-1.jpg"
  );
  assert.equal(
    getStorageObjectKeyForWorkflowFile("job-123", "/tmp/job-123/generated/frame-1.png"),
    "job-123/generated/frame-1.png"
  );
  assert.equal(
    getStorageObjectKeyForWorkflowFile("job-123", "job-123/generated/frame-1.png"),
    "job-123/generated/frame-1.png"
  );
});

test("getStorageObjectKeyForPublicAsset matches stored source and frame assets by filename", () => {
  const sourceImages = [
    { path: "job-123/source/source-1.jpg" },
    { path: "job-123/source/source-2.jpg" }
  ];
  const generatedFrames = [
    "job-123/generated/frame-1.png",
    "job-123/generated/frame-2.png"
  ];

  assert.equal(
    getStorageObjectKeyForPublicAsset("source-2.jpg", sourceImages, generatedFrames),
    "job-123/source/source-2.jpg"
  );
  assert.equal(
    getStorageObjectKeyForPublicAsset("frame-1.png", sourceImages, generatedFrames),
    "job-123/generated/frame-1.png"
  );
  assert.equal(
    getStorageObjectKeyForPublicAsset("missing.png", sourceImages, generatedFrames),
    undefined
  );
});

test("Cloudflare D1 and R2 configuration helpers validate required env vars", () => {
  const fullEnv = {
    CLOUDFLARE_ACCOUNT_ID: "acc-123",
    CLOUDFLARE_D1_DATABASE_ID: "db-456",
    CLOUDFLARE_API_TOKEN: "tok-789",
    R2_ACCESS_KEY_ID: "r2-key",
    R2_SECRET_ACCESS_KEY: "r2-secret",
    R2_BUCKET_NAME: "photo-to-video-assets",
  };
  assert.equal(isD1Configured(fullEnv), true);
  assert.equal(isR2Configured(fullEnv), true);
  assert.equal(isCloudMode(fullEnv), true);
  assert.equal(getR2Config(fullEnv).endpoint, "https://acc-123.r2.cloudflarestorage.com");

  const partialEnv = { CLOUDFLARE_ACCOUNT_ID: "acc-123" };
  assert.equal(isD1Configured(partialEnv), false);
  assert.equal(isR2Configured(partialEnv), false);
  assert.equal(isCloudMode(partialEnv), false);
});

test("D1HttpDatabase executes parameterized SQL over Cloudflare REST API", async () => {
  let seenUrl = "";
  let seenBody: { sql: string; params: unknown[] } | null = null;

  const mockFetch: typeof fetch = async (input, init) => {
    seenUrl = String(input);
    seenBody = JSON.parse(String(init?.body)) as { sql: string; params: unknown[] };
    return new Response(
      JSON.stringify({
        success: true,
        result: [
          {
            success: true,
            results: [{ id: "u1", email: "a@example.com" }],
            meta: { changes: 1, last_row_id: 1 },
          },
        ],
      }),
      { status: 200 }
    );
  };

  const db = new D1HttpDatabase(
    { accountId: "acc1", databaseId: "db1", apiToken: "secret-tok" },
    { fetchImpl: mockFetch }
  );

  // Duck-type check expected by Better Auth's D1SqliteDialect
  assert.equal(typeof db.prepare, "function");
  assert.equal(typeof db.batch, "function");
  assert.equal(typeof db.exec, "function");

  const now = new Date("2026-11-23T12:00:00.000Z");
  const row = await db
    .prepare("SELECT id, email FROM user WHERE createdAt <= ? AND emailVerified = ?")
    .bind(now, true)
    .first<{ id: string; email: string }>();

  assert.equal(seenUrl, "https://api.cloudflare.com/client/v4/accounts/acc1/d1/database/db1/query");
  assert.deepEqual(seenBody, {
    sql: "SELECT id, email FROM user WHERE createdAt <= ? AND emailVerified = ?",
    params: ["2026-11-23T12:00:00.000Z", 1],
  });
  assert.deepEqual(row, { id: "u1", email: "a@example.com" });
  assert.equal(normalizeD1Param(undefined), null);
  assert.equal(normalizeD1Param(false), 0);
});
