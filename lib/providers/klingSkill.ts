import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
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

export async function generateKlingSkillClip(input: GenerateKlingSkillClipInput, authorization?: string): Promise<string> {
  await mkdir(path.dirname(input.outputPath), { recursive: true });

  if (!authorization || !process.env.KLING_API_BASE_URL) {
    return createPlaceholderClip({
      imagePath: input.lastFramePath,
      outputPath: input.outputPath,
      durationSeconds: input.clipSeconds
    });
  }

  const firstFrameUrl = await resolvePublicFrameUrl(input.firstFramePath);
  const lastFrameUrl = await resolvePublicFrameUrl(input.lastFramePath);
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

  const createResponse = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  if (!createResponse.ok) {
    throw new Error(`Kling Skill task creation failed: ${await createResponse.text()}`);
  }

  const created = (await createResponse.json()) as UnknownJson;
  const taskId = findString(created, ["task_id", "id", "data.task_id", "data.id"]);
  if (!taskId) {
    throw new Error("Kling Skill did not return a task id");
  }

  const videoUrl = await pollKlingSkillTask(baseUrl, taskId, authorization);
  const videoResponse = await fetch(videoUrl);
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

async function pollKlingSkillTask(baseUrl: string, taskId: string, authorization: string): Promise<string> {
  const attempts = Number(process.env.KLING_POLL_ATTEMPTS ?? 120);
  const intervalMs = Number(process.env.KLING_POLL_INTERVAL_MS ?? 5000);
  const statusPath = process.env.KLING_SKILL_STATUS_PATH ?? "/v1/videos/{task_id}";

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(buildUrl(baseUrl, statusPath.replace("{task_id}", encodeURIComponent(taskId))), {
      headers: { Authorization: authorization }
    });
    if (!response.ok) {
      throw new Error(`Kling Skill status failed: ${await response.text()}`);
    }

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

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Kling Skill task timed out");
}

async function resolvePublicFrameUrl(filePath: string): Promise<string> {
  if (process.env.PUBLIC_ASSET_BASE_URL) {
    return `${process.env.PUBLIC_ASSET_BASE_URL.replace(/\/$/, "")}/${path.basename(filePath)}`;
  }

  throw new Error(
    "Kling Skill needs public frame URLs. Set PUBLIC_ASSET_BASE_URL or replace resolvePublicFrameUrl with your storage uploader."
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
