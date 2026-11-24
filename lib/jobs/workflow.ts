import path from "node:path";
import { access, mkdir, rm, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { runWithConcurrency } from "../http/fetchWithRetry";
import { renderFinalVideo } from "../video/ffmpeg";
import { generateInteriorFrame, generateNanoBananaPromptForImage } from "../providers/nanoBanana";
import {
  downloadKlingVideo,
  generateKlingClip,
  submitKlingClipTask,
  type KlingProviderKind,
} from "../providers/kling";
import { buildImagePromptForStyle, getInteriorStylePrompt, FULL_STRUCTURE_LOCK_PREAMBLE, SHELL_LOCK_PREAMBLE } from "../prompts/interiorStyles";
import { getJob, mutateJob, updateJobStep } from "./store";
import { judgeAllFrames, judgeFrameAndStore } from "./judging";
import { setFrameJudgement } from "./judgements";
import { isR2Configured } from "../cloudflare/config";
import { downloadFromStorage, uploadToStorage, storageKey } from "./storage";
export { DEFAULT_WORKFLOW_CONFIG } from "./config";
import { DEFAULT_WORKFLOW_CONFIG } from "./config";
import type { VideoJob } from "./types";

const IMAGE_PHASE_CONCURRENCY = Math.max(1, Number(process.env.IMAGE_PHASE_CONCURRENCY ?? 2));
const VIDEO_PHASE_CONCURRENCY = Math.max(1, Number(process.env.VIDEO_PHASE_CONCURRENCY ?? 3));

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

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveLocalSourceImage(job: VideoJob, index: number, workDir = job.rootDir): Promise<string> {
  const image = job.sourceImages[index];
  if (!image) throw new Error(`Missing source image at index ${index}`);
  if (!isR2Configured()) return image.path;

  const localPath = path.join(workDir, "source", path.basename(image.path));
  if (!(await fileExists(localPath))) {
    await mkdir(path.dirname(localPath), { recursive: true });
    await downloadFromStorage(image.path, localPath);
  }
  return localPath;
}

async function cleanupTempDir(dirPath: string): Promise<void> {
  if (!isR2Configured()) return;
  await rm(dirPath, { recursive: true, force: true }).catch(() => {});
}

async function isFrameCheckpointReusable(job: VideoJob, index: number): Promise<boolean> {
  const step = job.steps.find((s) => s.kind === "image" && s.index === index);
  const storedPath = job.generatedFrames?.[index];
  if (step?.status !== "complete" || !storedPath) return false;
  if (!isR2Configured()) {
    return fileExists(storedPath);
  }
  return true;
}

async function isClipCheckpointReusable(job: VideoJob, index: number): Promise<boolean> {
  const step = job.steps.find((s) => s.kind === "video" && s.index === index);
  const storedPath = job.generatedClips?.[index];
  if (step?.status !== "complete" || !storedPath) return false;
  if (!isR2Configured()) {
    return fileExists(storedPath);
  }
  return true;
}

export async function runImagePhase(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} was not found`);

  if (job.status !== "running") {
    await mutateJob(jobId, () => ({ status: "running", error: undefined }));
  }

  const workDir = isR2Configured() ? path.join("/tmp", `${jobId}-img-${randomUUID().slice(0, 8)}`) : job.rootDir;

  try {
    const config = job.config ?? DEFAULT_WORKFLOW_CONFIG;
    const styleId = config.styleId ?? config.style;
    const indices = job.sourceImages.map((_, i) => i);
    const localSourcePaths = new Array<string>(job.sourceImages.length);
    const errors: Array<{ index: number; error: unknown }> = [];

    await runWithConcurrency(indices, IMAGE_PHASE_CONCURRENCY, async (index) => {
      try {
        const sourceLocalPath = await resolveLocalSourceImage(job, index, workDir);
        localSourcePaths[index] = sourceLocalPath;

        // Resume checkpoint: skip already-completed frame unless it's missing.
        if (await isFrameCheckpointReusable(job, index)) {
          if (isR2Configured()) {
            const localFramePath = path.join(workDir, "generated", `frame-${index + 1}.png`);
            await downloadFromStorage(job.generatedFrames[index], localFramePath);
          }
          return;
        }

        // Reuse completed prompt if frame generation previously failed after prompt step.
        const promptStep = job.steps.find((s) => s.kind === "prompt" && s.index === index);
        let framePrompt = promptStep?.status === "complete" ? job.framePrompts?.[index] : undefined;

        if (!framePrompt) {
          await updateJobStep(jobId, "prompt", index, "running");
          const stylePrompt = buildImagePromptForStyle(styleId);
          const userRequest = job.userEditRequests?.[index];
          framePrompt = await generateNanoBananaPromptForImage({
            sourceImagePath: sourceLocalPath,
            stylePrompt,
            userRequest
          });
          await mutateJob(jobId, (current) => {
            const now = new Date().toISOString();
            const nextPrompts = [...(current.framePrompts ?? [])];
            while (nextPrompts.length < current.sourceImages.length) nextPrompts.push("");
            nextPrompts[index] = framePrompt!;
            return {
              framePrompts: nextPrompts,
              steps: current.steps.map((s) =>
                s.kind === "prompt" && s.index === index
                  ? { ...s, status: "complete" as const, updatedAt: now }
                  : s
              ),
            };
          });
        }

        await updateJobStep(jobId, "image", index, "running");
        const localFramePath = path.join(workDir, "generated", `frame-${index + 1}.png`);
        await mkdir(path.dirname(localFramePath), { recursive: true });
        await generateInteriorFrame({
          jobId,
          sourceImagePath: sourceLocalPath,
          prompt: `${framePrompt}${FULL_STRUCTURE_LOCK_PREAMBLE}`,
          aspectRatio: config.aspectRatio,
          resolution: config.resolution,
          outputPath: localFramePath
        });

        let storedFramePath = localFramePath;
        if (isR2Configured()) {
          const key = storageKey(jobId, `generated/frame-${index + 1}.png`);
          await uploadToStorage(key, localFramePath, "image/png");
          storedFramePath = key;
        }

        // Persist frame immediately so retries never re-generate finished frames.
        await mutateJob(jobId, (current) => {
          const now = new Date().toISOString();
          const nextFrames = [...current.generatedFrames];
          while (nextFrames.length < current.sourceImages.length) nextFrames.push("");
          nextFrames[index] = storedFramePath;
          return {
            generatedFrames: nextFrames,
            steps: current.steps.map((s) =>
              s.kind === "image" && s.index === index
                ? { ...s, status: "complete" as const, outputPath: storedFramePath, updatedAt: now }
                : s
            ),
          };
        });
      } catch (error) {
        errors.push({ index, error });
        await updateJobStep(jobId, "image", index, "failed").catch(() => {});
      }
    });

    if (errors.length > 0) {
      errors.sort((a, b) => a.index - b.index);
      const firstError = errors[0].error;
      throw firstError instanceof Error ? firstError : new Error(String(firstError));
    }

    const afterFrames = await mutateJob(jobId, () => ({
      status: "awaiting_review",
      error: undefined,
    }));
    if (!afterFrames) throw new Error(`Job ${jobId} disappeared during image phase`);

    // Score structural consistency best-effort after frames are already in review.
    // setFrameJudgement only patches `frame_judgements` via CAS, so it can never
    // overwrite a concurrent Approve or Regenerate transition.
    await judgeAllFrames(jobId, workDir, localSourcePaths, afterFrames.frameJudgements);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error in image phase";
    await mutateJob(jobId, () => ({
      status: "failed",
      error: message,
    })).catch(() => {});
    throw error;
  } finally {
    await cleanupTempDir(workDir);
  }
}

export async function runVideoPhase(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} was not found`);

  if (job.status !== "running") {
    await mutateJob(jobId, () => ({ status: "running", error: undefined }));
  }

  const workDir = isR2Configured() ? path.join("/tmp", `${jobId}-vid-${randomUUID().slice(0, 8)}`) : job.rootDir;

  try {
    const config = job.config ?? DEFAULT_WORKFLOW_CONFIG;
    const motionPrompt = buildKlingMotionPrompt(config.motion);
    const indices = job.sourceImages.map((_, i) => i);
    const localClipPaths = new Array<string>(job.sourceImages.length);
    const errors: Array<{ index: number; error: unknown }> = [];

    await runWithConcurrency(indices, VIDEO_PHASE_CONCURRENCY, async (index) => {
      try {
        const localClipPath = path.join(workDir, "clips", `clip-${index + 1}.mp4`);

        // Resume checkpoint: reuse already-generated Kling clip instead of paying again.
        if (await isClipCheckpointReusable(job, index)) {
          if (isR2Configured()) {
            // Only need local copy on disk when concatenating multiple clips with FFmpeg.
            if (job.sourceImages.length > 1) {
              await downloadFromStorage(job.generatedClips[index], localClipPath);
            }
            localClipPaths[index] = localClipPath;
          } else {
            localClipPaths[index] = job.generatedClips[index];
          }
          return;
        }

        const frameKeyOrPath = job.generatedFrames[index];
        if (!frameKeyOrPath) throw new Error(`Missing generated frame at index ${index}`);

        const sourceLocalPath = await resolveLocalSourceImage(job, index, workDir);
        let frameLocalPath = frameKeyOrPath;
        if (isR2Configured()) {
          frameLocalPath = path.join(workDir, "generated", `frame-${index + 1}.png`);
          await downloadFromStorage(frameKeyOrPath, frameLocalPath);
        }

        await updateJobStep(jobId, "video", index, "running");
        await mkdir(path.dirname(localClipPath), { recursive: true });
        await generateKlingClip({
          jobId,
          firstFramePath: sourceLocalPath,
          lastFramePath: frameLocalPath,
          prompt: motionPrompt,
          aspectRatio: config.aspectRatio,
          clipSeconds: config.clipSeconds,
          outputPath: localClipPath
        });

        let storedClipPath = localClipPath;
        if (isR2Configured()) {
          const key = storageKey(jobId, `clips/clip-${index + 1}.mp4`);
          await uploadToStorage(key, localClipPath, "video/mp4");
          storedClipPath = key;
        }

        localClipPaths[index] = localClipPath;

        // Persist clip immediately so retries never re-generate completed Kling clips.
        await mutateJob(jobId, (current) => {
          const now = new Date().toISOString();
          const nextClips = [...current.generatedClips];
          while (nextClips.length < current.sourceImages.length) nextClips.push("");
          nextClips[index] = storedClipPath;
          return {
            generatedClips: nextClips,
            steps: current.steps.map((s) =>
              s.kind === "video" && s.index === index
                ? { ...s, status: "complete" as const, outputPath: storedClipPath, updatedAt: now }
                : s
            ),
          };
        });
      } catch (error) {
        errors.push({ index, error });
        await updateJobStep(jobId, "video", index, "failed").catch(() => {});
      }
    });

    if (errors.length > 0) {
      errors.sort((a, b) => a.index - b.index);
      const firstError = errors[0].error;
      throw firstError instanceof Error ? firstError : new Error(String(firstError));
    }

    const latestAfterClips = await getJob(jobId);
    if (!latestAfterClips) throw new Error(`Job ${jobId} disappeared during video phase`);

    let finalVideoPath: string;
    if (latestAfterClips.generatedClips.length === 1) {
      finalVideoPath = latestAfterClips.generatedClips[0];
    } else {
      await updateJobStep(jobId, "render", 0, "running");
      const localFinalPath = path.join(workDir, "final.mp4");
      await renderFinalVideo({
        clipPaths: localClipPaths,
        outputPath: localFinalPath,
        clipSeconds: config.clipSeconds,
        width: config.outputWidth,
        height: config.outputHeight
      });

      if (isR2Configured()) {
        const key = storageKey(jobId, "final.mp4");
        await uploadToStorage(key, localFinalPath, "video/mp4");
        finalVideoPath = key;
      } else {
        finalVideoPath = localFinalPath;
      }
      await updateJobStep(jobId, "render", 0, "complete", finalVideoPath);
    }

    const finalJob = await mutateJob(jobId, () => ({
      finalVideoPath,
      status: "complete",
      error: undefined,
    }));
    if (!finalJob) throw new Error(`Job ${jobId} disappeared during video phase`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error in video phase";
    await mutateJob(jobId, () => ({
      status: "failed",
      error: message,
    })).catch(() => {});
    throw error;
  } finally {
    await cleanupTempDir(workDir);
  }
}

export async function regenerateFrame(
  jobId: string,
  index: number,
  appendText: string,
  options: { alreadyClaimed?: boolean } = {}
): Promise<void> {
  const job = await getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} was not found`);

  const config = job.config ?? DEFAULT_WORKFLOW_CONFIG;
  let newPrompt = job.framePrompts?.[index] ?? "";

  if (!options.alreadyClaimed) {
    const existingPrompts = job.framePrompts ?? [];
    const basePrompt = existingPrompts[index] ?? "";
    newPrompt = appendText.trim() ? `${basePrompt}\n\n${appendText.trim()}` : basePrompt;

    await mutateJob(jobId, (current) => {
      const updatedPrompts = [...(current.framePrompts ?? [])];
      updatedPrompts[index] = newPrompt;
      return { framePrompts: updatedPrompts, error: undefined };
    });
    await updateJobStep(jobId, "image", index, "running");
    await setFrameJudgement(jobId, index, null);
  }

  // Isolate temp files per regeneration invocation so concurrent frame regens
  // inside the same Serverless container never delete each other's files.
  const regenWorkDir = isR2Configured()
    ? path.join("/tmp", `${jobId}-regen-${index}-${randomUUID().slice(0, 8)}`)
    : job.rootDir;
  const localFramePath = isR2Configured()
    ? path.join(regenWorkDir, `frame-${index + 1}.png`)
    : path.join(job.rootDir, "generated", `frame-${index + 1}.png`);

  try {
    const sourceLocalPath = await resolveLocalSourceImage(job, index, regenWorkDir);
    await mkdir(path.dirname(localFramePath), { recursive: true });
    await generateInteriorFrame({
      jobId,
      sourceImagePath: sourceLocalPath,
      prompt: `${newPrompt}${SHELL_LOCK_PREAMBLE}`,
      aspectRatio: config.aspectRatio,
      resolution: config.resolution,
      outputPath: localFramePath
    });

    let storedFramePath = localFramePath;
    if (isR2Configured()) {
      const key = storageKey(jobId, `generated/frame-${index + 1}.png`);
      await uploadToStorage(key, localFramePath, "image/png");
      storedFramePath = key;
    }

    await mutateJob(jobId, (current) => {
      const now = new Date().toISOString();
      const updatedFrames = [...current.generatedFrames];
      while (updatedFrames.length < current.sourceImages.length) updatedFrames.push("");
      updatedFrames[index] = storedFramePath;
      return {
        generatedFrames: updatedFrames,
        error: undefined,
        steps: current.steps.map((s) =>
          s.kind === "image" && s.index === index
            ? { ...s, status: "complete" as const, outputPath: storedFramePath, updatedAt: now }
            : s
        ),
      };
    });

    // Re-score the regenerated frame.
    await judgeFrameAndStore(jobId, index, sourceLocalPath, localFramePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Regeneration failed";
    await mutateJob(jobId, (current) => {
      const now = new Date().toISOString();
      return {
        error: message,
        steps: current.steps.map((s) =>
          s.kind === "image" && s.index === index
            ? { ...s, status: "failed" as const, updatedAt: now }
            : s
        ),
      };
    }).catch(() => {});
    throw error;
  } finally {
    if (isR2Configured()) {
      await cleanupTempDir(regenWorkDir);
    } else if (regenWorkDir !== job.rootDir) {
      await unlink(localFramePath).catch(() => {});
    }
  }
}

// ── Atomic step primitives for durable queue execution (Inngest) ─────────────

export async function processSingleImageFrame(
  jobId: string,
  index: number
): Promise<{ storedFramePath: string; skipped: boolean }> {
  const job = await getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} was not found`);

  if (await isFrameCheckpointReusable(job, index)) {
    return { storedFramePath: job.generatedFrames[index], skipped: true };
  }

  const config = job.config ?? DEFAULT_WORKFLOW_CONFIG;
  const styleId = config.styleId ?? config.style;
  const workDir = isR2Configured()
    ? path.join("/tmp", `${jobId}-step-img-${index}-${randomUUID().slice(0, 8)}`)
    : job.rootDir;

  try {
    const sourceLocalPath = await resolveLocalSourceImage(job, index, workDir);

    const promptStep = job.steps.find((s) => s.kind === "prompt" && s.index === index);
    let framePrompt = promptStep?.status === "complete" ? job.framePrompts?.[index] : undefined;

    if (!framePrompt) {
      await updateJobStep(jobId, "prompt", index, "running");
      const stylePrompt = buildImagePromptForStyle(styleId);
      const userRequest = job.userEditRequests?.[index];
      framePrompt = await generateNanoBananaPromptForImage({
        sourceImagePath: sourceLocalPath,
        stylePrompt,
        userRequest,
      });
      await mutateJob(jobId, (current) => {
        const now = new Date().toISOString();
        const nextPrompts = [...(current.framePrompts ?? [])];
        while (nextPrompts.length < current.sourceImages.length) nextPrompts.push("");
        nextPrompts[index] = framePrompt!;
        return {
          framePrompts: nextPrompts,
          steps: current.steps.map((s) =>
            s.kind === "prompt" && s.index === index
              ? { ...s, status: "complete" as const, updatedAt: now }
              : s
          ),
        };
      });
    }

    await updateJobStep(jobId, "image", index, "running");
    const localFramePath = path.join(workDir, "generated", `frame-${index + 1}.png`);
    await mkdir(path.dirname(localFramePath), { recursive: true });
    await generateInteriorFrame({
      jobId,
      sourceImagePath: sourceLocalPath,
      prompt: `${framePrompt}${FULL_STRUCTURE_LOCK_PREAMBLE}`,
      aspectRatio: config.aspectRatio,
      resolution: config.resolution,
      outputPath: localFramePath,
    });

    let storedFramePath = localFramePath;
    if (isR2Configured()) {
      const key = storageKey(jobId, `generated/frame-${index + 1}.png`);
      await uploadToStorage(key, localFramePath, "image/png");
      storedFramePath = key;
    }

    await mutateJob(jobId, (current) => {
      const now = new Date().toISOString();
      const nextFrames = [...current.generatedFrames];
      while (nextFrames.length < current.sourceImages.length) nextFrames.push("");
      nextFrames[index] = storedFramePath;
      return {
        generatedFrames: nextFrames,
        steps: current.steps.map((s) =>
          s.kind === "image" && s.index === index
            ? { ...s, status: "complete" as const, outputPath: storedFramePath, updatedAt: now }
            : s
        ),
      };
    });

    return { storedFramePath, skipped: false };
  } catch (error) {
    await updateJobStep(jobId, "image", index, "failed").catch(() => {});
    throw error;
  } finally {
    await cleanupTempDir(workDir);
  }
}

export async function judgeSingleImageFrame(jobId: string, index: number): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;
  if (job.frameJudgements?.[index]) return;
  const storedFrame = job.generatedFrames?.[index];
  if (!storedFrame) return;

  const workDir = isR2Configured()
    ? path.join("/tmp", `${jobId}-step-judge-${index}-${randomUUID().slice(0, 8)}`)
    : job.rootDir;

  try {
    const sourceLocalPath = await resolveLocalSourceImage(job, index, workDir);
    let frameLocalPath = storedFrame;
    if (isR2Configured()) {
      frameLocalPath = path.join(workDir, "generated", `frame-${index + 1}.png`);
      await downloadFromStorage(storedFrame, frameLocalPath);
    }
    await judgeFrameAndStore(jobId, index, sourceLocalPath, frameLocalPath);
  } finally {
    await cleanupTempDir(workDir);
  }
}

export type SubmitClipStepResult =
  | { skipped: true; storedClipPath: string }
  | { skipped: false; kind: "placeholder"; storedClipPath: string }
  | { skipped: false; kind: "remote"; provider: KlingProviderKind; taskId: string };

export async function submitClipGenerationStep(
  jobId: string,
  index: number
): Promise<SubmitClipStepResult> {
  const job = await getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} was not found`);

  if (await isClipCheckpointReusable(job, index)) {
    return { skipped: true, storedClipPath: job.generatedClips[index] };
  }

  const frameKeyOrPath = job.generatedFrames[index];
  if (!frameKeyOrPath) throw new Error(`Missing generated frame at index ${index}`);

  const config = job.config ?? DEFAULT_WORKFLOW_CONFIG;
  const motionPrompt = buildKlingMotionPrompt(config.motion);
  const workDir = isR2Configured()
    ? path.join("/tmp", `${jobId}-step-clip-sub-${index}-${randomUUID().slice(0, 8)}`)
    : job.rootDir;

  try {
    const sourceLocalPath = await resolveLocalSourceImage(job, index, workDir);
    let frameLocalPath = frameKeyOrPath;
    if (isR2Configured()) {
      frameLocalPath = path.join(workDir, "generated", `frame-${index + 1}.png`);
      await downloadFromStorage(frameKeyOrPath, frameLocalPath);
    }

    await updateJobStep(jobId, "video", index, "running");
    const localClipPath = path.join(workDir, "clips", `clip-${index + 1}.mp4`);
    await mkdir(path.dirname(localClipPath), { recursive: true });

    const submission = await submitKlingClipTask({
      jobId,
      firstFramePath: sourceLocalPath,
      lastFramePath: frameLocalPath,
      prompt: motionPrompt,
      aspectRatio: config.aspectRatio,
      clipSeconds: config.clipSeconds,
      outputPath: localClipPath,
    });

    if (submission.kind === "placeholder") {
      let storedClipPath = submission.outputPath;
      if (isR2Configured()) {
        const key = storageKey(jobId, `clips/clip-${index + 1}.mp4`);
        await uploadToStorage(key, submission.outputPath, "video/mp4");
        storedClipPath = key;
      }

      await mutateJob(jobId, (current) => {
        const now = new Date().toISOString();
        const nextClips = [...current.generatedClips];
        while (nextClips.length < current.sourceImages.length) nextClips.push("");
        nextClips[index] = storedClipPath;
        return {
          generatedClips: nextClips,
          steps: current.steps.map((s) =>
            s.kind === "video" && s.index === index
              ? { ...s, status: "complete" as const, outputPath: storedClipPath, updatedAt: now }
              : s
          ),
        };
      });

      return { skipped: false, kind: "placeholder", storedClipPath };
    }

    return {
      skipped: false,
      kind: "remote",
      provider: submission.provider,
      taskId: submission.taskId,
    };
  } catch (error) {
    await updateJobStep(jobId, "video", index, "failed").catch(() => {});
    throw error;
  } finally {
    await cleanupTempDir(workDir);
  }
}

export async function finalizeClipDownloadStep(
  jobId: string,
  index: number,
  videoUrl: string
): Promise<{ storedClipPath: string }> {
  const job = await getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} was not found`);

  if (await isClipCheckpointReusable(job, index)) {
    return { storedClipPath: job.generatedClips[index] };
  }

  const workDir = isR2Configured()
    ? path.join("/tmp", `${jobId}-step-clip-dl-${index}-${randomUUID().slice(0, 8)}`)
    : job.rootDir;

  try {
    const localClipPath = path.join(workDir, "clips", `clip-${index + 1}.mp4`);
    await downloadKlingVideo(videoUrl, localClipPath);

    let storedClipPath = localClipPath;
    if (isR2Configured()) {
      const key = storageKey(jobId, `clips/clip-${index + 1}.mp4`);
      await uploadToStorage(key, localClipPath, "video/mp4");
      storedClipPath = key;
    }

    await mutateJob(jobId, (current) => {
      const now = new Date().toISOString();
      const nextClips = [...current.generatedClips];
      while (nextClips.length < current.sourceImages.length) nextClips.push("");
      nextClips[index] = storedClipPath;
      return {
        generatedClips: nextClips,
        steps: current.steps.map((s) =>
          s.kind === "video" && s.index === index
            ? { ...s, status: "complete" as const, outputPath: storedClipPath, updatedAt: now }
            : s
        ),
      };
    });

    return { storedClipPath };
  } catch (error) {
    await updateJobStep(jobId, "video", index, "failed").catch(() => {});
    throw error;
  } finally {
    await cleanupTempDir(workDir);
  }
}

export async function finalizeVideoRenderStep(jobId: string): Promise<{ finalVideoPath: string }> {
  const job = await getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} was not found`);

  const config = job.config ?? DEFAULT_WORKFLOW_CONFIG;
  const workDir = isR2Configured()
    ? path.join("/tmp", `${jobId}-step-render-${randomUUID().slice(0, 8)}`)
    : job.rootDir;

  try {
    let finalVideoPath: string;
    if (job.generatedClips.length === 1) {
      finalVideoPath = job.generatedClips[0];
    } else {
      await updateJobStep(jobId, "render", 0, "running");
      const localClipPaths: string[] = [];
      for (let i = 0; i < job.generatedClips.length; i += 1) {
        const storedClip = job.generatedClips[i];
        if (!storedClip) throw new Error(`Missing generated clip at index ${i}`);
        if (isR2Configured()) {
          const localClipPath = path.join(workDir, "clips", `clip-${i + 1}.mp4`);
          await downloadFromStorage(storedClip, localClipPath);
          localClipPaths.push(localClipPath);
        } else {
          localClipPaths.push(storedClip);
        }
      }

      const localFinalPath = path.join(workDir, "final.mp4");
      await renderFinalVideo({
        clipPaths: localClipPaths,
        outputPath: localFinalPath,
        clipSeconds: config.clipSeconds,
        width: config.outputWidth,
        height: config.outputHeight,
      });

      if (isR2Configured()) {
        const key = storageKey(jobId, "final.mp4");
        await uploadToStorage(key, localFinalPath, "video/mp4");
        finalVideoPath = key;
      } else {
        finalVideoPath = localFinalPath;
      }

      await updateJobStep(jobId, "render", 0, "complete", finalVideoPath);
    }

    const finalJob = await mutateJob(jobId, () => ({
      finalVideoPath,
      status: "complete",
      error: undefined,
    }));
    if (!finalJob) throw new Error(`Job ${jobId} disappeared during render step`);

    return { finalVideoPath };
  } finally {
    await cleanupTempDir(workDir);
  }
}

// Back-compat wrapper used by scripts/resume-job.ts
export async function runWorkflow(jobId: string): Promise<void> {
  await runImagePhase(jobId);
  await runVideoPhase(jobId);
}
