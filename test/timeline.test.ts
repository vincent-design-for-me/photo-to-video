import test from "node:test";
import assert from "node:assert/strict";
import { buildTimelinePlan } from "../lib/video/timeline";

test("buildTimelinePlan creates one three-second segment per uploaded image", () => {
  const plan = buildTimelinePlan([
    "clip-a.mp4",
    "clip-b.mp4",
    "clip-c.mp4",
    "clip-d.mp4",
    "clip-e.mp4",
    "clip-f.mp4"
  ]);

  assert.equal(plan.totalDurationSeconds, 18);
  assert.equal(plan.segments.length, 6);
  assert.deepEqual(
    plan.segments.map((segment) => segment.startSeconds),
    [0, 3, 6, 9, 12, 15]
  );
  assert.ok(plan.transitions.every((transition) => transition.durationSeconds === 0.45));
});

test("buildTimelinePlan rejects more than six source images", () => {
  assert.throws(
    () => buildTimelinePlan(["1", "2", "3", "4", "5", "6", "7"]),
    /maximum of 6/i
  );
});
