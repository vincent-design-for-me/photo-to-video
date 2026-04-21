import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DEFAULT_WORKFLOW_CONFIG } from "./config";
import { getInteriorStylePrompt } from "../prompts/interiorStyles";
import { getSupabaseClient } from "../supabase";
import type { JobAsset, StepKind, StepStatus, VideoJob } from "./types";

const TMP_DIR = "/tmp";

export async function ensureJobDirs(jobId: string): Promise<string> {
  const rootDir = path.join(TMP_DIR, jobId);
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
  id = randomUUID(),
  styleId = DEFAULT_WORKFLOW_CONFIG.styleId,
  aspectRatio = DEFAULT_WORKFLOW_CONFIG.aspectRatio,
  resolution = DEFAULT_WORKFLOW_CONFIG.resolution,
  userEditRequests?: string[]
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
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  if (error || !data) return null;
  return rowToJob(data);
}

export async function writeJob(job: VideoJob): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("jobs").upsert(jobToRow(job));
  if (error) throw new Error(`Failed to write job: ${error.message}`);
}

export async function updateJobStep(
  jobId: string,
  kind: StepKind,
  index: number,
  status: StepStatus,
  outputPath?: string
): Promise<void> {
  const job = await getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} was not found`);
  await writeJob({
    ...job,
    updatedAt: new Date().toISOString(),
    steps: job.steps.map((step) =>
      step.kind === kind && step.index === index
        ? { ...step, status, outputPath, updatedAt: new Date().toISOString() }
        : step
    )
  });
}

export async function buildJobAsset(filePath: string, name: string, type: string, size = 0): Promise<JobAsset> {
  return { name, path: filePath, size, type };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function jobToRow(job: VideoJob) {
  return {
    id: job.id,
    status: job.status,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
    config: job.config,
    source_images: job.sourceImages,
    generated_frames: job.generatedFrames,
    frame_prompts: job.framePrompts ?? null,
    user_edit_requests: job.userEditRequests ?? null,
    generated_clips: job.generatedClips,
    final_video_path: job.finalVideoPath ?? null,
    error: job.error ?? null,
    steps: job.steps,
  };
}

function rowToJob(row: Record<string, unknown>): VideoJob {
  return {
    id: row.id as string,
    rootDir: path.join(TMP_DIR, row.id as string),
    status: row.status as VideoJob["status"],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    config: row.config as VideoJob["config"],
    sourceImages: (row.source_images as JobAsset[]) ?? [],
    generatedFrames: (row.generated_frames as string[]) ?? [],
    framePrompts: row.frame_prompts as string[] | undefined,
    userEditRequests: row.user_edit_requests as string[] | undefined,
    generatedClips: (row.generated_clips as string[]) ?? [],
    finalVideoPath: row.final_video_path as string | undefined,
    error: row.error as string | undefined,
    steps: (row.steps as VideoJob["steps"]) ?? [],
  };
}
