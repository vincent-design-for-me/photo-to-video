import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createPlaceholderClip } from "../video/ffmpeg";
import { buildKlingAuthorization } from "./klingAuth";
import { generateKlingSkillClip } from "./klingSkill";

type GenerateKlingClipInput = {
  jobId: string;
  firstFramePath: string;
  lastFramePath: string;
  prompt: string;
  aspectRatio: string;
  clipSeconds: number;
  outputPath: string;
};

export async function generateKlingClip(input: GenerateKlingClipInput): Promise<string> {
  await mkdir(path.dirname(input.outputPath), { recursive: true });

  const authorization = buildKlingAuthorization({
    apiKey: process.env.KLING_API_KEY,
    accessKey: process.env.KLING_ACCESS_KEY,
    secretKey: process.env.KLING_SECRET_KEY
  });

  if (!authorization || !process.env.KLING_API_BASE_URL) {
    return createPlaceholderClip({
      imagePath: input.lastFramePath,
      outputPath: input.outputPath,
      durationSeconds: input.clipSeconds
    });
  }

  if ((process.env.KLING_PROVIDER ?? "image2video") === "skill") {
    return generateKlingSkillClip(input, authorization);
  }

  const firstFrameUrl = await uploadFrameForKling(input.firstFramePath);
  const lastFrameUrl = await uploadFrameForKling(input.lastFramePath);
  const baseUrl = process.env.KLING_API_BASE_URL.replace(/\/$/, "");
  const createResponse = await fetch(`${baseUrl}/v1/videos/image2video`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.KLING_MODEL ?? "video-3.0-omni",
      prompt: input.prompt,
      duration: Number(process.env.KLING_DURATION_SECONDS ?? input.clipSeconds),
      aspect_ratio: input.aspectRatio,
      resolution: process.env.KLING_RESOLUTION ?? "1080p",
      native_audio: parseBooleanEnv(process.env.KLING_NATIVE_AUDIO, true),
      audio_sync: parseBooleanEnv(process.env.KLING_AUDIO_SYNC, true),
      mode: process.env.KLING_MODE ?? "professional",
      image: firstFrameUrl,
      first_frame: firstFrameUrl,
      last_frame: lastFrameUrl,
      negative_prompt:
        "jitter, flicker, warped furniture, distorted architecture, people, logos, text, melting objects"
    })
  });

  if (!createResponse.ok) {
    throw new Error(`Kling task creation failed: ${await createResponse.text()}`);
  }

  const created = (await createResponse.json()) as { task_id?: string; id?: string };
  const taskId = created.task_id ?? created.id;
  if (!taskId) {
    throw new Error("Kling did not return a task id");
  }

  const videoUrl = await pollKlingTask(baseUrl, taskId, authorization);
  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Kling video download failed: ${videoResponse.status}`);
  }

  await copyFileLike(videoResponse, input.outputPath);
  return input.outputPath;
}

async function pollKlingTask(baseUrl: string, taskId: string, authorization: string): Promise<string> {
  const attempts = Number(process.env.KLING_POLL_ATTEMPTS ?? 120);
  const intervalMs = Number(process.env.KLING_POLL_INTERVAL_MS ?? 5000);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(`${baseUrl}/v1/videos/${taskId}`, {
      headers: { Authorization: authorization }
    });
    if (!response.ok) {
      throw new Error(`Kling status failed: ${await response.text()}`);
    }
    const payload = (await response.json()) as {
      status?: string;
      video_url?: string;
      output?: { video_url?: string; url?: string };
      result?: { video_url?: string; url?: string };
      error?: string;
    };

    if (payload.status === "failed") {
      throw new Error(payload.error ?? "Kling task failed");
    }

    const videoUrl = payload.video_url ?? payload.output?.video_url ?? payload.output?.url ?? payload.result?.video_url ?? payload.result?.url;
    if (videoUrl) {
      return videoUrl;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Kling task timed out");
}

async function uploadFrameForKling(filePath: string): Promise<string> {
  if (process.env.PUBLIC_ASSET_BASE_URL) {
    return `${process.env.PUBLIC_ASSET_BASE_URL.replace(/\/$/, "")}/${path.basename(filePath)}`;
  }

  throw new Error(
    "Kling needs public frame URLs. Set PUBLIC_ASSET_BASE_URL or replace uploadFrameForKling with your storage uploader."
  );
}

async function copyFileLike(response: Response, outputPath: string): Promise<void> {
  const buffer = Buffer.from(await response.arrayBuffer());
  await import("node:fs/promises").then((fs) => fs.writeFile(outputPath, buffer));
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") {
    return fallback;
  }
  return value === "true" || value === "1" || value === "yes";
}
