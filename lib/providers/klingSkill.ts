import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_RETRYABLE_STATUSES, fetchWithRetry, isTransientFetchError } from "../http/fetchWithRetry";
import { getStorageObjectKeyForWorkflowFile } from "../jobs/publicAsset";
import { getSignedUrl } from "../jobs/storage";
import { isR2Configured } from "../cloudflare/config";
import { createPlaceholderClip } from "../video/ffmpeg";

type GenerateKlingSkillClipInput = {
  jobId: string;
  firstFramePath: string;
  lastFramePath: string;
  prompt: string;
  aspectRatio: string;
  clipSeconds: number;
  outputPath: string;
};

type SkillTemplateValues = {
  effectScene: string;
  model?: string;
  resolution?: string;
  nativeAudio?: boolean;
  audioSync?: boolean;
  firstFrameUrl: string;
  lastFrameUrl: string;
  prompt: string;
  clipSeconds: number;
  aspectRatio: string;
};

type UnknownJson = Record<string, unknown>;
type AuthProvider = string | (() => string | undefined);

function allowPreviewFallback(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_PREVIEW_FALLBACK === "true";
}

function resolveAuth(authorization?: AuthProvider): string | undefined {
  return typeof authorization === "function" ? authorization() : authorization;
}

export type KlingSkillSubmission =
  | { kind: "placeholder"; outputPath: string }
  | { kind: "remote"; taskId: string };

export type KlingSkillStatusCheck =
  | { status: "processing" }
  | { status: "succeed"; videoUrl: string }
  | { status: "failed"; error: string };

export async function submitKlingSkillTask(
  input: GenerateKlingSkillClipInput,
  authorization?: AuthProvider
): Promise<KlingSkillSubmission> {
  await mkdir(path.dirname(input.outputPath), { recursive: true });

  const initialAuth = resolveAuth(authorization);
  if (!initialAuth || !process.env.KLING_API_BASE_URL) {
    if (!allowPreviewFallback()) {
      throw new Error("Kling Skill credentials or KLING_API_BASE_URL are not configured in production.");
    }
    const outputPath = await createPlaceholderClip({
      imagePath: input.lastFramePath,
      outputPath: input.outputPath,
      durationSeconds: input.clipSeconds
    });
    return { kind: "placeholder", outputPath };
  }

  const firstFrameUrl = await resolvePublicFrameUrl(input.firstFramePath, input.jobId);
  const lastFrameUrl = await resolvePublicFrameUrl(input.lastFramePath, input.jobId);
  const effectScene = process.env.KLING_SKILL_EFFECT_SCENE ?? process.env.KLING_SKILL_ID ?? "";
  if (!effectScene && !process.env.KLING_SKILL_REQUEST_TEMPLATE) {
    throw new Error("Kling Skill mode needs KLING_SKILL_EFFECT_SCENE or KLING_SKILL_REQUEST_TEMPLATE.");
  }

  const baseUrl = process.env.KLING_API_BASE_URL.replace(/\/$/, "");
  const createUrl = buildUrl(baseUrl, process.env.KLING_SKILL_CREATE_PATH ?? "/v1/videos/effects");
  const requestBody = process.env.KLING_SKILL_REQUEST_TEMPLATE
    ? fillKlingSkillTemplate(process.env.KLING_SKILL_REQUEST_TEMPLATE, {
        effectScene,
        model: process.env.KLING_MODEL ?? "video-3.0-omni",
        resolution: process.env.KLING_RESOLUTION ?? "1080p",
        nativeAudio: parseBooleanEnv(process.env.KLING_NATIVE_AUDIO, true),
        audioSync: parseBooleanEnv(process.env.KLING_AUDIO_SYNC, true),
        firstFrameUrl,
        lastFrameUrl,
        prompt: input.prompt,
        clipSeconds: input.clipSeconds,
        aspectRatio: input.aspectRatio
      })
    : buildKlingSkillRequestBody({
        effectScene,
        model: process.env.KLING_MODEL ?? "video-3.0-omni",
        resolution: process.env.KLING_RESOLUTION ?? "1080p",
        nativeAudio: parseBooleanEnv(process.env.KLING_NATIVE_AUDIO, true),
        audioSync: parseBooleanEnv(process.env.KLING_AUDIO_SYNC, true),
        firstFrameUrl,
        lastFrameUrl,
        prompt: input.prompt,
        clipSeconds: input.clipSeconds,
        aspectRatio: input.aspectRatio
      });

  const createResponse = await fetchWithRetry(
    createUrl,
    {
      method: "POST",
      headers: {
        Authorization: resolveAuth(authorization) ?? initialAuth,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    },
    {
      timeoutMs: 120_000,
      maxAttempts: 3,
      baseDelayMs: 3000,
      label: "klingSkill:create"
    }
  );

  if (!createResponse.ok) {
    throw new Error(`Kling Skill task creation failed (${createResponse.status}): ${(await createResponse.text()).slice(0, 500)}`);
  }

  const created = (await createResponse.json()) as UnknownJson;
  const taskId = findString(created, ["task_id", "id", "data.task_id", "data.id"]);
  if (!taskId) {
    throw new Error("Kling Skill did not return a task id");
  }

  return { kind: "remote", taskId };
}

export async function checkKlingSkillTaskOnce(
  taskId: string,
  authorization?: AuthProvider
): Promise<KlingSkillStatusCheck> {
  const baseUrl = process.env.KLING_API_BASE_URL?.replace(/\/$/, "");
  const authHeader = resolveAuth(authorization);
  if (!baseUrl || !authHeader) {
    throw new Error("Kling Skill authorization or KLING_API_BASE_URL is unavailable");
  }

  const statusPath = process.env.KLING_SKILL_STATUS_PATH ?? "/v1/videos/{task_id}";
  const response = await fetchWithRetry(
    buildUrl(baseUrl, statusPath.replace("{task_id}", encodeURIComponent(taskId))),
    {
      headers: { Authorization: authHeader }
    },
    {
      timeoutMs: 30_000,
      maxAttempts: 2,
      baseDelayMs: 1000,
      label: "klingSkill:pollOnce"
    }
  );

  if (!response.ok) {
    throw new Error(`Kling Skill status failed (${response.status}): ${(await response.text()).slice(0, 400)}`);
  }

  const payload = (await response.json()) as UnknownJson;
  const status = findString(payload, ["status", "data.status"]);
  if (status === "failed") {
    return {
      status: "failed",
      error: findString(payload, ["error", "message", "data.error", "data.message"]) ?? "Kling Skill task failed"
    };
  }

  const videoUrl = findString(payload, [
    "video_url",
    "url",
    "output.video_url",
    "output.url",
    "result.video_url",
    "result.url",
    "data.video_url",
    "data.url",
    "data.output.video_url",
    "data.output.url",
    "data.result.video_url",
    "data.result.url"
  ]);
  if (videoUrl) {
    return { status: "succeed", videoUrl };
  }
  return { status: "processing" };
}

export async function generateKlingSkillClip(
  input: GenerateKlingSkillClipInput,
  authorization?: AuthProvider
): Promise<string> {
  const submission = await submitKlingSkillTask(input, authorization);
  if (submission.kind === "placeholder") {
    return submission.outputPath;
  }

  const baseUrl = process.env.KLING_API_BASE_URL!.replace(/\/$/, "");
  const initialAuth = resolveAuth(authorization)!;
  const videoUrl = await pollKlingSkillTask(baseUrl, submission.taskId, authorization ?? initialAuth);
  const videoResponse = await fetchWithRetry(
    videoUrl,
    {},
    {
      timeoutMs: 90_000,
      maxAttempts: 3,
      baseDelayMs: 2000,
      label: "klingSkill:download"
    }
  );
  if (!videoResponse.ok) {
    throw new Error(`Kling Skill video download failed: ${videoResponse.status}`);
  }

  await copyFileLike(videoResponse, input.outputPath);
  return input.outputPath;
}

export function buildKlingSkillRequestBody(values: SkillTemplateValues): UnknownJson {
  return {
    effect_scene: values.effectScene,
    model: values.model,
    resolution: values.resolution,
    input: {
      image: values.firstFrameUrl,
      image_tail: values.lastFrameUrl
    },
    prompt: values.prompt,
    duration: values.clipSeconds,
    aspect_ratio: values.aspectRatio,
    native_audio: values.nativeAudio,
    audio_sync: values.audioSync
  };
}

export function fillKlingSkillTemplate(template: string, values: SkillTemplateValues): UnknownJson {
  const replacements: Record<string, string> = {
    effectScene: values.effectScene,
    model: values.model ?? "",
    resolution: values.resolution ?? "",
    nativeAudio: String(values.nativeAudio ?? true),
    audioSync: String(values.audioSync ?? true),
    firstFrameUrl: values.firstFrameUrl,
    lastFrameUrl: values.lastFrameUrl,
    prompt: values.prompt,
    clipSeconds: String(values.clipSeconds),
    aspectRatio: values.aspectRatio
  };

  const filled = Object.entries(replacements).reduce(
    (body, [key, value]) => body.replaceAll(`{{${key}}}`, value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')),
    template
  );
  return JSON.parse(filled) as UnknownJson;
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") {
    return fallback;
  }
  return value === "true" || value === "1" || value === "yes";
}

async function pollKlingSkillTask(
  baseUrl: string,
  taskId: string,
  authorization: AuthProvider
): Promise<string> {
  const attempts = Number(process.env.KLING_POLL_ATTEMPTS ?? 120);
  const intervalMs = Number(process.env.KLING_POLL_INTERVAL_MS ?? 5000);
  const statusPath = process.env.KLING_SKILL_STATUS_PATH ?? "/v1/videos/{task_id}";
  const maxConsecutiveErrors = 8;

  let consecutiveErrors = 0;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const authHeader = resolveAuth(authorization);
    if (!authHeader) {
      throw new Error("Kling Skill authorization became unavailable during polling");
    }

    try {
      const response = await fetch(buildUrl(baseUrl, statusPath.replace("{task_id}", encodeURIComponent(taskId))), {
        signal: AbortSignal.timeout(30_000),
        headers: { Authorization: authHeader }
      });

      if (!response.ok) {
        const body = (await response.text()).slice(0, 400);
        if (DEFAULT_RETRYABLE_STATUSES.includes(response.status as (typeof DEFAULT_RETRYABLE_STATUSES)[number])) {
          consecutiveErrors += 1;
          console.warn(
            `[klingSkill:poll] task ${taskId} transient HTTP ${response.status} (${consecutiveErrors}/${maxConsecutiveErrors}): ${body}`
          );
          if (consecutiveErrors >= maxConsecutiveErrors) {
            throw new Error(`Kling Skill status failed repeatedly (${response.status}): ${body}`);
          }
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
          continue;
        }
        throw new Error(`Kling Skill status failed (${response.status}): ${body}`);
      }

      consecutiveErrors = 0;

      const payload = (await response.json()) as UnknownJson;
      const status = findString(payload, ["status", "data.status"]);
      if (status === "failed") {
        throw new Error(findString(payload, ["error", "message", "data.error", "data.message"]) ?? "Kling Skill task failed");
      }

      const videoUrl = findString(payload, [
        "video_url",
        "url",
        "output.video_url",
        "output.url",
        "result.video_url",
        "result.url",
        "data.video_url",
        "data.url",
        "data.output.video_url",
        "data.output.url",
        "data.result.video_url",
        "data.result.url"
      ]);
      if (videoUrl) {
        return videoUrl;
      }
    } catch (error) {
      if (isTransientFetchError(error)) {
        consecutiveErrors += 1;
        console.warn(
          `[klingSkill:poll] task ${taskId} transient network error (${consecutiveErrors}/${maxConsecutiveErrors}): ${error instanceof Error ? error.message : String(error)}`
        );
        if (consecutiveErrors >= maxConsecutiveErrors) {
          throw error;
        }
      } else {
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Kling Skill task timed out");
}

async function resolvePublicFrameUrl(filePath: string, jobId: string): Promise<string> {
  if (isR2Configured()) {
    const storageKey = getStorageObjectKeyForWorkflowFile(jobId, filePath);
    if (storageKey) {
      return getSignedUrl(storageKey);
    }
  }

  if (process.env.PUBLIC_ASSET_BASE_URL) {
    const base = process.env.PUBLIC_ASSET_BASE_URL.replace(/\/$/, "");
    return `${base}/api/jobs/${jobId}/assets/${path.basename(filePath)}`;
  }

  throw new Error(
    "Kling Skill needs public frame URLs. Set PUBLIC_ASSET_BASE_URL to your app's public base URL (e.g. https://your-tunnel.ngrok.io)."
  );
}

function buildUrl(baseUrl: string, pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  return `${baseUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

function findString(payload: UnknownJson, paths: string[]): string | undefined {
  for (const keyPath of paths) {
    const value = keyPath.split(".").reduce<unknown>((current, key) => {
      if (!current || typeof current !== "object") {
        return undefined;
      }
      return (current as UnknownJson)[key];
    }, payload);
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

async function copyFileLike(response: Response, outputPath: string): Promise<void> {
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, buffer);
}
