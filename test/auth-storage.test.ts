import test from "node:test";
import assert from "node:assert/strict";
import { buildLoginHref, canonicalizeAuthPath, isPublicPath } from "../lib/auth/paths";
import { getStorageObjectKeyForPublicAsset, getStorageObjectKeyForWorkflowFile } from "../lib/jobs/publicAsset";
import { isStorageRlsError, storagePolicySql } from "../lib/jobs/storage";
import { getSupabaseKeyRole, isSupabaseServiceRoleConfigured } from "../lib/supabase";

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

test("isStorageRlsError recognizes Supabase storage policy failures", () => {
  assert.equal(isStorageRlsError("new row violates row-level security policy"), true);
  assert.equal(isStorageRlsError("Storage upload failed: new row violates row-level security policy"), true);
  assert.equal(isStorageRlsError("permission denied for table objects"), false);
});

test("storagePolicySql allows authenticated users and service_role for job-assets bucket", () => {
  assert.match(storagePolicySql, /bucket_id = 'job-assets'/);
  assert.match(storagePolicySql, /auth\.uid\(\) is not null/);
  assert.match(storagePolicySql, /auth\.role\(\) = 'service_role'/);
});

test("getSupabaseKeyRole reads the role claim from Supabase JWTs", () => {
  const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.signature";
  const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature";

  assert.equal(getSupabaseKeyRole(anonKey), "anon");
  assert.equal(getSupabaseKeyRole(serviceRoleKey), "service_role");
  assert.equal(getSupabaseKeyRole("not-a-jwt"), undefined);
});

test("isSupabaseServiceRoleConfigured requires a real service_role JWT", () => {
  const env = {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature"
  };
  const badEnv = {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.signature"
  };

  assert.equal(isSupabaseServiceRoleConfigured(env), true);
  assert.equal(isSupabaseServiceRoleConfigured(badEnv), false);
});

test("isSupabaseServiceRoleConfigured accepts process.env-style optional keys", () => {
  const env: NodeJS.ProcessEnv = {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature"
  };

  assert.equal(isSupabaseServiceRoleConfigured(env), true);
});
