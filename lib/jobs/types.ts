import type { WorkflowConfig } from "./workflow";

export type JobStatus = "queued" | "running" | "awaiting_review" | "complete" | "failed";
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
  status: JobStatus;
  rootDir: string;
  createdAt: string;
  updatedAt: string;
  sourceImages: JobAsset[];
  generatedFrames: string[];
  framePrompts?: string[];
  generatedClips: string[];
  finalVideoPath?: string;
  error?: string;
  config: WorkflowConfig;
  steps: JobStep[];
};
