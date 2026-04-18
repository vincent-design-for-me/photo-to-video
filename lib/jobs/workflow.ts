import path from "node:path";
import { renderFinalVideo } from "../video/ffmpeg";
import { generateInteriorFrame, generateNanoBananaPromptForImage } from "../providers/nanoBanana";
import { generateKlingClip } from "../providers/kling";
import { buildImagePromptForStyle, getInteriorStylePrompt, FULL_STRUCTURE_LOCK_PREAMBLE, SHELL_LOCK_PREAMBLE } from "../prompts/interiorStyles";
import { getJob, updateJobStep, writeJob } from "./store";
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

export async function runImagePhase(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} was not found`);

  await writeJob({
    ...job,
    status: "running",
    error: undefined,
    updatedAt: new Date().toISOString()
  });

  try {
    const config = job.config ?? DEFAULT_WORKFLOW_CONFIG;
    const styleId = config.styleId ?? config.style;
    const generatedFrames: string[] = [];
    const framePrompts: string[] = [];

    for (const [index, image] of job.sourceImages.entries()) {
      await updateJobStep(jobId, "prompt", index, "running");
      const stylePrompt = buildImagePromptForStyle(styleId);
      const framePrompt = await generateNanoBananaPromptForImage({
        sourceImagePath: image.path,
        stylePrompt
      });
      framePrompts.push(framePrompt);
      await updateJobStep(jobId, "prompt", index, "complete");

      await updateJobStep(jobId, "image", index, "running");
      const framePath = await generateInteriorFrame({
        jobId,
        sourceImagePath: image.path,
        prompt: `${framePrompt}${FULL_STRUCTURE_LOCK_PREAMBLE}`,
        aspectRatio: config.aspectRatio,
        resolution: config.resolution,
        outputPath: path.join(job.rootDir, "generated", `frame-${index + 1}.png`)
      });
      generatedFrames.push(framePath);
      await updateJobStep(jobId, "image", index, "complete", framePath);
    }

    const latest = await getJob(jobId);
    if (!latest) throw new Error(`Job ${jobId} disappeared during image phase`);
    await writeJob({
      ...latest,
      generatedFrames,
      framePrompts,
      status: "awaiting_review",
      updatedAt: new Date().toISOString()
    });
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

  await writeJob({
    ...job,
    status: "running",
    error: undefined,
    updatedAt: new Date().toISOString()
  });

  try {
    const config = job.config ?? DEFAULT_WORKFLOW_CONFIG;
    const motionPrompt = buildKlingMotionPrompt(config.motion);
    const generatedClips: string[] = [];

    for (const [index, image] of job.sourceImages.entries()) {
      const framePath = job.generatedFrames[index];
      if (!framePath) throw new Error(`Missing generated frame at index ${index}`);

      await updateJobStep(jobId, "video", index, "running");
      const clipPath = await generateKlingClip({
        jobId,
        firstFramePath: image.path,
        lastFramePath: framePath,
        prompt: motionPrompt,
        aspectRatio: config.aspectRatio,
        clipSeconds: config.clipSeconds,
        outputPath: path.join(job.rootDir, "clips", `clip-${index + 1}.mp4`)
      });
      generatedClips.push(clipPath);
      await updateJobStep(jobId, "video", index, "complete", clipPath);
    }

    let finalVideoPath: string;
    if (generatedClips.length === 1) {
      finalVideoPath = generatedClips[0];
    } else {
      await updateJobStep(jobId, "render", 0, "running");
      finalVideoPath = await renderFinalVideo({
        clipPaths: generatedClips,
        outputPath: path.join(job.rootDir, "final.mp4"),
        clipSeconds: config.clipSeconds,
        width: config.outputWidth,
        height: config.outputHeight
      });
      await updateJobStep(jobId, "render", 0, "complete", finalVideoPath);
    }

    const latest = await getJob(jobId);
    if (!latest) throw new Error(`Job ${jobId} disappeared during video phase`);
    await writeJob({
      ...latest,
      generatedClips,
      finalVideoPath,
      status: "complete",
      updatedAt: new Date().toISOString()
    });
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

export async function regenerateFrame(
  jobId: string,
  index: number,
  appendText: string
): Promise<void> {
  const job = await getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} was not found`);

  const config = job.config ?? DEFAULT_WORKFLOW_CONFIG;
  const existingPrompts = job.framePrompts ?? [];
  const basePrompt = existingPrompts[index] ?? "";
  const newPrompt = appendText.trim() ? `${basePrompt}\n\n${appendText.trim()}` : basePrompt;

  const updatedPrompts = [...existingPrompts];
  updatedPrompts[index] = newPrompt;

  await writeJob({
    ...job,
    framePrompts: updatedPrompts,
    updatedAt: new Date().toISOString()
  });
  await updateJobStep(jobId, "image", index, "running");

  try {
    const framePath = await generateInteriorFrame({
      jobId,
      sourceImagePath: job.sourceImages[index].path,
      prompt: `${newPrompt}${SHELL_LOCK_PREAMBLE}`,
      aspectRatio: config.aspectRatio,
      resolution: config.resolution,
      outputPath: path.join(job.rootDir, "generated", `frame-${index + 1}.png`)
    });

    await updateJobStep(jobId, "image", index, "complete", framePath);
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
