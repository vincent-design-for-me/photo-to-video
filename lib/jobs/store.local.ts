import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DEFAULT_WORKFLOW_CONFIG } from "./config";
import { getInteriorStylePrompt } from "../prompts/interiorStyles";
import {
  DEFAULT_STALE_REGEN_MS,
  DEFAULT_STALE_RUNNING_MS,
  hasActiveFrameRegeneration,
  isJobRunningStale,
  isTimestampStale,
} from "./stale";
import type { ClaimExecutionOptions, ClaimResult, JobPatch } from "./store.d1";
import type { JobAsset, StepKind, StepStatus, VideoJob } from "./types";

const DATA_DIR = path.join(process.cwd(), ".data", "jobs");
const localLocks = new Map<string, Promise<unknown>>();

function withLocalJobLock<T>(jobId: string, fn: () => Promise<T>): Promise<T> {
  const prev = localLocks.get(jobId) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  const cleanup = next.finally(() => {
    if (localLocks.get(jobId) === cleanup) {
      localLocks.delete(jobId);
    }
  });
  localLocks.set(jobId, cleanup);
  return next;
}

export async function ensureJobDirs(jobId: string): Promise<string> {
  const rootDir = path.join(DATA_DIR, jobId);
  await mkdir(path.join(rootDir, "source"), { recursive: true });
  await mkdir(path.join(rootDir, "generated"), { recursive: true });
  await mkdir(path.join(rootDir, "clips"), { recursive: true });
  await mkdir(path.join(rootDir, "work"), { recursive: true });
  return rootDir;
}

function computeOutputDimensions(aspectRatio: string, resolution: string): { outputWidth: number; outputHeight: number } {
  const px = resolution === "4k" ? 2160 : resolution === "720p" ? 720 : 1080;
  if (aspectRatio === "16:9") return { outputWidth: Math.round(px * 16 / 9), outputHeight: px };
  if (aspectRatio === "1:1")  return { outputWidth: px, outputHeight: px };
  if (aspectRatio === "4:3")  return { outputWidth: Math.round(px * 4 / 3), outputHeight: px };
  if (aspectRatio === "3:4")  return { outputWidth: px, outputHeight: Math.round(px * 4 / 3) };
  return { outputWidth: px, outputHeight: Math.round(px * 16 / 9) };
}

export async function createJob(
  files: JobAsset[],
  id: string = randomUUID(),
  styleId = DEFAULT_WORKFLOW_CONFIG.styleId,
  aspectRatio = DEFAULT_WORKFLOW_CONFIG.aspectRatio,
  resolution = DEFAULT_WORKFLOW_CONFIG.resolution,
  userEditRequests?: string[],
  userId?: string
): Promise<VideoJob> {
  const rootDir = await ensureJobDirs(id);
  const now = new Date().toISOString();
  const style = getInteriorStylePrompt(styleId);
  const { outputWidth, outputHeight } = computeOutputDimensions(aspectRatio, resolution);
  const normalizedEditRequests = userEditRequests
    ? files.map((_, i) => (userEditRequests[i] ?? "").trim())
    : undefined;
  const hasAnyEdit = normalizedEditRequests?.some(r => r.length > 0);

  const job: VideoJob = {
    id,
    ...(userId ? { userId } : {}),
    rootDir,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    sourceImages: files,
    generatedFrames: [],
    ...(hasAnyEdit ? { userEditRequests: normalizedEditRequests } : {}),
    generatedClips: [],
    config: {
      ...DEFAULT_WORKFLOW_CONFIG,
      styleId: style.id,
      style: style.name,
      aspectRatio,
      resolution,
      outputWidth,
      outputHeight
    },
    steps: [
      ...files.map((file, index) => ({
        id: `prompt-${index}`,
        kind: "prompt" as const,
        index,
        label: `Generating prompt ${index + 1}: ${file.name}`,
        status: "queued" as const
      })),
      ...files.map((file, index) => ({
        id: `image-${index}`,
        kind: "image" as const,
        index,
        label: `Nano Banana frame ${index + 1}: ${file.name}`,
        status: "queued" as const
      })),
      ...files.map((file, index) => ({
        id: `video-${index}`,
        kind: "video" as const,
        index,
        label: `Kling clip ${index + 1}: ${file.name}`,
        status: "queued" as const
      })),
      ...(files.length > 1 ? [{
        id: "render-0",
        kind: "render" as const,
        index: 0,
        label: "FFmpeg final timeline",
        status: "queued" as const
      }] : [])
    ]
  };

  await writeJob(job);
  return job;
}

export async function getJob(jobId: string): Promise<VideoJob | null> {
  try {
    const content = await readFile(path.join(DATA_DIR, jobId, "job.json"), "utf8");
    return JSON.parse(content) as VideoJob;
  } catch {
    return null;
  }
}

export async function writeJob(job: VideoJob): Promise<void> {
  await mkdir(job.rootDir, { recursive: true });
  const target = path.join(job.rootDir, "job.json");
  const tmp = `${target}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(job, null, 2));
  await rename(tmp, target);
}

export async function mutateJob(
  jobId: string,
  updater: (current: VideoJob) => JobPatch | null
): Promise<VideoJob | null> {
  return withLocalJobLock(jobId, async () => {
    const current = await getJob(jobId);
    if (!current) return null;
    const patch = updater(current);
    if (!patch) return current;

    const updated: VideoJob = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await writeJob(updated);
    return updated;
  });
}

export async function claimJobExecution(
  jobId: string,
  options: ClaimExecutionOptions
): Promise<ClaimResult> {
  const staleAfterMs = options.staleAfterMs ?? Number(process.env.JOB_STALE_RUNNING_MS ?? DEFAULT_STALE_RUNNING_MS);
  const regenStaleMs = Number(process.env.JOB_STALE_REGEN_MS ?? DEFAULT_STALE_REGEN_MS);
  let rejectionReason: string | undefined;

  const updated = await mutateJob(jobId, (current) => {
    rejectionReason = undefined;
    const statusAllowed = options.allowedStatuses.includes(current.status);
    const staleReclaim = Boolean(options.allowStaleRunning) && isJobRunningStale(current, staleAfterMs);

    if (!statusAllowed && !staleReclaim) {
      if (current.status === "running") {
        rejectionReason = "Job is already running";
      } else if (current.status === "complete") {
        rejectionReason = "Job is already complete";
      } else if (current.status === "awaiting_review") {
        rejectionReason = "Job is awaiting review — use POST /approve to proceed to video";
      } else {
        rejectionReason = `Job cannot be started from status "${current.status}"`;
      }
      return null;
    }

    if (options.requireNoActiveFrameRegen && hasActiveFrameRegeneration(current, regenStaleMs)) {
      rejectionReason = "Some frames are still regenerating — wait for them to finish";
      return null;
    }

    return {
      status: "running",
      error: undefined,
    };
  });

  if (!updated) {
    return { claimed: false, job: null, reason: "Job not found" };
  }
  if (rejectionReason) {
    return { claimed: false, job: updated, reason: rejectionReason };
  }
  return { claimed: true, job: updated };
}

export async function claimFrameRegeneration(
  jobId: string,
  frameIndex: number,
  appendText: string,
  options?: { staleAfterMs?: number }
): Promise<ClaimResult> {
  const staleAfterMs = options?.staleAfterMs ?? Number(process.env.JOB_STALE_REGEN_MS ?? DEFAULT_STALE_REGEN_MS);
  let rejectionReason: string | undefined;

  const updated = await mutateJob(jobId, (current) => {
    rejectionReason = undefined;
    if (current.status !== "awaiting_review") {
      rejectionReason = "Job is not in review state";
      return null;
    }

    const imageStep = current.steps.find((s) => s.kind === "image" && s.index === frameIndex);
    if (imageStep?.status === "running" && !isTimestampStale(imageStep.updatedAt, staleAfterMs)) {
      rejectionReason = "Frame is already regenerating";
      return null;
    }

    const now = new Date().toISOString();
    const existingPrompts = current.framePrompts ?? [];
    const basePrompt = existingPrompts[frameIndex] ?? "";
    const newPrompt = appendText.trim() ? `${basePrompt}\n\n${appendText.trim()}` : basePrompt;
    const updatedPrompts = [...existingPrompts];
    updatedPrompts[frameIndex] = newPrompt;

    const judgements = [...(current.frameJudgements ?? [])];
    while (judgements.length < current.generatedFrames.length) judgements.push(null);
    const priorVerdict = current.frameJudgements?.[frameIndex] ?? null;
    judgements[frameIndex] = null;

    const steps = current.steps.map((step) =>
      step.kind === "image" && step.index === frameIndex
        ? { ...step, status: "running" as const, updatedAt: now }
        : step
    );

    const reviewDecisions = [
      ...(current.reviewDecisions ?? []),
      {
        frameIndex,
        decision: "regenerated" as const,
        score: priorVerdict?.consistencyScore ?? null,
        passed: priorVerdict?.passed ?? null,
        at: now,
        appendText: appendText.trim(),
      },
    ];

    return {
      framePrompts: updatedPrompts,
      frameJudgements: judgements,
      reviewDecisions,
      steps,
      error: undefined,
    };
  });

  if (!updated) {
    return { claimed: false, job: null, reason: "Job not found" };
  }
  if (rejectionReason) {
    return { claimed: false, job: updated, reason: rejectionReason };
  }
  return { claimed: true, job: updated };
}

export async function updateJobStep(
  jobId: string,
  kind: StepKind,
  index: number,
  status: StepStatus,
  outputPath?: string
): Promise<void> {
  const result = await mutateJob(jobId, (job) => {
    const now = new Date().toISOString();
    return {
      steps: job.steps.map((step) =>
        step.kind === kind && step.index === index
          ? { ...step, status, ...(outputPath !== undefined ? { outputPath } : {}), updatedAt: now }
          : step
      ),
    };
  });
  if (!result) throw new Error(`Job ${jobId} was not found`);
}

export async function buildJobAsset(filePath: string, name: string, type: string, size?: number): Promise<JobAsset> {
  const resolvedSize = size ?? (await stat(filePath)).size;
  return { name, path: filePath, size: resolvedSize, type };
}

export async function getJobsByUser(userId: string): Promise<VideoJob[]> {
  const { readdir } = await import("node:fs/promises");
  try {
    const dirs = await readdir(DATA_DIR);
    const jobs: VideoJob[] = [];
    for (const dir of dirs) {
      const job = await getJob(dir);
      if (job && job.userId === userId) jobs.push(job);
    }
    return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}
