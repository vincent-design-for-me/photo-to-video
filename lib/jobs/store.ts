import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
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

export async function createJob(files: JobAsset[], id = randomUUID(), styleId = DEFAULT_WORKFLOW_CONFIG.styleId): Promise<VideoJob> {
  const rootDir = await ensureJobDirs(id);
  const now = new Date().toISOString();
  const style = getInteriorStylePrompt(styleId);
  const job: VideoJob = {
    id,
    rootDir,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    sourceImages: files,
    generatedFrames: [],
    generatedClips: [],
    config: {
      ...DEFAULT_WORKFLOW_CONFIG,
      styleId: style.id,
      style: style.name
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
      {
        id: "render-0",
        kind: "render",
        index: 0,
        label: "FFmpeg final timeline",
        status: "queued"
      }
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
  if (!job) {
    throw new Error(`Job ${jobId} was not found`);
  }

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

export async function buildJobAsset(filePath: string, name: string, type: string): Promise<JobAsset> {
  const fileStat = await stat(filePath);
  return {
    name,
    path: filePath,
    size: fileStat.size,
    type
  };
}
