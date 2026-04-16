import type { WorkflowConfig } from "./workflow";

export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  aspectRatio: "9:16",
  clipSeconds: 3,
  maxImages: 6,
  outputWidth: 1080,
  outputHeight: 1920,
  videoModel: "video-3.0-omni",
  resolution: "1080p",
  nativeAudio: true,
  audioSync: true,
  styleId: "minimalist-calm",
  style: "luxury commercial interior",
  motion: "slow dolly-in with subtle parallax and soft daylight shift"
};
