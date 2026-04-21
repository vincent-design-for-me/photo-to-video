import path from "node:path";
import { mkdir } from "node:fs/promises";
import { renderFinalVideo } from "../video/ffmpeg";
import { generateInteriorFrame, generateNanoBananaPromptForImage } from "../providers/nanoBanana";
import { generateKlingClip } from "../providers/kling";
import { buildImagePromptForStyle, getInteriorStylePrompt, FULL_STRUCTURE_LOCK_PREAMBLE, SHELL_LOCK_PREAMBLE } from "../prompts/interiorStyles";
import { getJob, updateJobStep, writeJob } from "./store";
import { isSupabaseMode } from "../supabase";
import { downloadFromStorage, uploadToStorage, storageKey } from "./storage";
export { DEFAULT_WORKFLOW_CONFIG } from "./config";
import { DEFAULT_WORKFLOW_CONFIG } from "./config";

export type WorkflowConfig = {
  aspectRatio: string;
  clipSeconds: number;
  maxImages: number;
  outputWidth: number;
  outputHeight: number;
  videoModel: string;
  resolution: string;
  nativeAudio: boolean;
  audioSync: boolean;
  styleId: string;
  style: string;
  motion: string;
};

export function buildNanoBananaPrompt(styleIdOrPrompt: string): string {
  return getInteriorStylePrompt(styleIdOrPrompt).imagePrompt;
}

export function buildKlingMotionPrompt(motion: string): string {
  return `transform from image one to image two with dramatic sound effect when the scene changes with Morph Transition. ${motion}`;
}

// In Supabase mode, source image paths are storage keys — download them to /tmp first.
async function ensureLocalSourceImages(job: Awaited<ReturnType<typeof getJob>>): Promise<void> {
  if (!job || !isSupabaseMode()) return;
  await mkdir(path.join(job.rootDir, "source"), { recursive: true });
  for (const image of job.sourceImages) {
    const localPath = path.join(job.rootDir, "source", path.basename(image.path));
    await downloadFromStorage(image.path, localPath);
    image.path = localPath;
  }
}

export async function runImagePhase(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} was not found`);

  await writeJob({ ...job, status: "running", error: undefined, updatedAt: new Date().toISOString() });

  try {
    await ensureLocalSourceImages(job);
    const config = job.config ?? DEFAULT_WORKFLOW_CONFIG;
    const styleId = config.styleId ?? config.style;
    const generatedFrames: string[] = [];
    const framePrompts: string[] = [];

    for (const [index, image] of job.sourceImages.entries()) {
      await updateJobStep(jobId, "prompt", index, "running");
      const stylePrompt = buildImagePromptForStyle(styleId);
      const userRequest = job.userEditRequests?.[index];
      const framePrompt = await generateNanoBananaPromptForImage({ sourceImagePath: image.path, stylePrompt, userRequest });
      framePrompts.push(framePrompt);
      await updateJobStep(jobId, "prompt", index, "complete");

      await updateJobStep(jobId, "image", index, "running");
      const localFramePath = path.join(job.rootDir, "generated", `frame-${index + 1}.png`);
      await mkdir(path.dirname(localFramePath), { recursive: true });
      await generateInteriorFrame({
        jobId,
        sourceImagePath: image.path,
        prompt: `${framePrompt}${FULL_STRUCTURE_LOCK_PREAMBLE}`,
        aspectRatio: config.aspectRatio,
        resolution: config.resolution,
        outputPath: localFramePath
      });

      let storedFramePath = localFramePath;
      if (isSupabaseMode()) {
        const key = storageKey(jobId, `generated/frame-${index + 1}.png`);
        await uploadToStorage(key, localFramePath, "image/png");
        storedFramePath = key;
      }

      generatedFrames.push(storedFramePath);
      await updateJobStep(jobId, "image", index, "complete", storedFramePath);
    }

    const latest = await getJob(jobId);
    if (!latest) throw new Error(`Job ${jobId} disappeared during image phase`);
    await writeJob({ ...latest, generatedFrames, framePrompts, status: "awaiting_review", updatedAt: new Date().toISOString() });
  } catch (error) {
    const latest = await getJob(jobId);
    if (latest) {
      await writeJob({
        ...latest,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error in image phase",
        updatedAt: new Date().toISOString()
      });
    }
    throw error;
  }
}

export async function runVideoPhase(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} was not found`);

  await writeJob({ ...job, status: "running", error: undefined, updatedAt: new Date().toISOString() });

  try {
    await ensureLocalSourceImages(job);
    const config = job.config ?? DEFAULT_WORKFLOW_CONFIG;
    const motionPrompt = buildKlingMotionPrompt(config.motion);
    const generatedClips: string[] = [];

    // In Supabase mode, generatedFrames are storage keys — download them to /tmp
    const localFramePaths: string[] = [];
    if (isSupabaseMode()) {
      await mkdir(path.join(job.rootDir, "generated"), { recursive: true });
      for (const [index, frameKey] of job.generatedFrames.entries()) {
        const localPath = path.join(job.rootDir, "generated", `frame-${index + 1}.png`);
        await downloadFromStorage(frameKey, localPath);
        localFramePaths.push(localPath);
      }
    } else {
      localFramePaths.push(...job.generatedFrames);
    }

    for (const [index, image] of job.sourceImages.entries()) {
      const framePath = localFramePaths[index];
      if (!framePath) throw new Error(`Missing generated frame at index ${index}`);

      await updateJobStep(jobId, "video", index, "running");
      const localClipPath = path.join(job.rootDir, "clips", `clip-${index + 1}.mp4`);
      await mkdir(path.dirname(localClipPath), { recursive: true });
      await generateKlingClip({
        jobId,
        firstFramePath: image.path,
        lastFramePath: framePath,
        prompt: motionPrompt,
        aspectRatio: config.aspectRatio,
        clipSeconds: config.clipSeconds,
        outputPath: localClipPath
      });

      let storedClipPath = localClipPath;
      if (isSupabaseMode()) {
        const key = storageKey(jobId, `clips/clip-${index + 1}.mp4`);
        await uploadToStorage(key, localClipPath, "video/mp4");
        storedClipPath = key;
      }

      generatedClips.push(storedClipPath);
      await updateJobStep(jobId, "video", index, "complete", storedClipPath);
    }

    let finalVideoPath: string;
    if (generatedClips.length === 1) {
      finalVideoPath = generatedClips[0];
    } else {
      await updateJobStep(jobId, "render", 0, "running");
      const localClipPaths = isSupabaseMode() ? localFramePaths.map((_, i) =>
        path.join(job.rootDir, "clips", `clip-${i + 1}.mp4`)
      ) : generatedClips;
      const localFinalPath = path.join(job.rootDir, "final.mp4");
      await renderFinalVideo({
        clipPaths: localClipPaths,
        outputPath: localFinalPath,
        clipSeconds: config.clipSeconds,
        width: config.outputWidth,
        height: config.outputHeight
      });

      if (isSupabaseMode()) {
        const key = storageKey(jobId, "final.mp4");
        await uploadToStorage(key, localFinalPath, "video/mp4");
        finalVideoPath = key;
      } else {
        finalVideoPath = localFinalPath;
      }
      await updateJobStep(jobId, "render", 0, "complete", finalVideoPath);
    }

    const latest = await getJob(jobId);
    if (!latest) throw new Error(`Job ${jobId} disappeared during video phase`);
    await writeJob({ ...latest, generatedClips, finalVideoPath, status: "complete", updatedAt: new Date().toISOString() });
  } catch (error) {
    const latest = await getJob(jobId);
    if (latest) {
      await writeJob({
        ...latest,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error in video phase",
        updatedAt: new Date().toISOString()
      });
    }
    throw error;
  }
}

export async function regenerateFrame(jobId: string, index: number, appendText: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} was not found`);

  const config = job.config ?? DEFAULT_WORKFLOW_CONFIG;
  const existingPrompts = job.framePrompts ?? [];
  const basePrompt = existingPrompts[index] ?? "";
  const newPrompt = appendText.trim() ? `${basePrompt}\n\n${appendText.trim()}` : basePrompt;

  const updatedPrompts = [...existingPrompts];
  updatedPrompts[index] = newPrompt;

  await writeJob({ ...job, framePrompts: updatedPrompts, updatedAt: new Date().toISOString() });
  await updateJobStep(jobId, "image", index, "running");

  try {
    await ensureLocalSourceImages(job);
    const localFramePath = path.join(job.rootDir, "generated", `frame-${index + 1}.png`);
    await mkdir(path.dirname(localFramePath), { recursive: true });
    await generateInteriorFrame({
      jobId,
      sourceImagePath: job.sourceImages[index].path,
      prompt: `${newPrompt}${SHELL_LOCK_PREAMBLE}`,
      aspectRatio: config.aspectRatio,
      resolution: config.resolution,
      outputPath: localFramePath
    });

    let storedFramePath = localFramePath;
    if (isSupabaseMode()) {
      const key = storageKey(jobId, `generated/frame-${index + 1}.png`);
      await uploadToStorage(key, localFramePath, "image/png");
      storedFramePath = key;
    }

    await updateJobStep(jobId, "image", index, "complete", storedFramePath);

    if (isSupabaseMode()) {
      const latest = await getJob(jobId);
      if (latest) {
        const updatedFrames = [...latest.generatedFrames];
        updatedFrames[index] = storedFramePath;
        await writeJob({ ...latest, generatedFrames: updatedFrames, updatedAt: new Date().toISOString() });
      }
    }
  } catch (error) {
    await updateJobStep(jobId, "image", index, "failed");
    const latest = await getJob(jobId);
    if (latest) {
      await writeJob({
        ...latest,
        error: error instanceof Error ? error.message : "Regeneration failed",
        updatedAt: new Date().toISOString()
      });
    }
    throw error;
  }
}

// Back-compat wrapper used by scripts/resume-job.ts
export async function runWorkflow(jobId: string): Promise<void> {
  await runImagePhase(jobId);
  await runVideoPhase(jobId);
}
