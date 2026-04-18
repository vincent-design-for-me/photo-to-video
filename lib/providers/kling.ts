import { mkdir, readFile, writeFile } from "node:fs/promises";
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

  const imageBase64 = await readFrameAsBase64(input.firstFramePath);
  const imageTailBase64 = await readFrameAsBase64(input.lastFramePath);
  const baseUrl = process.env.KLING_API_BASE_URL.replace(/\/$/, "");

  const createResponse = await fetch(`${baseUrl}/v1/videos/image2video`, {
    method: "POST",
    signal: AbortSignal.timeout(120_000),
    headers: {
      Authorization: authorization,
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
  });

  if (!createResponse.ok) {
    throw new Error(`Kling task creation failed: ${await createResponse.text()}`);
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

  const videoUrl = await pollKlingTask(baseUrl, taskId, authorization);
  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Kling video download failed: ${videoResponse.status}`);
  }

  await writeFile(input.outputPath, Buffer.from(await videoResponse.arrayBuffer()));
  return input.outputPath;
}

async function pollKlingTask(baseUrl: string, taskId: string, authorization: string): Promise<string> {
  const attempts = Number(process.env.KLING_POLL_ATTEMPTS ?? 120);
  const intervalMs = Number(process.env.KLING_POLL_INTERVAL_MS ?? 5000);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(`${baseUrl}/v1/videos/image2video/${taskId}`, {
      signal: AbortSignal.timeout(30_000),
      headers: { Authorization: authorization }
    });
    if (!response.ok) {
      throw new Error(`Kling status failed: ${await response.text()}`);
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
      throw new Error(payload.data?.task_status_msg ?? payload.error ?? "Kling task failed");
    }

    // Official response: data.task_result.videos[0].url
    const videoUrl =
      payload.data?.task_result?.videos?.[0]?.url ??
      payload.video_url;

    if (videoUrl) {
      return videoUrl;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Kling task timed out");
}

async function readFrameAsBase64(filePath: string): Promise<string> {
  const data = await readFile(filePath);
  return data.toString("base64");
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") {
    return fallback;
  }
  return value === "true" || value === "1" || value === "yes";
}
