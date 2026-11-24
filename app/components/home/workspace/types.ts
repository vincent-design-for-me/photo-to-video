export type WorkspaceJobStep = {
  id: string;
  kind: "prompt" | "image" | "video" | "render";
  index: number;
  label: string;
  status: "queued" | "running" | "complete" | "failed";
  updatedAt?: string;
};

export type WorkspaceJobSummary = {
  id: string;
  status: "queued" | "running" | "awaiting_review" | "complete" | "failed";
  createdAt: string;
  updatedAt: string;
  sourceImages: Array<{ name: string; path: string }>;
  generatedFrames: string[];
  generatedClips: string[];
  finalVideoPath?: string;
  error?: string;
  config: {
    styleId?: string;
    style: string;
    aspectRatio: string;
    resolution: string;
  };
  steps: WorkspaceJobStep[];
  /** True only for the instant optimistic card right after submit before first poll returns. */
  optimistic?: boolean;
};

export type ReusableAsset = {
  id: string;
  url: string;
  name: string;
  jobStyle: string;
};
