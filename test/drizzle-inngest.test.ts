import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, desc, eq } from "drizzle-orm";
import { D1HttpDatabase } from "../lib/cloudflare/d1";
import { createDrizzleD1, jobs, type NewJobRow } from "../lib/db";
import { isInngestConfigured } from "../lib/inngest/client";
import {
  jobFrameRegenerateRequested,
  jobImagesRequested,
  jobVideoRequested,
} from "../lib/inngest/events";
import { inngestFunctions } from "../lib/inngest/functions";
import { DEFAULT_WORKFLOW_CONFIG } from "../lib/jobs/config";
import { rowToJob } from "../lib/jobs/store.d1";

/**
 * In-memory mock of Cloudflare D1 REST API (`/query` and `/raw`) backed by Node's
 * built-in `node:sqlite`, proving Drizzle ORM queries + `D1HttpDatabase` work end-to-end.
 */
async function createSqliteBackedD1Fetch() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require("node:sqlite") as {
    DatabaseSync: new (filename: string) => {
      exec(sql: string): void;
      prepare(sql: string): {
        all(...params: unknown[]): Record<string, unknown>[];
        run(...params: unknown[]): { changes: number; lastInsertRowid: number };
      };
    };
  };

  const sqlite = new DatabaseSync(":memory:");
  const migrationSql = await readFile(
    path.join(process.cwd(), "cloudflare", "migrations", "0001_init.sql"),
    "utf8"
  );
  sqlite.exec(migrationSql);

  const mockFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body)) as { sql: string; params: unknown[] };
    const stmt = sqlite.prepare(body.sql);
    const isSelectOrReturning = /^\s*select\b/i.test(body.sql) || /\breturning\b/i.test(body.sql);

    if (url.endsWith("/raw")) {
      const records = isSelectOrReturning ? stmt.all(...body.params) : [];
      if (!isSelectOrReturning) stmt.run(...body.params);
      const columns = records.length > 0 ? Object.keys(records[0]) : [];
      const rows = records.map((rec) => columns.map((col) => rec[col]));
      return new Response(
        JSON.stringify({
          success: true,
          result: [{ success: true, results: { columns, rows }, meta: {} }],
        }),
        { status: 200 }
      );
    }

    if (isSelectOrReturning) {
      const results = stmt.all(...body.params);
      return new Response(
        JSON.stringify({
          success: true,
          result: [{ success: true, results, meta: {} }],
        }),
        { status: 200 }
      );
    }

    const meta = stmt.run(...body.params);
    return new Response(
      JSON.stringify({
        success: true,
        result: [
          {
            success: true,
            results: [],
            meta: { changes: meta.changes, last_row_id: Number(meta.lastInsertRowid) },
          },
        ],
      }),
      { status: 200 }
    );
  };

  return { sqlite, mockFetch };
}

test("D1HttpDatabase.raw() hits /raw endpoint and honors columnNames option", async () => {
  let seenUrl = "";
  const mockFetch: typeof fetch = async (input) => {
    seenUrl = String(input);
    return new Response(
      JSON.stringify({
        success: true,
        result: [
          {
            success: true,
            results: {
              columns: ["id", "status"],
              rows: [["job-1", "queued"]],
            },
            meta: {},
          },
        ],
      }),
      { status: 200 }
    );
  };

  const d1 = new D1HttpDatabase(
    { accountId: "acc", databaseId: "db", apiToken: "tok" },
    { fetchImpl: mockFetch }
  );

  const rowsOnly = await d1.prepare("SELECT id, status FROM jobs").raw();
  assert.equal(seenUrl, "https://api.cloudflare.com/client/v4/accounts/acc/d1/database/db/raw");
  assert.deepEqual(rowsOnly, [["job-1", "queued"]]);

  const withCols = await d1.prepare("SELECT id, status FROM jobs").raw({ columnNames: true });
  assert.deepEqual(withCols, [
    ["id", "status"],
    ["job-1", "queued"],
  ]);
});

test("Drizzle ORM works end-to-end over D1HttpDatabase with JSON columns and CAS updates", async () => {
  const { mockFetch } = await createSqliteBackedD1Fetch();
  const d1 = new D1HttpDatabase(
    { accountId: "acc", databaseId: "db", apiToken: "tok" },
    { fetchImpl: mockFetch }
  );
  const db = createDrizzleD1(d1);

  const newRow: NewJobRow = {
    id: "job-drizzle-1",
    userId: null,
    status: "queued",
    createdAt: "2026-11-24T10:00:00.000Z",
    updatedAt: "2026-11-24T10:00:00.000Z",
    config: DEFAULT_WORKFLOW_CONFIG,
    sourceImages: [{ name: "room.jpg", path: "job-drizzle-1/source/room.jpg", size: 1234, type: "image/jpeg" }],
    generatedFrames: [],
    frameJudgements: null,
    reviewDecisions: null,
    framePrompts: null,
    userEditRequests: ["Add warm pendant lighting"],
    generatedClips: [],
    finalVideoPath: null,
    error: null,
    steps: [
      { id: "prompt-0", kind: "prompt", index: 0, label: "Prompt 1", status: "queued" },
      { id: "image-0", kind: "image", index: 0, label: "Image 1", status: "queued" },
    ],
  };

  await db.insert(jobs).values(newRow).run();

  const fetched = await db.select().from(jobs).where(eq(jobs.id, "job-drizzle-1")).limit(1).get();
  assert.ok(fetched);
  assert.equal(fetched.status, "queued");
  assert.deepEqual(fetched.sourceImages, newRow.sourceImages);
  assert.deepEqual(fetched.userEditRequests, ["Add warm pendant lighting"]);
  assert.equal(fetched.config.styleId, DEFAULT_WORKFLOW_CONFIG.styleId);

  // Optimistic CAS update succeeds when updatedAt matches
  const updated = await db
    .update(jobs)
    .set({
      status: "running",
      updatedAt: "2026-11-24T10:00:01.000Z",
      generatedFrames: ["job-drizzle-1/generated/frame-1.png"],
    })
    .where(and(eq(jobs.id, "job-drizzle-1"), eq(jobs.updatedAt, "2026-11-24T10:00:00.000Z")))
    .returning()
    .all();

  assert.equal(updated.length, 1);
  assert.equal(updated[0].status, "running");
  assert.deepEqual(updated[0].generatedFrames, ["job-drizzle-1/generated/frame-1.png"]);

  // Stale CAS update returns 0 rows
  const staleAttempt = await db
    .update(jobs)
    .set({ status: "failed", updatedAt: "2026-11-24T10:00:02.000Z" })
    .where(and(eq(jobs.id, "job-drizzle-1"), eq(jobs.updatedAt, "2026-11-24T10:00:00.000Z")))
    .returning()
    .all();
  assert.equal(staleAttempt.length, 0);

  // Verify rowToJob hydration + desc ordering
  const listed = await db.select().from(jobs).orderBy(desc(jobs.createdAt)).all();
  assert.equal(listed.length, 1);
  const hydrated = rowToJob(listed[0]);
  assert.equal(hydrated.id, "job-drizzle-1");
  assert.equal(hydrated.status, "running");
  assert.deepEqual(hydrated.generatedFrames, ["job-drizzle-1/generated/frame-1.png"]);
});

test("isInngestConfigured detects cloud event key and local dev server flags", () => {
  assert.equal(isInngestConfigured({}), false);
  assert.equal(isInngestConfigured({ INNGEST_DEV: "0" }), false);
  assert.equal(isInngestConfigured({ INNGEST_DEV: "false" }), false);
  assert.equal(isInngestConfigured({ INNGEST_DEV: "1" }), true);
  assert.equal(isInngestConfigured({ INNGEST_DEV: "http://127.0.0.1:8288" }), true);
  assert.equal(isInngestConfigured({ INNGEST_EVENT_KEY: "evt_test_123" }), true);
});

test("Inngest durable functions and typed events are registered", () => {
  assert.equal(inngestFunctions.length, 3);
  const ids = inngestFunctions.map((fn) => fn.id());
  assert.deepEqual(ids, [
    "job-image-phase",
    "job-video-phase",
    "job-regenerate-frame",
  ]);

  const imgEvt = jobImagesRequested.create({ jobId: "j1", userId: "u1" });
  assert.equal(imgEvt.name, "job/images.requested");
  assert.deepEqual(imgEvt.data, { jobId: "j1", userId: "u1" });

  const vidEvt = jobVideoRequested.create({ jobId: "j2" });
  assert.equal(vidEvt.name, "job/video.requested");
  assert.deepEqual(vidEvt.data, { jobId: "j2" });

  const regenEvt = jobFrameRegenerateRequested.create({
    jobId: "j3",
    frameIndex: 2,
    appendText: "warmer oak floor",
  });
  assert.equal(regenEvt.name, "job/frame.regenerate.requested");
  assert.deepEqual(regenEvt.data, {
    jobId: "j3",
    frameIndex: 2,
    appendText: "warmer oak floor",
  });
});
