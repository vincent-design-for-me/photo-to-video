import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_WORKFLOW_CONFIG } from "./config";
import { getInteriorStylePrompt } from "../prompts/interiorStyles";
import type { JobAsset, StepKind, StepStatus, VideoJob } from "./types";

const DATA_DIR = path.join(process.cwd(), ".data", "jobs");

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
  id = randomUUID(),
  styleId = DEFAULT_WORKFLOW_CONFIG.styleId,
  aspectRatio = DEFAULT_WORKFLOW_CONFIG.aspectRatio,
  resolution = DEFAULT_WORKFLOW_CONFIG.resolution,
  userEditRequests?: string[],
  userId?: string,
  _client?: SupabaseClient
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
  await writeFile(path.join(job.rootDir, "job.json"), JSON.stringify(job, null, 2));
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
