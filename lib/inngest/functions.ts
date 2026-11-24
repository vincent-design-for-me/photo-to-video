import { NonRetriableError } from "inngest";
import { checkKlingClipTaskOnce } from "../providers/kling";
import { getJob, mutateJob } from "../jobs/store";
import {
  finalizeClipDownloadStep,
  finalizeVideoRenderStep,
  judgeSingleImageFrame,
  processSingleImageFrame,
  regenerateFrame,
  submitClipGenerationStep,
} from "../jobs/workflow";
import { inngest } from "./client";
import {
  jobFrameRegenerateRequested,
  jobImagesRequested,
  jobVideoRequested,
} from "./events";

const IMAGE_BATCH_CONCURRENCY = Math.max(1, Number(process.env.IMAGE_PHASE_CONCURRENCY ?? 2));
const VIDEO_BATCH_CONCURRENCY = Math.max(1, Number(process.env.VIDEO_PHASE_CONCURRENCY ?? 3));
const QUEUE_GLOBAL_CONCURRENCY = Math.max(1, Number(process.env.INNGEST_JOB_CONCURRENCY ?? 5));

function chunkIndices(total: number, batchSize: number): number[][] {
  const chunks: number[][] = [];
  for (let i = 0; i < total; i += batchSize) {
    const batch: number[] = [];
    for (let j = i; j < Math.min(total, i + batchSize); j += 1) {
      batch.push(j);
    }
    chunks.push(batch);
  }
  return chunks;
}

export const imagePhaseFunction = inngest.createFunction(
  {
    id: "job-image-phase",
    name: "Photo-to-Video: Image Generation Phase",
    triggers: [jobImagesRequested],
    retries: 3,
    concurrency: [{ limit: QUEUE_GLOBAL_CONCURRENCY }],
    onFailure: async ({ event, error }) => {
      const jobId = event.data.event.data?.jobId;
      if (!jobId) return;
      const message = error?.message || "Image generation failed";
      await mutateJob(jobId, () => ({
        status: "failed",
        error: message,
      })).catch(() => {});
    },
  },
  async ({ event, step }) => {
    const { jobId } = event.data;

    const { imageCount } = await step.run("prepare-image-phase", async () => {
      const job = await getJob(jobId);
      if (!job) {
        throw new NonRetriableError(`Job ${jobId} was not found`);
      }
      if (job.status !== "running") {
        await mutateJob(jobId, () => ({ status: "running", error: undefined }));
      }
      return { imageCount: job.sourceImages.length };
    });

    for (const batch of chunkIndices(imageCount, IMAGE_BATCH_CONCURRENCY)) {
      await Promise.all(
        batch.map((index) =>
          step.run(`generate-frame-${index}`, () => processSingleImageFrame(jobId, index))
        )
      );
    }

    await step.run("mark-awaiting-review", async () => {
      const updated = await mutateJob(jobId, () => ({
        status: "awaiting_review",
        error: undefined,
      }));
      if (!updated) {
        throw new NonRetriableError(`Job ${jobId} disappeared during image phase`);
      }
      return { status: updated.status };
    });

    // Best-effort structural-consistency scoring after job is already reviewable.
    await Promise.all(
      Array.from({ length: imageCount }, (_, index) =>
        step.run(`judge-frame-${index}`, async () => {
          try {
            await judgeSingleImageFrame(jobId, index);
          } catch (error) {
            console.warn(
              `[inngest:judge] frame ${index} of job ${jobId} failed:`,
              error instanceof Error ? error.message : String(error)
            );
          }
          return { index, judged: true };
        })
      )
    );

    return { jobId, status: "awaiting_review", imageCount };
  }
);

export const videoPhaseFunction = inngest.createFunction(
  {
    id: "job-video-phase",
    name: "Photo-to-Video: Video Generation & FFmpeg Render Phase",
    triggers: [jobVideoRequested],
    retries: 3,
    concurrency: [{ limit: QUEUE_GLOBAL_CONCURRENCY }],
    onFailure: async ({ event, error }) => {
      const jobId = event.data.event.data?.jobId;
      if (!jobId) return;
      const message = error?.message || "Video generation failed";
      await mutateJob(jobId, () => ({
        status: "failed",
        error: message,
      })).catch(() => {});
    },
  },
  async ({ event, step }) => {
    const { jobId } = event.data;

    const { clipCount } = await step.run("prepare-video-phase", async () => {
      const job = await getJob(jobId);
      if (!job) {
        throw new NonRetriableError(`Job ${jobId} was not found`);
      }
      if (job.status !== "running") {
        await mutateJob(jobId, () => ({ status: "running", error: undefined }));
      }
      return { clipCount: job.sourceImages.length };
    });

    const maxPolls = Math.max(1, Number(process.env.KLING_POLL_ATTEMPTS ?? 120));
    const pollIntervalSec = Math.max(
      5,
      Math.round(Number(process.env.KLING_POLL_INTERVAL_MS ?? 5000) / 1000)
    );

    for (const batch of chunkIndices(clipCount, VIDEO_BATCH_CONCURRENCY)) {
      await Promise.all(
        batch.map(async (index) => {
          const submitted = await step.run(`submit-clip-${index}`, () =>
            submitClipGenerationStep(jobId, index)
          );

          if (submitted.skipped || submitted.kind === "placeholder") {
            return;
          }

          let videoUrl: string | null = null;

          for (let attempt = 0; attempt < maxPolls; attempt += 1) {
            // Durable sleep consumes ZERO Vercel compute time while Kling renders.
            await step.sleep(`wait-clip-${index}-poll-${attempt}`, `${pollIntervalSec}s`);

            const pollResult = await step.run(`poll-clip-${index}-${attempt}`, async () => {
              const res = await checkKlingClipTaskOnce(submitted.provider, submitted.taskId);
              if (res.status === "failed") {
                throw new NonRetriableError(res.error);
              }
              return res;
            });

            if (pollResult.status === "succeed") {
              videoUrl = pollResult.videoUrl;
              break;
            }
          }

          if (!videoUrl) {
            throw new NonRetriableError(`Kling task ${submitted.taskId} timed out after ${maxPolls} polls`);
          }

          await step.run(`save-clip-${index}`, () =>
            finalizeClipDownloadStep(jobId, index, videoUrl!)
          );
        })
      );
    }

    const rendered = await step.run("render-final-video", () => finalizeVideoRenderStep(jobId));
    return { jobId, status: "complete", finalVideoPath: rendered.finalVideoPath };
  }
);

export const regenerateFrameFunction = inngest.createFunction(
  {
    id: "job-regenerate-frame",
    name: "Photo-to-Video: Regenerate Single Frame",
    triggers: [jobFrameRegenerateRequested],
    retries: 2,
    // Inngest Free plan caps per-function concurrency at 5.
    concurrency: [{ limit: QUEUE_GLOBAL_CONCURRENCY }],
    onFailure: async ({ event, error }) => {
      const data = event.data.event.data;
      if (!data?.jobId || typeof data.frameIndex !== "number") return;
      const message = error?.message || "Regeneration failed";
      const now = new Date().toISOString();
      await mutateJob(data.jobId, (current) => ({
        error: message,
        steps: current.steps.map((s) =>
          s.kind === "image" && s.index === data.frameIndex
            ? { ...s, status: "failed" as const, updatedAt: now }
            : s
        ),
      })).catch(() => {});
    },
  },
  async ({ event, step }) => {
    const { jobId, frameIndex, appendText } = event.data;

    await step.run("regenerate-frame", async () => {
      await regenerateFrame(jobId, frameIndex, appendText, { alreadyClaimed: true });
      return { jobId, frameIndex, regenerated: true };
    });

    return { jobId, frameIndex, status: "complete" };
  }
);

export const inngestFunctions = [
  imagePhaseFunction,
  videoPhaseFunction,
  regenerateFrameFunction,
];
