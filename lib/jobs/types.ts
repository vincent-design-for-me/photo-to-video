import type { WorkflowConfig } from "./workflow";
import type { FrameJudgement } from "../providers/judgeFrame";

export type JobStatus = "queued" | "running" | "awaiting_review" | "complete" | "failed";

/** A frame's structural-consistency verdict, plus when it was produced. */
export type StoredFrameJudgement = FrameJudgement & { judgedAt: string };

/**
 * One human review action, logged so we can later calibrate the score threshold
 * and validate the judge against real reviewer decisions (Phase 2 prerequisite).
 */
export type ReviewDecision = {
  frameIndex: number;
  decision: "kept" | "regenerated";
  /** The judge's score at decision time, or null if it had not scored yet. */
  score: number | null;
  passed: boolean | null;
  at: string;
  /** Present for "regenerated": the edit text the reviewer supplied. */
  appendText?: string;
};
export type StepStatus = "queued" | "running" | "complete" | "failed";
export type StepKind = "prompt" | "image" | "video" | "render";

export type JobAsset = {
  name: string;
  path: string;
  size: number;
  type: string;
};

export type JobStep = {
  id: string;
  kind: StepKind;
  index: number;
  label: string;
  status: StepStatus;
  outputPath?: string;
  updatedAt?: string;
};

export type VideoJob = {
  id: string;
  userId?: string;
  status: JobStatus;
  rootDir: string;
  createdAt: string;
  updatedAt: string;
  sourceImages: JobAsset[];
  generatedFrames: string[];
  /** Per-frame structural-consistency verdicts, parallel to generatedFrames. */
  frameJudgements?: (StoredFrameJudgement | null)[];
  /** Append-only log of reviewer keep/regenerate decisions. */
  reviewDecisions?: ReviewDecision[];
  framePrompts?: string[];
  userEditRequests?: string[];
  generatedClips: string[];
  finalVideoPath?: string;
  error?: string;
  config: WorkflowConfig;
  steps: JobStep[];
};
