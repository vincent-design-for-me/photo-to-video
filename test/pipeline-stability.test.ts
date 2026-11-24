import test from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import nextConfig from "../next.config";
import { fetchWithRetry, runWithConcurrency } from "../lib/http/fetchWithRetry";
import { pollKlingTask } from "../lib/providers/kling";
import { hasActiveFrameRegeneration, isJobRunningStale, isTimestampStale } from "../lib/jobs/stale";
import {
  claimFrameRegeneration,
  claimJobExecution,
  createJob,
  getJob,
  mutateJob,
} from "../lib/jobs/store.local";

const noSleep = async () => {};

test("nextConfig includes ffmpeg-static in serverExternalPackages for Serverless bundling", () => {
  assert.ok(
    nextConfig.serverExternalPackages?.includes("ffmpeg-static"),
    "expected ffmpeg-static in serverExternalPackages"
  );
});

test("fetchWithRetry retries transient HTTP statuses and network errors then succeeds", async () => {
  let calls = 0;
  const mockFetch: typeof fetch = async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("fetch failed");
    if (calls === 2) return new Response("busy", { status: 503 });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const res = await fetchWithRetry(
    "https://example.test/api",
    { method: "POST" },
    { maxAttempts: 4, baseDelayMs: 1, fetchImpl: mockFetch, sleepImpl: noSleep, label: "test" }
  );

  assert.equal(res.status, 200);
  assert.equal(calls, 3);
});

test("fetchWithRetry does not retry non-retryable 400 errors", async () => {
  let calls = 0;
  const mockFetch: typeof fetch = async () => {
    calls += 1;
    return new Response("bad request", { status: 400 });
  };

  const res = await fetchWithRetry(
    "https://example.test/api",
    {},
    { maxAttempts: 3, baseDelayMs: 1, fetchImpl: mockFetch, sleepImpl: noSleep }
  );

  assert.equal(res.status, 400);
  assert.equal(calls, 1);
});

test("runWithConcurrency caps active workers and preserves item order", async () => {
  let active = 0;
  let maxActive = 0;

  const results = await runWithConcurrency([10, 20, 30, 40, 50], 2, async (item, index) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((r) => setTimeout(r, (5 - index) * 5));
    active -= 1;
    return item * 2;
  });

  assert.deepEqual(results, [20, 40, 60, 80, 100]);
  assert.ok(maxActive <= 2, `expected maxActive <= 2, got ${maxActive}`);
});

test("pollKlingTask tolerates transient 502/network errors and refreshes dynamic authorization", async () => {
  let pollCount = 0;
  const seenAuthHeaders: string[] = [];

  const mockFetch: typeof fetch = async (_input, init) => {
    pollCount += 1;
    const auth = (init?.headers as Record<string, string>)?.Authorization ?? "";
    seenAuthHeaders.push(auth);

    if (pollCount === 1) return new Response("bad gateway", { status: 502 });
    if (pollCount === 2) throw new TypeError("socket hang up");
    if (pollCount === 3) {
      return new Response(JSON.stringify({ data: { task_status: "processing" } }), { status: 200 });
    }
    return new Response(
      JSON.stringify({
        data: {
          task_status: "succeed",
          task_result: { videos: [{ url: "https://cdn.example/video.mp4" }] },
        },
      }),
      { status: 200 }
    );
  };

  let tokenSeq = 0;
  const url = await pollKlingTask(
    "https://kling.example",
    "task-123",
    () => `Bearer jwt-${++tokenSeq}`,
    { attempts: 10, intervalMs: 1, maxConsecutiveErrors: 3, fetchImpl: mockFetch, sleepImpl: noSleep }
  );

  assert.equal(url, "https://cdn.example/video.mp4");
  assert.equal(pollCount, 4);
  assert.deepEqual(seenAuthHeaders, [
    "Bearer jwt-1",
    "Bearer jwt-2",
    "Bearer jwt-3",
    "Bearer jwt-4",
  ]);
});

test("pollKlingTask fails fast when Kling reports task_status=failed", async () => {
  const mockFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({ data: { task_status: "failed", task_status_msg: "content policy" } }),
      { status: 200 }
    );

  await assert.rejects(
    () =>
      pollKlingTask("https://kling.example", "task-fail", "Bearer tok", {
        attempts: 5,
        intervalMs: 1,
        fetchImpl: mockFetch,
        sleepImpl: noSleep,
      }),
    /content policy/
  );
});

test("stale helpers detect orphaned running jobs and active frame regenerations", () => {
  const now = Date.parse("2026-11-23T12:00:00.000Z");
  const recent = "2026-11-23T11:58:00.000Z";
  const old = "2026-11-23T11:40:00.000Z";

  assert.equal(isTimestampStale(recent, 5 * 60_000, now), false);
  assert.equal(isTimestampStale(old, 5 * 60_000, now), true);

  assert.equal(isJobRunningStale({ status: "running", updatedAt: recent }, 10 * 60_000, now), false);
  assert.equal(isJobRunningStale({ status: "running", updatedAt: old }, 10 * 60_000, now), true);
  assert.equal(isJobRunningStale({ status: "awaiting_review", updatedAt: old }, 10 * 60_000, now), false);

  assert.equal(
    hasActiveFrameRegeneration(
      {
        steps: [
          { id: "image-0", kind: "image", index: 0, label: "f0", status: "running", updatedAt: recent },
        ],
      },
      5 * 60_000,
      now
    ),
    true
  );
  assert.equal(
    hasActiveFrameRegeneration(
      {
        steps: [
          { id: "image-0", kind: "image", index: 0, label: "f0", status: "running", updatedAt: old },
        ],
      },
      5 * 60_000,
      now
    ),
    false
  );
});

test("atomic job claim prevents double-run, reclaims stale runs, and keeps concurrent frame regens isolated", async () => {
  const jobId = `test-stability-${randomUUID()}`;
  const jobDir = path.join(process.cwd(), ".data", "jobs", jobId);

  try {
    await createJob(
      [
        { name: "a.jpg", path: "/tmp/a.jpg", size: 100, type: "image/jpeg" },
        { name: "b.jpg", path: "/tmp/b.jpg", size: 100, type: "image/jpeg" },
      ],
      jobId
    );

    // Concurrent claims on a queued job: exactly one wins.
    const [first, second] = await Promise.all([
      claimJobExecution(jobId, { allowedStatuses: ["queued", "failed"], allowStaleRunning: true }),
      claimJobExecution(jobId, { allowedStatuses: ["queued", "failed"], allowStaleRunning: true }),
    ]);
    assert.equal(Number(first.claimed) + Number(second.claimed), 1);

    // Stale running job can be reclaimed.
    const reclaimed = await claimJobExecution(jobId, {
      allowedStatuses: ["queued", "failed"],
      allowStaleRunning: true,
      staleAfterMs: 0,
    });
    assert.equal(reclaimed.claimed, true);

    // Transition to awaiting_review with completed frames.
    await mutateJob(jobId, (job) => ({
      status: "awaiting_review",
      generatedFrames: ["/tmp/f1.png", "/tmp/f2.png"],
      framePrompts: ["prompt 0", "prompt 1"],
      steps: job.steps.map((s) => (s.kind === "image" ? { ...s, status: "complete" } : s)),
    }));

    // Concurrent regenerations on DIFFERENT frames both succeed without clobbering each other.
    const [regen0, regen1, dupRegen0] = await Promise.all([
      claimFrameRegeneration(jobId, 0, "brighter lighting"),
      claimFrameRegeneration(jobId, 1, "blue rug"),
      claimFrameRegeneration(jobId, 0, "duplicate click"),
    ]);

    assert.equal(regen0.claimed, true);
    assert.equal(regen1.claimed, true);
    assert.equal(dupRegen0.claimed, false);

    // Approve is blocked while any frame regeneration is active.
    const blockedApprove = await claimJobExecution(jobId, {
      allowedStatuses: ["awaiting_review"],
      requireNoActiveFrameRegen: true,
    });
    assert.equal(blockedApprove.claimed, false);
    assert.match(blockedApprove.reason ?? "", /still regenerating/i);

    const latest = await getJob(jobId);
    assert.ok(latest);
    assert.match(latest.framePrompts?.[0] ?? "", /brighter lighting/);
    assert.match(latest.framePrompts?.[1] ?? "", /blue rug/);
    assert.equal(latest.steps.find((s) => s.id === "image-0")?.status, "running");
    assert.equal(latest.steps.find((s) => s.id === "image-1")?.status, "running");

    // Partial mutation on frameJudgements does NOT clobber concurrent status transitions.
    await mutateJob(jobId, () => ({ status: "running" }));
    await mutateJob(jobId, () => ({ frameJudgements: [null, null] }));
    const afterJudge = await getJob(jobId);
    assert.equal(afterJudge?.status, "running");
  } finally {
    await rm(jobDir, { recursive: true, force: true });
  }
});
