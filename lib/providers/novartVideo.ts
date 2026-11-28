import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_RETRYABLE_STATUSES, fetchWithRetry, isTransientFetchError } from "../http/fetchWithRetry";
import { createPlaceholderClip } from "../video/ffmpeg";

export type NovartVideoClipInput = {
  jobId: string;
  firstFramePath: string;
  lastFramePath: string;
  prompt: string;
  aspectRatio: string;
  clipSeconds: number;
  resolution?: string;
  outputPath: string;
};

export type NovartVideoSubmission =
  | { kind: "placeholder"; outputPath: string }
  | { kind: "remote"; taskId: string };

export type NovartVideoStatusCheck =
  | { status: "processing" }
  | { status: "succeed"; videoUrl: string }
  | { status: "failed"; error: string };

export type NovartVideoConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  durationSeconds?: number;
  resolution?: string;
  generateAudio: boolean;
};

type UnknownJson = Record<string, unknown>;

const TERMINAL_SUCCESS_STATUSES = new Set([
  "succeeded",
  "succeed",
  "completed",
  "complete",
  "done",
  "finished",
  "success"
]);

const TERMINAL_FAILURE_STATUSES = new Set([
  "failed",
  "fail",
  "error",
  "cancelled",
  "canceled",
  "expired",
  "rejected"
]);

const IN_PROGRESS_STATUSES = new Set([
  "queued",
  "pending",
  "submitted",
  "running",
  "processing",
  "in_progress",
  "starting",
  "created"
]);

function allowPreviewFallback(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_PREVIEW_FALLBACK === "true";
}

function parseAudioFlag(env: Record<string, string | undefined>): boolean {
  const sound = env.KLING_SOUND?.trim().toLowerCase();
  if (sound) {
    return !["off", "false", "0", "no"].includes(sound);
  }
  const nativeAudio = env.KLING_NATIVE_AUDIO?.trim().toLowerCase();
  if (nativeAudio) {
    return ["true", "1", "yes", "on"].includes(nativeAudio);
  }
  return true;
}

/**
 * Resolve Novart video configuration from env.
 * Falls back to IMAGE_BASE_URL / IMAGE_API_KEY so a single Novart API key can
 * drive both image and video generation without duplicating secrets.
 * Deliberately ignores KLING_ACCESS_KEY / KLING_SECRET_KEY (official Kling JWT).
 */
export function getNovartVideoConfig(
  env: Record<string, string | undefined> = process.env
): NovartVideoConfig | null {
  const baseUrl = (env.KLING_API_BASE_URL || env.IMAGE_BASE_URL || "").trim().replace(/\/$/, "");
  const apiKey = (env.KLING_API_KEY || env.IMAGE_API_KEY || "").trim();
  if (!baseUrl || !apiKey) {
    return null;
  }

  const parsedDuration = Number(env.KLING_DURATION_SECONDS);
  const durationSeconds =
    Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : undefined;

  return {
    baseUrl,
    apiKey,
    model: (env.KLING_MODEL || "nova-video-k-3").trim(),
    durationSeconds,
    resolution: env.KLING_RESOLUTION?.trim() || undefined,
    generateAudio: parseAudioFlag(env)
  };
}

export function normalizeNovartVideoAspectRatio(aspectRatio: string, model: string): string {
  const trimmed = aspectRatio.trim();
  const isKlingSeries = model.startsWith("nova-video-k-");

  if (!isKlingSeries) {
    const allowedGeneral = new Set(["16:9", "9:16", "4:3", "3:4", "1:1", "21:9"]);
    if (allowedGeneral.has(trimmed)) {
      return trimmed;
    }
  }

  if (trimmed === "16:9" || trimmed === "9:16") {
    return trimmed;
  }

  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  if (match) {
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return width < height ? "9:16" : "16:9";
    }
  }

  return "16:9";
}

export function normalizeNovartVideoResolution(
  resolution: string | undefined,
  model: string
): string {
  const normalized = (resolution ?? "").trim().toLowerCase();

  if (model === "nova-video-s-2-fast-pro") {
    return normalized === "480p" ? "480p" : "720p";
  }

  if (model === "nova-video-s-2-5-pro") {
    if (normalized === "480p" || normalized === "720p" || normalized === "1080p") {
      return normalized;
    }
    return "1080p";
  }

  if (model === "nova-video-s-2-pro") {
    if (normalized === "720p" || normalized === "1080p" || normalized === "4k") {
      return normalized;
    }
    return "1080p";
  }

  // nova-video-k-3 / nova-video-k-o3 support ["720p", "1080p"].
  return normalized === "720p" ? "720p" : "1080p";
}

export function normalizeNovartVideoDuration(seconds: number, model: string): string {
  const minSeconds = model.startsWith("nova-video-s-") ? 4 : 3;
  const maxSeconds = model === "nova-video-s-2-5-pro" ? 30 : 15;
  const raw = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : minSeconds;
  const clamped = Math.min(maxSeconds, Math.max(minSeconds, raw));
  return `${clamped}s`;
}

export function buildNovartVideoRequestBody(params: {
  model: string;
  prompt: string;
  firstFrameDataUri: string;
  lastFrameDataUri: string;
  aspectRatio: string;
  durationSeconds: number;
  resolution?: string;
  generateAudio: boolean;
}): UnknownJson {
  const maxPromptChars = params.model.startsWith("nova-video-s-") ? 5000 : 2500;
  return {
    model: params.model,
    prompt: params.prompt.slice(0, maxPromptChars),
    reference_images: [params.firstFrameDataUri, params.lastFrameDataUri],
    duration: normalizeNovartVideoDuration(params.durationSeconds, params.model),
    resolution: normalizeNovartVideoResolution(params.resolution, params.model),
    aspect_ratio: normalizeNovartVideoAspectRatio(params.aspectRatio, params.model),
    generate_audio: params.generateAudio
  };
}

export function extractNovartVideoTaskId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  return findString(payload as UnknownJson, [
    "task_id",
    "id",
    "data.task_id",
    "data.id",
    "task.task_id",
    "task.id",
    "novart.task_id",
    "novart.id"
  ]);
}

export function extractNovartVideoUrl(payload: unknown, baseUrl: string): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const obj = payload as UnknownJson;

  // Prefer signed_download_url when available; otherwise pick url / download_url from standard result arrays.
  const arrayCandidates: unknown[] = [
    obj.data,
    obj.results,
    getNested(obj, "data.results"),
    getNested(obj, "data.videos"),
    getNested(obj, "novart.results"),
    getNested(obj, "task.results")
  ];

  for (const candidate of arrayCandidates) {
    if (!Array.isArray(candidate) || candidate.length === 0) continue;
    const first = candidate[0];
    if (first && typeof first === "object") {
      const raw = findString(first as UnknownJson, [
        "signed_download_url",
        "url",
        "download_url",
        "video_url"
      ]);
      if (raw) return resolveUrlAgainstBase(raw, baseUrl);
    }
  }

  const direct = findString(obj, [
    "signed_download_url",
    "video_url",
    "download_url",
    "url",
    "data.signed_download_url",
    "data.video_url",
    "data.download_url",
    "data.url",
    "output.signed_download_url",
    "output.video_url",
    "output.url",
    "result.signed_download_url",
    "result.video_url",
    "result.url"
  ]);
  return direct ? resolveUrlAgainstBase(direct, baseUrl) : undefined;
}

/**
 * Novart `/v1/files/videos/...` endpoints require the API key Bearer header,
 * whereas external presigned URLs (S3/OSS/R2) reject extra Authorization headers.
 * Attach Authorization only when downloading from the same origin as the Novart API.
 */
export function getNovartDownloadHeaders(
  videoUrl: string,
  env: Record<string, string | undefined> = process.env
): Record<string, string> {
  const config = getNovartVideoConfig(env);
  if (!config) return {};

  try {
    const targetOrigin = new URL(videoUrl).origin;
    const apiOrigin = new URL(config.baseUrl).origin;
    if (targetOrigin === apiOrigin) {
      return { Authorization: `Bearer ${config.apiKey}` };
    }
  } catch {
    return {};
  }

  return {};
}

export async function submitNovartVideoTask(
  input: NovartVideoClipInput
): Promise<NovartVideoSubmission> {
  await mkdir(path.dirname(input.outputPath), { recursive: true });

  const config = getNovartVideoConfig();
  if (!config) {
    if (!allowPreviewFallback()) {
      throw new Error(
        "Novart video credentials or base URL are not configured in production. Set KLING_API_BASE_URL/KLING_API_KEY (or IMAGE_BASE_URL/IMAGE_API_KEY)."
      );
    }
    const outputPath = await createPlaceholderClip({
      imagePath: input.lastFramePath,
      outputPath: input.outputPath,
      durationSeconds: input.clipSeconds
    });
    return { kind: "placeholder", outputPath };
  }

  const [firstFrameDataUri, lastFrameDataUri] = await Promise.all([
    readFrameAsDataUri(input.firstFramePath),
    readFrameAsDataUri(input.lastFramePath)
  ]);

  const requestBody = buildNovartVideoRequestBody({
    model: config.model,
    prompt: input.prompt,
    firstFrameDataUri,
    lastFrameDataUri,
    aspectRatio: input.aspectRatio,
    durationSeconds: config.durationSeconds ?? input.clipSeconds,
    resolution: config.resolution ?? input.resolution,
    generateAudio: config.generateAudio
  });

  const createResponse = await fetchWithRetry(
    `${config.baseUrl}/videos/generations`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    },
    {
      timeoutMs: 120_000,
      maxAttempts: 3,
      baseDelayMs: 3000,
      label: "novartVideo:create"
    }
  );

  if (!createResponse.ok) {
    throw new Error(
      `Novart video task creation failed (${createResponse.status}): ${(await createResponse.text()).slice(0, 500)}`
    );
  }

  const created = (await createResponse.json()) as UnknownJson;
  const taskId = extractNovartVideoTaskId(created);
  if (!taskId) {
    throw new Error(`Novart video endpoint did not return a task id. Response: ${JSON.stringify(created).slice(0, 400)}`);
  }

  return { kind: "remote", taskId };
}

export type CheckNovartVideoOptions = {
  config?: NovartVideoConfig;
  fetchImpl?: typeof fetch;
};

export async function checkNovartVideoTaskOnce(
  taskId: string,
  options: CheckNovartVideoOptions = {}
): Promise<NovartVideoStatusCheck> {
  const config = options.config ?? getNovartVideoConfig();
  if (!config) {
    throw new Error("Novart video credentials or base URL became unavailable during polling");
  }

  const response = await fetchWithRetry(
    `${config.baseUrl}/videos/${encodeURIComponent(taskId)}`,
    {
      headers: { Authorization: `Bearer ${config.apiKey}` }
    },
    {
      timeoutMs: 30_000,
      maxAttempts: 2,
      baseDelayMs: 1000,
      fetchImpl: options.fetchImpl,
      label: "novartVideo:pollOnce"
    }
  );

  if (!response.ok) {
    throw new Error(
      `Novart video status failed (${response.status}): ${(await response.text()).slice(0, 400)}`
    );
  }

  const payload = (await response.json()) as UnknownJson;
  const rawStatus = findString(payload, [
    "status",
    "task_status",
    "state",
    "data.status",
    "data.task_status",
    "data.state",
    "task.status",
    "novart.status"
  ]);
  const normalizedStatus = rawStatus?.trim().toLowerCase();

  if (normalizedStatus && TERMINAL_FAILURE_STATUSES.has(normalizedStatus)) {
    const errorMessage =
      findString(payload, [
        "error.message",
        "error",
        "message",
        "fail_reason",
        "task_status_msg",
        "data.error.message",
        "data.error",
        "data.message",
        "data.fail_reason",
        "data.task_status_msg",
        "task.error.message",
        "task.error"
      ]) ?? `Novart video task ${normalizedStatus}`;
    return { status: "failed", error: errorMessage };
  }

  if (normalizedStatus && IN_PROGRESS_STATUSES.has(normalizedStatus)) {
    return { status: "processing" };
  }

  const directUrl = extractNovartVideoUrl(payload, config.baseUrl);
  if (directUrl) {
    return { status: "succeed", videoUrl: directUrl };
  }

  if (normalizedStatus && TERMINAL_SUCCESS_STATUSES.has(normalizedStatus)) {
    const resultsResponse = await fetchWithRetry(
      `${config.baseUrl}/videos/${encodeURIComponent(taskId)}/results`,
      {
        headers: { Authorization: `Bearer ${config.apiKey}` }
      },
      {
        timeoutMs: 30_000,
        maxAttempts: 2,
        baseDelayMs: 1000,
        fetchImpl: options.fetchImpl,
        label: "novartVideo:results"
      }
    );

    if (resultsResponse.ok) {
      const resultsPayload = (await resultsResponse.json()) as UnknownJson;
      const resultUrl = extractNovartVideoUrl(resultsPayload, config.baseUrl);
      if (resultUrl) {
        return { status: "succeed", videoUrl: resultUrl };
      }
    }

    return {
      status: "succeed",
      videoUrl: `${config.baseUrl}/files/videos/${encodeURIComponent(taskId)}/results/0/content`
    };
  }

  return { status: "processing" };
}

export type PollNovartVideoOptions = {
  attempts?: number;
  intervalMs?: number;
  maxConsecutiveErrors?: number;
  config?: NovartVideoConfig;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
};

export async function pollNovartVideoTask(
  taskId: string,
  options: PollNovartVideoOptions = {}
): Promise<string> {
  const attempts = options.attempts ?? Number(process.env.KLING_POLL_ATTEMPTS ?? 120);
  const intervalMs = options.intervalMs ?? Number(process.env.KLING_POLL_INTERVAL_MS ?? 5000);
  const maxConsecutiveErrors = options.maxConsecutiveErrors ?? 8;
  const sleepFn = options.sleepImpl ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  let consecutiveErrors = 0;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const check = await checkNovartVideoTaskOnce(taskId, {
        config: options.config,
        fetchImpl: options.fetchImpl
      });
      consecutiveErrors = 0;

      if (check.status === "failed") {
        throw new Error(check.error);
      }
      if (check.status === "succeed") {
        return check.videoUrl;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusMatch = message.match(/status failed \((\d{3})\)/);
      const statusCode = statusMatch ? Number(statusMatch[1]) : undefined;
      const isRetryableStatus =
        statusCode !== undefined &&
        DEFAULT_RETRYABLE_STATUSES.includes(statusCode as (typeof DEFAULT_RETRYABLE_STATUSES)[number]);

      if (isTransientFetchError(error) || isRetryableStatus) {
        consecutiveErrors += 1;
        console.warn(
          `[novartVideo:poll] task ${taskId} transient error (${consecutiveErrors}/${maxConsecutiveErrors}): ${message}`
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

  throw new Error(`Novart video task ${taskId} timed out after ${attempts} polls`);
}

export async function downloadNovartVideo(
  videoUrl: string,
  outputPath: string,
  env: Record<string, string | undefined> = process.env
): Promise<string> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const headers = getNovartDownloadHeaders(videoUrl, env);
  const videoResponse = await fetchWithRetry(
    videoUrl,
    { headers },
    {
      timeoutMs: 90_000,
      maxAttempts: 3,
      baseDelayMs: 2000,
      label: "novartVideo:download"
    }
  );
  if (!videoResponse.ok) {
    throw new Error(`Novart video download failed (${videoResponse.status}): ${videoUrl}`);
  }

  await writeFile(outputPath, Buffer.from(await videoResponse.arrayBuffer()));
  return outputPath;
}

export async function generateNovartVideoClip(input: NovartVideoClipInput): Promise<string> {
  const submission = await submitNovartVideoTask(input);
  if (submission.kind === "placeholder") {
    return submission.outputPath;
  }

  const videoUrl = await pollNovartVideoTask(submission.taskId);
  return downloadNovartVideo(videoUrl, input.outputPath);
}

async function readFrameAsDataUri(filePath: string): Promise<string> {
  const data = await readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${data.toString("base64")}`;
}

function resolveUrlAgainstBase(rawUrl: string, baseUrl: string): string {
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return rawUrl;
  }
  const origin = new URL(baseUrl).origin;
  return new URL(rawUrl, origin).toString();
}

function getNested(payload: UnknownJson, keyPath: string): unknown {
  return keyPath.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as UnknownJson)[key];
  }, payload);
}

function findString(payload: UnknownJson, paths: string[]): string | undefined {
  for (const keyPath of paths) {
    const value = getNested(payload, keyPath);
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}
