import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildTimelinePlan } from "./timeline";
import { runWithConcurrency } from "../http/fetchWithRetry";

const execFileAsync = promisify(execFile);
const ffmpegPath = require("ffmpeg-static") as string | null;
const ffmpegBinary = ffmpegPath ?? "ffmpeg";

const FFMPEG_TIMEOUT_MS = Number(process.env.FFMPEG_TIMEOUT_MS ?? 180_000);
const FFMPEG_MAX_BUFFER = 16 * 1024 * 1024;
const FFMPEG_THREADS = String(Math.max(1, Number(process.env.FFMPEG_THREADS ?? 2)));
const FFMPEG_CONCURRENCY = Math.max(1, Number(process.env.FFMPEG_CONCURRENCY ?? 2));

type PlaceholderClipInput = {
  imagePath: string;
  outputPath: string;
  durationSeconds: number;
};

type RenderFinalVideoInput = {
  clipPaths: string[];
  outputPath: string;
  clipSeconds: number;
  width: number;
  height: number;
};

function allowTextPlaceholderFallback(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_PREVIEW_FALLBACK !== "false";
}

async function hasAudioStream(filePath: string): Promise<boolean> {
  try {
    await execFileAsync(ffmpegBinary, ["-hide_banner", "-i", filePath], {
      timeout: 15_000,
      maxBuffer: FFMPEG_MAX_BUFFER,
    });
    return false;
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? "";
    return /Stream #\d+:\d+[^:]*:\s*Audio:/i.test(stderr);
  }
}

export async function createPlaceholderClip(input: PlaceholderClipInput): Promise<string> {
  await mkdir(path.dirname(input.outputPath), { recursive: true });

  try {
    await execFileAsync(
      ffmpegBinary,
      [
        "-y",
        "-loop",
        "1",
        "-i",
        input.imagePath,
        "-f",
        "lavfi",
        "-i",
        "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-t",
        String(input.durationSeconds),
        "-shortest",
        "-vf",
        "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p",
        "-r",
        "30",
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-threads",
        FFMPEG_THREADS,
        "-movflags",
        "+faststart",
        input.outputPath,
      ],
      { timeout: FFMPEG_TIMEOUT_MS, maxBuffer: FFMPEG_MAX_BUFFER }
    );
    return input.outputPath;
  } catch (error) {
    if (!allowTextPlaceholderFallback()) {
      throw new Error(
        `FFmpeg failed to create preview clip (${ffmpegBinary}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
    await writeFile(input.outputPath, "FFmpeg is required to generate preview video clips.\n");
    return input.outputPath;
  }
}

export async function renderFinalVideo(input: RenderFinalVideoInput): Promise<string> {
  await mkdir(path.dirname(input.outputPath), { recursive: true });
  const plan = buildTimelinePlan(input.clipPaths, { clipSeconds: input.clipSeconds });
  const listPath = path.join(path.dirname(input.outputPath), "work", "concat.txt");
  await mkdir(path.dirname(listPath), { recursive: true });

  const vf = [
    `scale=${input.width}:${input.height}:force_original_aspect_ratio=increase`,
    `crop=${input.width}:${input.height}`,
    "eq=contrast=1.08:saturation=1.12:gamma=0.98",
    "unsharp=5:5:0.45:3:3:0.2",
    "format=yuv420p",
  ].join(",");

  // Bound concurrency and thread count so Serverless containers don't OOM or exhaust /tmp.
  const normalized = await runWithConcurrency(plan.segments, FFMPEG_CONCURRENCY, async (segment) => {
    const output = path.join(path.dirname(input.outputPath), "work", `normalized-${segment.index}.mp4`);
    const sourceHasAudio = await hasAudioStream(segment.source);

    const args = sourceHasAudio
      ? [
          "-y",
          "-i",
          segment.source,
          "-t",
          String(segment.durationSeconds),
          "-vf",
          vf,
          "-r",
          "30",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-c:a",
          "aac",
          "-ar",
          "44100",
          "-ac",
          "2",
          "-threads",
          FFMPEG_THREADS,
          output,
        ]
      : [
          "-y",
          "-i",
          segment.source,
          "-f",
          "lavfi",
          "-t",
          String(segment.durationSeconds),
          "-i",
          "anullsrc=channel_layout=stereo:sample_rate=44100",
          "-t",
          String(segment.durationSeconds),
          "-map",
          "0:v:0",
          "-map",
          "1:a:0",
          "-vf",
          vf,
          "-r",
          "30",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-c:a",
          "aac",
          "-ar",
          "44100",
          "-ac",
          "2",
          "-threads",
          FFMPEG_THREADS,
          output,
        ];

    await execFileAsync(ffmpegBinary, args, {
      timeout: FFMPEG_TIMEOUT_MS,
      maxBuffer: FFMPEG_MAX_BUFFER,
    });
    return output;
  });

  await writeFile(listPath, normalized.map((clip) => `file '${clip.replaceAll("'", "'\\''")}'`).join("\n"));

  await execFileAsync(
    ffmpegBinary,
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      input.outputPath,
    ],
    { timeout: FFMPEG_TIMEOUT_MS, maxBuffer: FFMPEG_MAX_BUFFER }
  );

  return input.outputPath;
}
