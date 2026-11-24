import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_RETRYABLE_STATUSES, fetchWithRetry, isTransientFetchError } from "../http/fetchWithRetry";
import { createPlaceholderClip } from "../video/ffmpeg";
import { buildKlingAuthorization } from "./klingAuth";
import { checkKlingSkillTaskOnce, generateKlingSkillClip, submitKlingSkillTask } from "./klingSkill";

export type GenerateKlingClipInput = {
  jobId: string;
  firstFramePath: string;
  lastFramePath: string;
  prompt: string;
  aspectRatio: string;
  clipSeconds: number;
  outputPath: string;
};

export type KlingProviderKind = "image2video" | "skill";

export type KlingSubmissionResult =
  | { kind: "placeholder"; outputPath: string }
  | { kind: "remote"; provider: KlingProviderKind; taskId: string };

export type KlingPollStepResult =
  | { status: "processing" }
  | { status: "succeed"; videoUrl: string }
  | { status: "failed"; error: string };

function allowPreviewFallback(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_PREVIEW_FALLBACK === "true";
}

function getFreshKlingAuthorization(): string | undefined {
  return buildKlingAuthorization({
    apiKey: process.env.KLING_API_KEY,
    accessKey: process.env.KLING_ACCESS_KEY,
    secretKey: process.env.KLING_SECRET_KEY
  });
}

/**
 * Submit a Kling clip generation task without blocking to poll.
 * Used by durable Inngest steps so polling sleeps consume zero serverless compute time.
 */
export async function submitKlingClipTask(
  input: GenerateKlingClipInput
): Promise<KlingSubmissionResult> {
  await mkdir(path.dirname(input.outputPath), { recursive: true });

  const initialAuth = getFreshKlingAuthorization();

  if (!initialAuth || !process.env.KLING_API_BASE_URL) {
    if (!allowPreviewFallback()) {
      throw new Error(
        "Kling credentials or KLING_API_BASE_URL are not configured in production."
      );
    }
    const outputPath = await createPlaceholderClip({
      imagePath: input.lastFramePath,
      outputPath: input.outputPath,
      durationSeconds: input.clipSeconds
    });
    return { kind: "placeholder", outputPath };
  }

  if ((process.env.KLING_PROVIDER ?? "image2video") === "skill") {
    const skillSub = await submitKlingSkillTask(input, getFreshKlingAuthorization);
    if (skillSub.kind === "placeholder") {
      return skillSub;
    }
    return { kind: "remote", provider: "skill", taskId: skillSub.taskId };
  }

  const imageBase64 = await readFrameAsBase64(input.firstFramePath);
  const imageTailBase64 = await readFrameAsBase64(input.lastFramePath);
  const baseUrl = process.env.KLING_API_BASE_URL.replace(/\/$/, "");

  const createResponse = await fetchWithRetry(
    `${baseUrl}/v1/videos/image2video`,
    {
      method: "POST",
      headers: {
        Authorization: getFreshKlingAuthorization() ?? initialAuth,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model_name: process.env.KLING_MODEL ?? "kling-v3",
        prompt: input.prompt,
        duration: String(process.env.KLING_DURATION_SECONDS ?? input.clipSeconds),
        aspect_ratio: input.aspectRatio,
        mode: process.env.KLING_MODE ?? "pro",
        sound: process.env.KLING_SOUND ?? "on",
        image: imageBase64,
        image_tail: imageTailBase64,
        negative_prompt:
          "jitter, flicker, warped furniture, distorted architecture, people, logos, text, melting objects"
      })
    },
    {
      timeoutMs: 120_000,
      maxAttempts: 3,
      baseDelayMs: 3000,
      label: "kling:create"
    }
  );

  if (!createResponse.ok) {
    throw new Error(`Kling task creation failed (${createResponse.status}): ${(await createResponse.text()).slice(0, 500)}`);
  }

  const created = (await createResponse.json()) as {
    data?: { task_id?: string };
    task_id?: string;
    id?: string;
  };
  const taskId = created.data?.task_id ?? created.task_id ?? created.id;
  if (!taskId) {
    throw new Error("Kling did not return a task id");
  }

  return { kind: "remote", provider: "image2video", taskId };
}

/**
 * Single non-blocking status check for a previously submitted Kling task.
 */
export async function checkKlingClipTaskOnce(
  provider: KlingProviderKind,
  taskId: string
): Promise<KlingPollStepResult> {
  if (provider === "skill") {
    return checkKlingSkillTaskOnce(taskId, getFreshKlingAuthorization);
  }

  const baseUrl = process.env.KLING_API_BASE_URL?.replace(/\/$/, "");
  const authHeader = getFreshKlingAuthorization();
  if (!baseUrl || !authHeader) {
    throw new Error("Kling authorization or KLING_API_BASE_URL became unavailable during polling");
  }

  const response = await fetchWithRetry(
    `${baseUrl}/v1/videos/image2video/${encodeURIComponent(taskId)}`,
    {
      headers: { Authorization: authHeader }
    },
    {
      timeoutMs: 30_000,
      maxAttempts: 2,
      baseDelayMs: 1000,
      label: "kling:pollOnce"
    }
  );

  if (!response.ok) {
    throw new Error(`Kling status failed (${response.status}): ${(await response.text()).slice(0, 400)}`);
  }

  const payload = (await response.json()) as {
    data?: {
      task_status?: string;
      task_status_msg?: string;
      task_result?: { videos?: Array<{ url?: string }> };
    };
    status?: string;
    video_url?: string;
    error?: string;
  };

  const status = payload.data?.task_status ?? payload.status;
  if (status === "failed") {
    return {
      status: "failed",
      error: payload.data?.task_status_msg ?? payload.error ?? "Kling task failed"
    };
  }

  const videoUrl = payload.data?.task_result?.videos?.[0]?.url ?? payload.video_url;
  if (videoUrl) {
    return { status: "succeed", videoUrl };
  }

  return { status: "processing" };
}

/**
 * Download a completed Kling video URL to a local output path.
 */
export async function downloadKlingVideo(videoUrl: string, outputPath: string): Promise<string> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const videoResponse = await fetchWithRetry(
    videoUrl,
    {},
    {
      timeoutMs: 90_000,
      maxAttempts: 3,
      baseDelayMs: 2000,
      label: "kling:download"
    }
  );
  if (!videoResponse.ok) {
    throw new Error(`Kling video download failed: ${videoResponse.status}`);
  }

  await writeFile(outputPath, Buffer.from(await videoResponse.arrayBuffer()));
  return outputPath;
}

export async function generateKlingClip(input: GenerateKlingClipInput): Promise<string> {
  if ((process.env.KLING_PROVIDER ?? "image2video") === "skill") {
    return generateKlingSkillClip(input, getFreshKlingAuthorization);
  }

  const submission = await submitKlingClipTask(input);
  if (submission.kind === "placeholder") {
    return submission.outputPath;
  }

  const baseUrl = process.env.KLING_API_BASE_URL!.replace(/\/$/, "");
  const videoUrl = await pollKlingTask(baseUrl, submission.taskId, getFreshKlingAuthorization);
  return downloadKlingVideo(videoUrl, input.outputPath);
}

export type PollKlingOptions = {
  attempts?: number;
  intervalMs?: number;
  maxConsecutiveErrors?: number;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
};

export async function pollKlingTask(
  baseUrl: string,
  taskId: string,
  authorization: string | (() => string | undefined),
  options: PollKlingOptions = {}
): Promise<string> {
  const attempts = options.attempts ?? Number(process.env.KLING_POLL_ATTEMPTS ?? 120);
  const intervalMs = options.intervalMs ?? Number(process.env.KLING_POLL_INTERVAL_MS ?? 5000);
  const maxConsecutiveErrors = options.maxConsecutiveErrors ?? 8;
  const fetchFn = options.fetchImpl ?? fetch;
  const sleepFn = options.sleepImpl ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  let consecutiveErrors = 0;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const authHeader = typeof authorization === "function" ? authorization() : authorization;
    if (!authHeader) {
      throw new Error("Kling authorization became unavailable during polling");
    }

    try {
      const response = await fetchFn(`${baseUrl}/v1/videos/image2video/${encodeURIComponent(taskId)}`, {
        signal: AbortSignal.timeout(30_000),
        headers: { Authorization: authHeader }
      });

      if (!response.ok) {
        const body = (await response.text()).slice(0, 400);
        if (DEFAULT_RETRYABLE_STATUSES.includes(response.status as (typeof DEFAULT_RETRYABLE_STATUSES)[number])) {
          consecutiveErrors += 1;
          console.warn(
            `[kling:poll] task ${taskId} transient HTTP ${response.status} (${consecutiveErrors}/${maxConsecutiveErrors}): ${body}`
          );
          if (consecutiveErrors >= maxConsecutiveErrors) {
            throw new Error(`Kling status failed repeatedly (${response.status}): ${body}`);
          }
          await sleepFn(intervalMs);
          continue;
        }
        throw new Error(`Kling status failed (${response.status}): ${body}`);
      }

      consecutiveErrors = 0;

      const payload = (await response.json()) as {
        data?: {
          task_status?: string;
          task_status_msg?: string;
          task_result?: { videos?: Array<{ url?: string }> };
        };
        status?: string;
        video_url?: string;
        error?: string;
      };

      const status = payload.data?.task_status ?? payload.status;
      if (status === "failed") {
        throw new Error(payload.data?.task_status_msg ?? payload.error ?? "Kling task failed");
      }

      // Official response: data.task_result.videos[0].url
      const videoUrl =
        payload.data?.task_result?.videos?.[0]?.url ??
        payload.video_url;

      if (videoUrl) {
        return videoUrl;
      }
    } catch (error) {
      if (isTransientFetchError(error)) {
        consecutiveErrors += 1;
        console.warn(
          `[kling:poll] task ${taskId} transient network error (${consecutiveErrors}/${maxConsecutiveErrors}): ${error instanceof Error ? error.message : String(error)}`
        );
        if (consecutiveErrors >= maxConsecutiveErrors) {
          throw error;
        }
      } else {
        throw error;
      }
    }

    await sleepFn(intervalMs);
  }

  throw new Error("Kling task timed out");
}

async function readFrameAsBase64(filePath: string): Promise<string> {
  const data = await readFile(filePath);
  return data.toString("base64");
}
