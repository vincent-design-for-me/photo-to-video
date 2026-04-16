import path from "node:path";
import { renderFinalVideo } from "../video/ffmpeg";
import { generateInteriorFrame, generateNanoBananaPromptForImage } from "../providers/nanoBanana";
import { generateKlingClip } from "../providers/kling";
import { buildImagePromptForStyle, getInteriorStylePrompt } from "../prompts/interiorStyles";
import { getJob, updateJobStep, writeJob } from "./store";
export { DEFAULT_WORKFLOW_CONFIG } from "./config";
import { DEFAULT_WORKFLOW_CONFIG } from "./config";

export type WorkflowConfig = {
  aspectRatio: "9:16";
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
  return [
    `Create a premium interior design advertisement shot with ${motion}.`,
    "Maintain stable geometry, straight architectural lines, natural lighting continuity, and realistic furniture scale.",
    "No jitter, no flicker, no warped furniture, no text, no logos, no people, no melting objects."
  ].join(" ");
}

export async function runWorkflow(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} was not found`);
  }

  await writeJob({
    ...job,
    status: "running",
    error: undefined,
    updatedAt: new Date().toISOString()
  });

  try {
    const config = job.config ?? DEFAULT_WORKFLOW_CONFIG;
    const motionPrompt = buildKlingMotionPrompt(config.motion);
    const styleId = config.styleId ?? config.style;
    const generatedFrames: string[] = [];
    const generatedClips: string[] = [];

    for (const [index, image] of job.sourceImages.entries()) {
      // Step 1: Generate per-image Nano Banana prompt based on image scene
      await updateJobStep(jobId, "prompt", index, "running");
      const stylePrompt = buildImagePromptForStyle(styleId);
      const framePrompt = await generateNanoBananaPromptForImage({
        sourceImagePath: image.path,
        stylePrompt
      });
      await updateJobStep(jobId, "prompt", index, "complete");

      // Step 2: Generate redesigned image using the per-image prompt
      await updateJobStep(jobId, "image", index, "running");
      const framePath = await generateInteriorFrame({
        jobId,
        sourceImagePath: image.path,
        prompt: framePrompt,
        aspectRatio: config.aspectRatio,
        outputPath: path.join(job.rootDir, "generated", `frame-${index + 1}.png`)
      });
      generatedFrames.push(framePath);
      await updateJobStep(jobId, "image", index, "complete", framePath);

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

    await updateJobStep(jobId, "render", 0, "running");
    const finalVideoPath = await renderFinalVideo({
      clipPaths: generatedClips,
      outputPath: path.join(job.rootDir, "final.mp4"),
      clipSeconds: config.clipSeconds,
      width: config.outputWidth,
      height: config.outputHeight
    });
    await updateJobStep(jobId, "render", 0, "complete", finalVideoPath);

    const latest = await getJob(jobId);
    if (!latest) {
      throw new Error(`Job ${jobId} disappeared during rendering`);
    }

    await writeJob({
      ...latest,
      generatedFrames,
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
        error: error instanceof Error ? error.message : "Unknown workflow error",
        updatedAt: new Date().toISOString()
      });
    }
    throw error;
  }
}
